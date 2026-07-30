import { createFileRoute, Outlet, notFound } from "@tanstack/react-router";
import { getStaffAccess } from "@/lib/staff.functions";
import { NotFound } from "@/components/site/NotFound";

/**
 * Internal-only area (owner, developer, admin).
 *
 * Signing in is not enough: pages under here are for the people who run
 * VouchList, not for customers. Anyone else gets the ordinary 404 page, so the
 * page does not even advertise that it exists. The server functions these
 * pages call re-check staff status themselves, so this gate is convenience,
 * not the security boundary.
 */
export const Route = createFileRoute("/_authenticated/_staff")({
  ssr: false,
  beforeLoad: async () => {
    const { isStaff } = await getStaffAccess();
    if (!isStaff) throw notFound();
    return { isStaff: true as const };
  },
  component: () => <Outlet />,
  notFoundComponent: NotFound,
});
