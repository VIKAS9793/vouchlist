/**
 * Shared guard for every `/api/public/*` endpoint.
 *
 * That prefix bypasses site auth, so each handler has to prove the caller for
 * itself. Keeping the token comparison, the token sources and the per-caller
 * rate limit in one place means the endpoints cannot drift apart, and a new
 * endpoint gets the same protection by construction.
 */

import { callerDigest, recordGuardEvent, type GuardOutcome } from "./api-guard-metrics";

/**
 * Plain fallback used when the app's own not-found page cannot be reached.
 * Prefer `cloakedNotFound`, which is byte identical to a missing route.
 */
export function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
}

/**
 * A path that is deliberately not a route, used to sample what the app
 * returns for something that does not exist.
 */
const PROBE_PATH = "/api/public/__does-not-exist";

let notFoundSample: Promise<{ body: string; headers: [string, string][] } | null> | null = null;

/**
 * Refusals from a gated endpoint have to look exactly like a missing route,
 * otherwise the status alone confirms the endpoint is there. Rather than
 * guessing what the router renders for an unknown path, ask it once per worker
 * and reuse the answer.
 */
export async function cloakedNotFound(request: Request): Promise<Response> {
  if (!notFoundSample) {
    notFoundSample = (async () => {
      try {
        const url = new URL(PROBE_PATH, request.url);
        const res = await fetch(new Request(url, { headers: { accept: "text/html" } }));
        if (res.status !== 404) return null;
        return { body: await res.text(), headers: [...res.headers.entries()] };
      } catch {
        return null;
      }
    })();
  }
  const sample = await notFoundSample.catch(() => null);
  if (!sample) return notFound();
  // The rendered page echoes the requested path twice: as a URL, and as the
  // router's null separated match id. A sample taken for the probe path would
  // otherwise be a few bytes off, so rewrite both forms to this URL and keep
  // the response indistinguishable from a real miss.
  const target = safePathname(request.url);
  const body = sample.body
    .split(PROBE_PATH)
    .join(target)
    .split(PROBE_PATH.replaceAll("/", "\u0000"))
    .join(target.replaceAll("/", "\u0000"));
  const headers = new Headers(sample.headers);
  headers.delete("content-length");
  headers.set("cache-control", "no-store");
  return new Response(body, { status: 404, headers });
}

/** Methods a route does not implement must not confirm the route exists. */
export function cloakedHandler() {
  return async ({ request }: { request: Request }) => cloakedNotFound(request);
}

/**
 * For an endpoint whose existence is not a secret (the browser posts to it),
 * an unsupported method gets the correct refusal instead of a disguise.
 */
export function methodNotAllowed(allow: string, headers: Record<string, string> = {}): Response {
  return new Response(null, {
    status: 405,
    headers: { ...NO_STORE, allow, ...headers },
  });
}

const NO_STORE = { "cache-control": "no-store" } as const;

/**
 * Why a credential was refused. Kept as a closed set so every endpoint
 * answers the same way for the same situation.
 *
 * - `missing` and `malformed` are the caller's request being wrong before any
 *   secret is consulted, so they are 401: fix the request and retry.
 * - `invalid` and `replayed` mean a credential was presented and rejected, so
 *   they are 403: retrying the same request will not help.
 */
export type AuthFailure = "missing" | "malformed" | "invalid" | "replayed";

const FAILURE_STATUS: Record<AuthFailure, number> = {
  missing: 401,
  malformed: 401,
  invalid: 403,
  replayed: 403,
};

/** RFC 6750 error codes, so generic clients can react without parsing prose. */
const FAILURE_CODE: Record<AuthFailure, string> = {
  missing: "invalid_request",
  malformed: "invalid_request",
  invalid: "invalid_token",
  replayed: "invalid_token",
};

const FAILURE_DESCRIPTION: Record<AuthFailure, string> = {
  missing: "A bearer token is required",
  malformed: "The Authorization header is not a well formed bearer token",
  invalid: "The presented token was rejected",
  replayed: "The request nonce or timestamp was already used or is out of date",
};

