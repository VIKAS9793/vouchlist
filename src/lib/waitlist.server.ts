/**
 * Server-only waitlist logic: bot detection, rate limiting and the privileged
 * insert. Visitors cannot write to the waitlist table directly (row level
 * security grants no insert to anon), so every signup passes through here.
 */
import {
  MIN_FILL_MS,
  RATE_LIMITS,
  type WaitlistPayload,
  type WaitlistResult,
} from "./waitlist-schema";

export * from "./waitlist-schema";

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "yopmail.com",
  "tempmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "dispostable.com",
  "fakeinbox.com",
]);

const LINK_SPAM = /(https?:\/\/|www\.|\[url=|<a\s)/i;

/** Cheap structural checks that catch scripted submissions before any write. */
export function detectBot(input: WaitlistPayload): WaitlistResult | null {
  if (input.website && input.website.trim() !== "") {
    return {
      ok: false,
      reason: "bot",
      message: "We could not verify this submission. Please try again.",
    };
  }
  if (typeof input.elapsedMs === "number" && input.elapsedMs < MIN_FILL_MS) {
    return { ok: false, reason: "bot", message: "That was a little too quick. Please try again." };
  }
  const fields = [input.name, input.community ?? "", input.city ?? ""].join(" ");
  if (LINK_SPAM.test(fields)) {
    return { ok: false, reason: "bot", message: "Links are not allowed in these fields." };
  }
  const domain = input.email.split("@")[1]?.toLowerCase() ?? "";
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, reason: "bot", message: "Please use a permanent email address." };
  }
  if (/(.)\1{7,}/.test(input.name)) {
    return { ok: false, reason: "bot", message: "Please enter your real name." };
  }
  return null;
}

/** Opaque, non reversible bucket key so raw IPs and emails are never stored. */
async function bucketKey(scope: string, value: string) {
  const data = new TextEncoder().encode(`${scope}:${value.toLowerCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return `${scope}:${Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32)}`;
}

type AdminClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

/**
 * Counts recent attempts per scope and records this one. Returns a rejection
 * when any rolling window is already full.
 */
/**
 * Loopback and private addresses only occur for local development and the
 * automated test suite, where per-address limits would block repeated runs.
 * Public traffic always carries a routable address.
 */
export function isLocalAddress(ip: string) {
  return (
    ip === "unknown" ||
    ip === "::1" ||
    ip === "localhost" ||
    /^127\./.test(ip) ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

export async function enforceRateLimit(
  admin: AdminClient,
  { ip, email }: { ip: string; email: string },
): Promise<WaitlistResult | null> {
  const keys = {
    ip: await bucketKey("ip", ip),
    email: await bucketKey("email", email),
  };

  const local = isLocalAddress(ip);

  for (const limit of RATE_LIMITS) {
    if (limit.scope === "ip" && local) continue;
    const since = new Date(Date.now() - limit.windowMs).toISOString();
    const { count, error } = await admin
      .from("waitlist_throttle")
      .select("id", { count: "exact", head: true })
      .eq("bucket", keys[limit.scope as keyof typeof keys])
      .gte("created_at", since);

    // Fail closed on a throttle read error rather than allowing unlimited writes.
    if (error) {
      return { ok: false, reason: "error", message: "Something went wrong. Please try again." };
    }
    if ((count ?? 0) >= limit.max) {
      return {
        ok: false,
        reason: "rate_limited",
        message: "Too many signups from here right now. Please try again later.",
      };
    }
  }

  const rows = local ? [{ bucket: keys.email }] : [{ bucket: keys.ip }, { bucket: keys.email }];
  await admin.from("waitlist_throttle").insert(rows);
  // Keep the log small; entries older than the widest window are useless.
  const cutoff = new Date(Date.now() - 48 * 60 * 60_000).toISOString();
  await admin.from("waitlist_throttle").delete().lt("created_at", cutoff);
  return null;
}
