/**
 * Account free privacy requests. Anyone who joined the waitlist can ask for a
 * copy of their entry or have it deleted, without ever creating an account.
 * Proof of ownership is a single use link sent to the address itself, so the
 * form can never be used to read or destroy somebody else's data.
 */

export type PrivacyKind = "export" | "delete";

/** A request link stays usable for one day. */
export const PRIVACY_TTL_MS = 24 * 60 * 60_000;

/** Requests allowed per address within the window. */
export const PRIVACY_LIMIT = { max: 3, windowMs: 60 * 60_000 };

export type PrivacyExport = {
  name: string;
  email: string;
  community: string | null;
  city: string | null;
  role: string | null;
  status: string;
  joinedAt: string;
  confirmedAt: string | null;
};

export type PrivacyOutcome =
  | { status: "exported"; data: PrivacyExport }
  | { status: "deleted"; email: string }
  | { status: "not_found"; kind: PrivacyKind }
  | { status: "expired" }
  | { status: "invalid" }
  | { status: "error" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = { from: (table: string) => any };

/** URL safe, high entropy, single use. */
export function mintPrivacyToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Absolute link the requester clicks to prove they own the address. */
export function privacyVerifyUrl(origin: string, token: string) {
  return `${origin}/privacy/verify?token=${encodeURIComponent(token)}`;
}

/**
 * Records a pending request and returns its token. The caller must never tell
 * the visitor whether the address exists, so this succeeds either way.
 */
export async function createPrivacyRequest(
  admin: AdminClient,
  input: { email: string; kind: PrivacyKind; ip: string },
): Promise<{ ok: true; token: string } | { ok: false; reason: "rate_limited" | "error" }> {
  const email = input.email.trim().toLowerCase();
  const since = new Date(Date.now() - PRIVACY_LIMIT.windowMs).toISOString();

  const { count, error: countError } = await admin
    .from("privacy_requests")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", since);

  // Fail closed rather than allowing an unbounded stream of emails.
  if (countError) {
    console.error("privacy request throttle read failed", countError.code, countError.message);
    return { ok: false, reason: "error" };
  }
  if ((count ?? 0) >= PRIVACY_LIMIT.max) return { ok: false, reason: "rate_limited" };

  const token = mintPrivacyToken();
  const { error } = await admin.from("privacy_requests").insert({
    email,
    kind: input.kind,
    token,
    requester_ip: input.ip === "unknown" ? null : input.ip,
    expires_at: new Date(Date.now() + PRIVACY_TTL_MS).toISOString(),
  });

  if (error) {
    console.error("privacy request insert failed", error.code, error.message);
    return { ok: false, reason: "error" };
  }
  return { ok: true, token };
}

/**
 * Exchanges a token for the requested action. Tokens are cleared once used, so
 * a forwarded or prefetched link cannot repeat a deletion.
 */
export async function resolvePrivacyRequest(
  admin: AdminClient,
  token: string,
): Promise<PrivacyOutcome> {
  if (!/^[a-f0-9]{64}$/.test(token)) return { status: "invalid" };

  const { data: request, error } = await admin
    .from("privacy_requests")
    .select("id, email, kind, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("privacy request lookup failed", error.code, error.message);
    return { status: "error" };
  }
  if (!request) return { status: "invalid" };
  if (Date.parse(request.expires_at) < Date.now()) {
    await admin
      .from("privacy_requests")
      .update({ status: "expired", token: null })
      .eq("id", request.id);
    return { status: "expired" };
  }

  const { data: entry, error: entryError } = await admin
    .from("waitlist")
    .select("id, name, email, community, city, role, status, created_at, confirmed_at")
    .eq("email", request.email)
    .maybeSingle();

  if (entryError) {
    console.error("privacy request entry lookup failed", entryError.code, entryError.message);
    return { status: "error" };
  }

  const complete = async () =>
    admin
      .from("privacy_requests")
      .update({ status: "completed", completed_at: new Date().toISOString(), token: null })
      .eq("id", request.id);

  if (!entry) {
    await complete();
    return { status: "not_found", kind: request.kind as PrivacyKind };
  }

  if (request.kind === "delete") {
    const { error: deleteError } = await admin.from("waitlist").delete().eq("id", entry.id);
    if (deleteError) {
      console.error("privacy delete failed", deleteError.code, deleteError.message);
      return { status: "error" };
    }
    await complete();
    return { status: "deleted", email: request.email };
  }

  await complete();
  return {
    status: "exported",
    data: {
      name: entry.name,
      email: entry.email,
      community: entry.community,
      city: entry.city,
      role: entry.role,
      status: entry.status,
      joinedAt: entry.created_at,
      confirmedAt: entry.confirmed_at,
    },
  };
}