/**
 * One response shape for every credential refusal. The body carries no detail
 * about the expected secret, only which of the four situations occurred.
 */
export function authFailure(reason: AuthFailure, headers: Record<string, string> = {}): Response {
  const code = FAILURE_CODE[reason];
  return new Response(JSON.stringify({ error: code, reason }), {
    status: FAILURE_STATUS[reason],
    headers: {
      ...NO_STORE,
      "content-type": "application/json",
      "www-authenticate": `Bearer error="${code}", error_description="${FAILURE_DESCRIPTION[reason]}"`,
      ...headers,
    },
  });
}

export function tooManyRequests(headers: Record<string, string> = {}): Response {
  return new Response(null, { status: 429, headers: { "cache-control": "no-store", ...headers } });
}

/**
 * Constant time comparison of two equal length strings. Callers should prefer
 * `secretEquals`, which also hides the length of the expected value.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Compares two secrets through fixed width SHA-256 digests, so neither the
 * length nor the position of the first differing byte is observable in the
 * response timing.
 */
export async function secretEquals(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i += 1) diff |= va[i] ^ vb[i];
  return diff === 0;
}

/** Best effort caller identity: edge header first, then proxy chain. */
export function clientKey(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Longest credential accepted; anything larger is rejected without work. */
export const MAX_TOKEN_LENGTH = 512;

/** A token is opaque, but it is still a header value: printable ASCII only. */
const TOKEN_CHARS = /^[\x21-\x7e]+$/;

export type CredentialResult =
  | { ok: true; token: string }
  | { ok: false; reason: Extract<AuthFailure, "missing" | "malformed"> };

/**
 * Reads the credential from `Authorization: Bearer` or, as a fallback for the
 * database scheduler which cannot set headers, from `?token=`.
 *
 * Distinguishes "no credential at all" from "a credential that is not usable",
 * so the guard can answer 401 with the right reason instead of treating every
 * bad header as an absent one.
 */
export function readCredential(request: Request): CredentialResult {
  const header = request.headers.get("authorization");

  if (header !== null) {
    const value = header.trim();
    if (!value) return { ok: false, reason: "malformed" };
    // Exactly one scheme and one token; no comma lists, no extra parameters.
    const match = /^([A-Za-z]+)[ \t]+(\S+)$/.exec(value);
    if (!match) return { ok: false, reason: "malformed" };
    const [, scheme, token] = match;
    if (scheme.toLowerCase() !== "bearer") return { ok: false, reason: "malformed" };
    // An oversized value can only be junk or an attempt to burn CPU.
    if (token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "malformed" };
    if (!TOKEN_CHARS.test(token)) return { ok: false, reason: "malformed" };
    return { ok: true, token };
  }

  let query: string | null = null;
  try {
    query = new URL(request.url).searchParams.get("token");
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (query === null) return { ok: false, reason: "missing" };
  if (!query) return { ok: false, reason: "malformed" };
  if (query.length > MAX_TOKEN_LENGTH || !TOKEN_CHARS.test(query)) {
    return { ok: false, reason: "malformed" };
  }
  return { ok: true, token: query };
}

export type RateLimitRule = { windowMs: number; max: number };

/**
 * Hard ceiling on tracked callers. Without it a stream of unique source
 * addresses would grow the map for the lifetime of the isolate.
 */
const MAX_BUCKETS = 5_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

function evict(now: number) {
  for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
  // Map preserves insertion order, so the head is the oldest entry.
  while (buckets.size > MAX_BUCKETS) {
    const oldest = buckets.keys().next();
    if (oldest.done) break;
    buckets.delete(oldest.value);
  }
}

/**
 * Fixed window counter shared by all endpoints; the bucket name keeps each
 * endpoint's budget separate.
 */
export function rateLimited(
  bucket: string,
  key: string,
  { windowMs, max }: RateLimitRule,
  now = Date.now(),
): boolean {
  const id = `${bucket}:${key}`;
  const entry = buckets.get(id);
  if (!entry || now > entry.resetAt) {
    buckets.delete(id);
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    if (buckets.size > MAX_BUCKETS) evict(now);
    return false;
  }
  entry.count += 1;
  // Stop incrementing once blocked so a sustained flood cannot overflow.
  if (entry.count > max) {
    entry.count = max + 1;
    return true;
  }
  return false;
}

/**
 * The database scheduler cannot read runtime secrets, so it presents a token
 * kept in `internal_tokens` instead of an environment secret.
 */
async function internalTokenMatches(name: string, presented: string): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("internal_tokens")
      .select("token")
      .eq("name", name)
      .maybeSingle();
    const token = (data as { token: string } | null)?.token;
    return Boolean(token && (await secretEquals(presented, token)));
  } catch {
    return false;
  }
}

