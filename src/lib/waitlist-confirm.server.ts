/**
 * Server-only helpers for the double opt-in flow. A signup is stored as a
 * pending lead with a single-use token; only a click on the emailed link
 * promotes it to a confirmed lead.
 */

/** How long a confirmation link stays valid. */
export const CONFIRM_TTL_MS = 7 * 24 * 60 * 60_000;

export type ConfirmOutcome =
  | { status: "confirmed"; name: string; alreadyConfirmed: boolean }
  | { status: "expired" }
  | { status: "invalid" }
  | { status: "error" };

/** URL-safe, high entropy, single use. */
export function mintConfirmationToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Absolute link a recipient clicks to confirm their address. */
export function confirmationUrl(origin: string, token: string) {
  return `${origin}/waitlist/confirm?token=${encodeURIComponent(token)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase admin client returned by createClient() has no exported type; `any` is the only practical escape hatch until Supabase ships a stable typed admin client
type AdminClient = { from: (table: string) => any };

/**
 * Exchanges a token for a confirmed lead. Re-clicking an already used link is
 * treated as success so a forwarded or prefetched email is never punished.
 */
export async function confirmWithToken(admin: AdminClient, token: string): Promise<ConfirmOutcome> {
  if (!/^[a-f0-9]{64}$/.test(token)) return { status: "invalid" };

  const { data: row, error } = await admin
    .from("waitlist")
    .select("id, name, status, confirmed_at, confirmation_expires_at")
    .eq("confirmation_token", token)
    .maybeSingle();

  if (error) {
    console.error("waitlist confirm lookup failed", error.code, error.message);
    return { status: "error" };
  }
  if (!row) return { status: "invalid" };

  if (row.status === "confirmed") {
    return { status: "confirmed", name: row.name, alreadyConfirmed: true };
  }
  if (row.confirmation_expires_at && Date.parse(row.confirmation_expires_at) < Date.now()) {
    return { status: "expired" };
  }

  const { error: updateError } = await admin
    .from("waitlist")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      confirmation_token: null,
    })
    .eq("id", row.id);

  if (updateError) {
    console.error("waitlist confirm update failed", updateError.code, updateError.message);
    return { status: "error" };
  }
  return { status: "confirmed", name: row.name, alreadyConfirmed: false };
}
