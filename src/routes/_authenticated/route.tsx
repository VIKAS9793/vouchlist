import { createFileRoute, Outlet, redirect, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isStaffPath } from "@/lib/staff-routes";
import { NotFound } from "@/components/site/NotFound";

/**
 * Gate for everything signed-in.
 *
 * Rendered on the client only: the session lives in localStorage, which the
 * server cannot read, so checking it during server rendering would bounce
 * signed-in people back to the sign-in screen on every hard refresh.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Internal pages must look missing rather than protected: bouncing a
      // visitor to sign in would confirm the page is there.
      if (isStaffPath(location.pathname)) throw notFound();
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
  notFoundComponent: NotFound,
});
