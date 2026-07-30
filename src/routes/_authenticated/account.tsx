import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";
import { RelatedLinks } from "@/components/site/RelatedLinks";
import { supabase } from "@/integrations/supabase/client";
import { displayName, useSession } from "@/lib/auth";
import { getStaffAccess } from "@/lib/staff.functions";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Your VouchList account" },
      {
        name: "description",
        content: "The account you signed in with, and how to sign out of VouchList.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  // Internal tools are only mentioned to the people who run VouchList.
  const { data: staff } = useQuery({
    queryKey: ["staff-access"],
    queryFn: () => getStaffAccess(),
    staleTime: 5 * 60 * 1000,
  });

  async function onSignOut() {
    setSigningOut(true);
    // Stop in-flight requests before the session disappears underneath them,
    // and drop anything cached so the back button cannot show it again.
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <>
      <section className="mx-auto w-full max-w-3xl px-6 py-20">
        <Reveal>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            {user ? `Hello, ${displayName(user)}` : "Your account"}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            You are signed in with Google. VouchList is currently a demand-validation project, so
            there is nothing to manage here yet. If this concept moves to a built product your
            community will be contacted through the email you registered.
          </p>

          <dl className="mt-8 grid gap-4 rounded-2xl border border-border/60 bg-card p-6 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Signed in as</dt>
              <dd className="font-medium">{user?.email ?? ""}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={onSignOut} disabled={signingOut} className="min-h-11 rounded-xl">
              <LogOut aria-hidden="true" className="size-4" />
              {signingOut ? "Signing out" : "Sign out"}
            </Button>
            {staff?.isStaff ? (
              <Link to="/insights" className="text-sm underline underline-offset-4">
                Product interest signals
              </Link>
            ) : null}
            <Link to="/" className="text-sm underline underline-offset-4">
              Back to VouchList
            </Link>
          </div>
        </Reveal>
      </section>
      <RelatedLinks path="/" heading="Keep reading" />
    </>
  );
}
