import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { SITE_ORIGIN } from "@/lib/site";
import { Reveal } from "@/components/motion/Reveal";
import { GoogleSignInButton, POST_SIGN_IN_KEY } from "@/components/site/GoogleSignInButton";
import { safeRedirect, useSession } from "@/lib/auth";

const title = "Sign in to VouchList";
const description =
  "Sign in to VouchList with your Google account. We only read your name and email address, and you can sign out at any time.";

export const Route = createFileRoute("/auth")({
  // Only keep the param when it is actually there, otherwise every visit to
  // /auth bounces once to /auth?redirect= just to fill in an empty value.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" && search.redirect ? { redirect: search.redirect } : {},
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      // A sign-in screen has nothing to offer search results.
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_ORIGIN}/auth` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/auth` }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const { loading, user } = useSession();
  const navigate = useNavigate();

  // Covers both arrivals: someone already signed in who opened this page, and
  // the return trip from Google, where the session lands a moment after mount.
  useEffect(() => {
    if (loading || !user) return;
    const parked =
      typeof window === "undefined" ? null : window.sessionStorage.getItem(POST_SIGN_IN_KEY);
    window.sessionStorage.removeItem(POST_SIGN_IN_KEY);
    navigate({ to: safeRedirect(redirect || parked), replace: true });
  }, [loading, user, redirect, navigate]);

  const destination = safeRedirect(redirect);

  return (
    <section className="mx-auto flex w-full max-w-md flex-col px-6 py-20">
      <Reveal>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Sign in to VouchList</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Use your Google account. There is no password to remember and nothing else to fill in.
        </p>

        <div className="mt-8 rounded-2xl border border-border/60 bg-card p-6">
          {user ? (
            <p className="text-sm text-muted-foreground">You are signed in. Taking you back.</p>
          ) : (
            <GoogleSignInButton redirectTo={destination} />
          )}

          <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-strong" />
            <span>
              We receive your name and email address from Google, nothing more. Read how we handle
              your details on our{" "}
              <Link to="/trust" className="underline underline-offset-4">
                trust and privacy page
              </Link>
              .
            </span>
          </p>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Not ready for an account? You can still{" "}
          <Link to="/how-it-works" className="underline underline-offset-4">
            see how VouchList works
          </Link>
          .
        </p>
      </Reveal>
    </section>
  );
}
