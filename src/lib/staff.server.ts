/**
 * Who counts as internal staff (owner / developer / admin).
 *
 * Single source of truth for every internal-only surface. Server only:
 * the list must never reach the browser bundle.
 */
const OWNER_EMAILS = ["vikassahani17@gmail.com"];

export function isOwnerEmail(email: unknown): boolean {
  return typeof email === "string" && OWNER_EMAILS.includes(email.trim().toLowerCase());
}
