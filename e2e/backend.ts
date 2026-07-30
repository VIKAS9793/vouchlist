/**
 * Backend verification helpers for end-to-end tests.
 *
 * Waitlist rows are insert-only for visitors (row level security denies
 * SELECT), so reading a row back needs the server-side key. Tests skip the
 * verification step when that key is not present instead of failing.
 */
const URL_ = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type WaitlistRow = {
  id: string;
  name: string;
  email: string;
  community: string | null;
  city: string | null;
  role: string | null;
  created_at: string;
};

export type WaitlistConfirmState = {
  status: string;
  confirmation_token: string | null;
  confirmed_at: string | null;
};

export function serviceRoleAvailable() {
  return Boolean(URL_ && KEY);
}

/** Returns the most recent stored waitlist row for an email, or null. */
export async function readWaitlistRow(email: string): Promise<WaitlistRow | null> {
  if (!serviceRoleAvailable()) throw new Error("Backend read key not configured");

  const endpoint = new global.URL("/rest/v1/waitlist", URL_);
  endpoint.searchParams.set("select", "id,name,email,community,city,role,created_at");
  endpoint.searchParams.set("email", `eq.${email.toLowerCase()}`);
  endpoint.searchParams.set("order", "created_at.desc");
  endpoint.searchParams.set("limit", "1");

  const headers: Record<string, string> = { apikey: KEY!, accept: "application/json" };
  // Legacy JWT-format keys also expect a bearer; opaque sb_secret_ keys do not.
  if (KEY!.split(".").length === 3) headers.authorization = `Bearer ${KEY}`;

  const res = await fetch(endpoint, { headers });
  if (!res.ok) throw new Error(`Backend read failed (${res.status}): ${await res.text()}`);
  const rows = (await res.json()) as WaitlistRow[];
  return rows[0] ?? null;
}

/** Reads the double opt-in state (status and pending token) for an email. */
export async function readWaitlistConfirmState(
  email: string,
): Promise<WaitlistConfirmState | null> {
  if (!serviceRoleAvailable()) throw new Error("Backend read key not configured");

  const endpoint = new global.URL("/rest/v1/waitlist", URL_);
  endpoint.searchParams.set("select", "status,confirmation_token,confirmed_at");
  endpoint.searchParams.set("email", `eq.${email.toLowerCase()}`);
  endpoint.searchParams.set("limit", "1");

  const headers: Record<string, string> = { apikey: KEY!, accept: "application/json" };
  if (KEY!.split(".").length === 3) headers.authorization = `Bearer ${KEY}`;

  const res = await fetch(endpoint, { headers });
  if (!res.ok) throw new Error(`Backend read failed (${res.status}): ${await res.text()}`);
  return ((await res.json()) as WaitlistConfirmState[])[0] ?? null;
}

/** Returns how many waitlist rows exist for an email (case insensitive). */
export async function countWaitlistRows(email: string): Promise<number> {
  if (!serviceRoleAvailable()) throw new Error("Backend read key not configured");

  const endpoint = new global.URL("/rest/v1/waitlist", URL_);
  endpoint.searchParams.set("select", "id");
  endpoint.searchParams.set("email", `eq.${email.toLowerCase()}`);

  const headers: Record<string, string> = { apikey: KEY!, accept: "application/json" };
  if (KEY!.split(".").length === 3) headers.authorization = `Bearer ${KEY}`;

  const res = await fetch(endpoint, { headers });
  if (!res.ok) throw new Error(`Backend read failed (${res.status}): ${await res.text()}`);
  return ((await res.json()) as unknown[]).length;
}

export type PrivacyRequestRow = {
  kind: string;
  status: string;
  token: string | null;
};

/** Reads the most recent privacy request row for an email. */
export async function readPrivacyRequest(email: string): Promise<PrivacyRequestRow | null> {
  if (!serviceRoleAvailable()) throw new Error("Backend read key not configured");

  const endpoint = new global.URL("/rest/v1/privacy_requests", URL_);
  endpoint.searchParams.set("select", "kind,status,token");
  endpoint.searchParams.set("email", `eq.${email.toLowerCase()}`);
  endpoint.searchParams.set("order", "created_at.desc");
  endpoint.searchParams.set("limit", "1");

  const headers: Record<string, string> = { apikey: KEY!, accept: "application/json" };
  if (KEY!.split(".").length === 3) headers.authorization = `Bearer ${KEY}`;

  const res = await fetch(endpoint, { headers });
  if (!res.ok) throw new Error(`Backend read failed (${res.status}): ${await res.text()}`);
  return ((await res.json()) as PrivacyRequestRow[])[0] ?? null;
}
