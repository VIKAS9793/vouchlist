/**
 * URLs that exist only for the people who run VouchList.
 *
 * These are not product pages, so a customer must not be able to tell they
 * exist: no sign-in bounce, no redirect, just the ordinary not-found screen.
 * The route gates read this list, and scripts/private-routes-qa.mjs plus
 * e2e/staff-routes.spec.ts check the behaviour stays that way.
 */
export const STAFF_ROUTE_PREFIXES = ["/insights"] as const;

/** Is this pathname part of the internal, staff-only area? */
export function isStaffPath(pathname: string): boolean {
  return STAFF_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
