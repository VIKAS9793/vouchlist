import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { confirmWaitlist } from "@/lib/waitlist.functions";
import { postSignupLinks } from "@/lib/related-links";
import type { ConfirmOutcome } from "@/lib/waitlist-confirm.server";

const title = "Confirm your VouchList waitlist email";
const description = "Confirm the email address you used to register interest in VouchList.";

export const Route = createFileRoute("/waitlist/confirm")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      // A tokenised, one-off link should never be indexed or shared.
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfirmPage,
});

const copy: Record<string, { heading: string; body: string }> = {
  confirmed: {
    heading: "Your email is confirmed.",
    body: "You are registered. We will be in touch if this concept moves to a built product.",
  },
  already: {
    heading: "You are already confirmed.",
    body: "This address was confirmed earlier, so there is nothing more to do.",
  },
  expired: {
    heading: "This link has expired.",
    body: "Confirmation links stay valid for seven days. Join the waitlist again and we will send a fresh link.",
  },
  invalid: {
    heading: "This link is not valid.",
    body: "It may have been copied incompletely or already used. Join the waitlist again to get a new link.",
  },
  error: {
    heading: "We could not confirm you right now.",
    body: "Something went wrong on our side. Please open the link again in a few minutes.",
  },
};

function ConfirmPage() {
  const { token } = Route.useSearch();
  const confirm = useServerFn(confirmWaitlist);
  const [outcome, setOutcome] = useState<ConfirmOutcome | null>(null);

  useEffect(() => {
    let active = true;
    if (!token) {
      setOutcome({ status: "invalid" });
      return;
    }
    confirm({ data: { token } })
      .then((result) => {
        if (active) setOutcome(result);
      })
      .catch(() => {
        if (active) setOutcome({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [confirm, token]);

  const key =
    outcome === null
      ? null
      : outcome.status === "confirmed"
        ? outcome.alreadyConfirmed
          ? "already"
          : "confirmed"
        : outcome.status;

  const text = key ? copy[key] : null;
  const success = key === "confirmed" || key === "already";

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-20">
      <Breadcrumbs />
      <section
        className="mt-8 rounded-3xl border border-border bg-card p-10"
        aria-labelledby="confirm-heading"
      >
        <p className="sr-only" role="status" aria-live="polite">
          {text ? text.heading : "Confirming your email address"}
        </p>
        {!text ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            <span>Confirming your email address</span>
          </div>
        ) : (
          <>
            {success ? (
              <CheckCircle2 className="size-8 text-accent-strong" aria-hidden="true" />
            ) : key === "expired" ? (
              <Clock className="size-8 text-muted-foreground" aria-hidden="true" />
            ) : (
              <XCircle className="size-8 text-destructive" aria-hidden="true" />
            )}
            <h1 id="confirm-heading" className="mt-4 font-display text-3xl font-semibold">
              {text.heading}
            </h1>
            <p className="mt-3 text-muted-foreground">{text.body}</p>
            <Button asChild size="lg" className="mt-8 min-h-11 rounded-xl">
              <a href={success ? "/" : "/#waitlist"}>
                {success ? "Back to VouchList" : "Join the waitlist again"}
              </a>
            </Button>
            <nav
              aria-label="What to read next"
              className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm"
            >
              {postSignupLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-accent-strong underline underline-offset-4"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </>
        )}
      </section>
    </div>
  );
}