export type GuardOptions = {
  /** Bucket name for the rate limit counter; defaults to the request path. */
  bucket?: string;
  rateLimit?: RateLimitRule;
  /** Name of the environment secret accepted as a bearer token. */
  envSecret?: string;
  /** Row name in `internal_tokens` accepted as a bearer token. */
  internalToken?: string;
  /** Extra headers to attach to a 429 (CORS, for example). */
  headers?: Record<string, string>;
  /**
   * Maximum age accepted for a signed request timestamp. Defaults to five
   * minutes; only applies when the caller sends replay metadata.
   */
  replayWindowMs?: number;
  /** Require replay metadata rather than only validating it when present. */
  requireReplayProtection?: boolean;
  /**
   * Disguise every pre-authentication refusal as a missing route. On by
   * default for gated endpoints; turn it off only for an endpoint whose
   * existence is already public.
   */
  cloak?: boolean;
};

/** Seen nonces, bounded the same way as the rate limit buckets. */
const MAX_NONCES = 5_000;
const seenNonces = new Map<string, number>();

function rememberNonce(nonce: string, expiresAt: number, now: number): boolean {
  for (const [key, expiry] of seenNonces) {
    if (expiry > now) break; // insertion order keeps the oldest first
    seenNonces.delete(key);
  }
  if (seenNonces.has(nonce)) return false;
  seenNonces.set(nonce, expiresAt);
  while (seenNonces.size > MAX_NONCES) {
    const oldest = seenNonces.keys().next();
    if (oldest.done) break;
    seenNonces.delete(oldest.value);
  }
  return true;
}

export const DEFAULT_REPLAY_WINDOW_MS = 5 * 60_000;

/**
 * Rejects a captured request that is sent again.
 *
 * A caller proves freshness with `x-request-timestamp` (epoch milliseconds,
 * inside the window) and uniqueness with `x-request-nonce`. Both are optional
 * by default so existing schedulers keep working; when either is present it
 * must be valid, and `requireReplayProtection` makes both mandatory.
 */
export function replayCheck(
  request: Request,
  { windowMs = DEFAULT_REPLAY_WINDOW_MS, required = false } = {},
  now = Date.now(),
): AuthFailure | null {
  const timestamp = request.headers.get("x-request-timestamp");
  const nonce = request.headers.get("x-request-nonce");

  if (required && (!timestamp || !nonce)) return "missing";
  if (!timestamp && !nonce) return null;
  // Half a pair proves nothing: a nonce with no clock never expires, and a
  // timestamp with no nonce can be replayed freely inside the window.
  if (!timestamp || !nonce) return "malformed";

  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) return "malformed";
  if (nonce.length > MAX_TOKEN_LENGTH || !TOKEN_CHARS.test(nonce)) return "malformed";
  if (Math.abs(now - sent) > windowMs) return "replayed";
  if (!rememberNonce(nonce, now + windowMs, now)) return "replayed";
  return null;
}

/**
 * Returns a Response when the request must be refused, or null when the
 * handler may proceed. Endpoints with no token option stay public but are
 * still rate limited.
 *
 * Refusals are uniform across endpoints. For a gated endpoint every refusal
 * that happens before the caller proves itself is served as a plain missing
 * route, so a stranger cannot tell a protected endpoint from a typo, and no
 * flood cap or token check is observable from outside. Once the token is
 * accepted the honest codes apply: 429 when flooded, 403 for a replayed
 * request, 401 when required replay metadata is absent or unusable. Ungated
 * endpoints, whose existence is public anyway, get those codes throughout.
 */
export async function guardPublicRequest(
  request: Request,
  options: GuardOptions = {},
): Promise<Response | null> {
  const {
    bucket,
    rateLimit,
    envSecret,
    internalToken,
    headers,
    replayWindowMs,
    requireReplayProtection,
    cloak,
  } = options;
  const gated = Boolean(envSecret || internalToken);
  const disguise = cloak ?? gated;
  const startedAt = Date.now();
  const endpoint = bucket ?? safePathname(request.url);
  const key = clientKey(request);
  const caller = callerDigest(clientKey(request));
  // eslint-disable-next-line prefer-const
  let credentialSource: "header" | "query" | undefined;
  const finish = (outcome: GuardOutcome, response: Response | null) => {
    recordGuardEvent({
      endpoint,
      outcome,
      method: request.method,
      caller,
      gated,
      credential: credentialSource,
      durationMs: Date.now() - startedAt,
    });
    return response;
  };
  // Refusals before the caller is known reveal nothing, including the reason.
  const refuse = async (outcome: GuardOutcome, honest: () => Response) =>
    finish(outcome, disguise ? await cloakedNotFound(request) : honest());

  if (!gated) {
    if (rateLimit && rateLimited(endpoint, key, rateLimit)) {
      return refuse("rate_limited", () => tooManyRequests(headers));
    }
    return finish("allowed", null);
  }

  // A stranger must not be able to spend the worker's time guessing tokens, so
  // failed attempts are counted separately from the endpoint's own budget. The
  // counter is only consulted before the expensive lookup, and never blocks a
  // caller that has already proved itself.
  // Deliberately looser than the endpoint's own budget, so a legitimate caller
  // that floods meets the honest 429 rather than this hidden brake.
  const probeLimit = rateLimit
    ? { windowMs: rateLimit.windowMs, max: rateLimit.max * 2 }
    : { windowMs: 60_000, max: 60 };
  const countProbe = () => rateLimited(`${endpoint}#probe`, key, probeLimit);

  const credential = readCredential(request);
  if (!credential.ok) {
    countProbe();
    return refuse(credential.reason, () => authFailure(credential.reason, headers));
  }
  credentialSource = request.headers.get("authorization") !== null ? "header" : "query";

  const expected = envSecret ? process.env[envSecret] : undefined;
  let accepted = Boolean(expected) && (await secretEquals(credential.token, expected!));
  if (!accepted && internalToken) {
    // Reading the scheduler's token costs a database round trip, so a caller
    // that keeps guessing is stopped before it gets one.
    if (countProbe()) return refuse("rate_limited", () => tooManyRequests(headers));
    accepted = await internalTokenMatches(internalToken, credential.token);
  }
  if (!accepted) {
    countProbe();
    return refuse("invalid", () => authFailure("invalid", headers));
  }

  // The caller is now known to hold the secret, so it gets honest answers.
  if (rateLimit && rateLimited(endpoint, key, rateLimit)) {
    return finish("rate_limited", tooManyRequests(headers));
  }

  // Only run replay bookkeeping for a caller that already proved itself, so an
  // unauthenticated flood cannot fill the nonce table.
  const replay = replayCheck(request, {
    windowMs: replayWindowMs,
    required: requireReplayProtection,
  });
  if (replay) {
    const outcome: GuardOutcome = replay === "replayed" ? "replayed" : replay;
    return finish(outcome, authFailure(replay, headers));
  }

  return finish("allowed", null);
}

/** A malformed URL must not throw before the guard can answer. */
function safePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "unknown";
  }
}
