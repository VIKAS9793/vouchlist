import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Download, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { completePrivacyRequest } from "@/lib/privacy.functions";
import type { PrivacyOutcome } from "@/lib/privacy-request.server";

const title = "Confirm your VouchList data request";
const description =
  "Open this one time link to finish your request for a copy of your VouchList waitlist details, or to have them deleted.";

export const Route = createFileRoute("/privacy/verify")({
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
  component: PrivacyVerifyPage,
});

function PrivacyVerifyPage() {
  const { token } = Route.useSearch();
  const complete = useServerFn(completePrivacyRequest);
  const [outcome, setOutcome] = useState<PrivacyOutcome | null>(null);

  useEffect(() => {
    let active = true;
    if (!token) {
      setOutcome({ status: "invalid" });
      return;
    }
    complete({ data: { token } })
      .then((result) => {
        if (active) setOutcome(result);
      })
      .catch(() => {
        if (active) setOutcome({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [complete, token]);

  const heading = outcome ? headingFor(outcome) : "Checking your link";
  const success = outcome?.status === "exported" || outcome?.status === "deleted";

  function download() {
    if (outcome?.status !== "exported") return;
    const blob = new Blob([JSON.stringify(outcome.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vouchlist-waitlist-details.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-20">
      <Breadcrumbs />
      <section
        className="mt-8 rounded-3xl border border-border bg-card p-10"
        aria-labelledby="privacy-verify-heading"
      >
        <p className="sr-only" role="status" aria-live="polite">
          {heading}
        </p>
        {!outcome ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            <span>Checking your link</span>
          </div>
        ) : (
          <>
            {success ? (
              <CheckCircle2 className="size-8 text-accent-strong" aria-hidden="true" />
            ) : outcome.status === "expired" ? (
              <Clock className="size-8 text-muted-foreground" aria-hidden="true" />
            ) : (
              <XCircle className="size-8 text-destructive" aria-hidden="true" />
            )}
            <h1 id="privacy-verify-heading" className="mt-4 font-display text-3xl font-semibold">
              {heading}
            </h1>
            <p className="mt-3 text-muted-foreground">{bodyFor(outcome)}</p>

            {outcome.status === "exported" ? (
              <>
                <dl className="mt-6 grid gap-3 rounded-2xl border border-border p-6 text-sm sm:grid-cols-2">
                  {Object.entries({
                    Name: outcome.data.name,
                    Email: outcome.data.email,
                    Community: outcome.data.community ?? "Not shared",
                    City: outcome.data.city ?? "Not shared",
                    Role: outcome.data.role ?? "Not shared",
                    Status: outcome.data.status,
                    "Joined on": new Date(outcome.data.joinedAt).toLocaleDateString(),
                    "Confirmed on": outcome.data.confirmedAt
                      ? new Date(outcome.data.confirmedAt).toLocaleDateString()
                      : "Not confirmed yet",
                  }).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
                <Button onClick={download} size="lg" className="mt-6 min-h-11 rounded-xl">
                  <Download className="size-4" aria-hidden="true" />
                  Download as a file
                </Button>
              </>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                variant={outcome.status === "exported" ? "outline" : "default"}
                size="lg"
                className="min-h-11 rounded-xl"
              >
                <a href="/">Back to VouchList</a>
              </Button>
              {success ? null : (
                <Button asChild variant="outline" size="lg" className="min-h-11 rounded-xl">
                  <a href="/privacy/request">Start a new request</a>
                </Button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function headingFor(outcome: PrivacyOutcome) {
  switch (outcome.status) {
    case "exported":
      return "Here is everything we hold about you.";
    case "deleted":
      return "Your details are deleted.";
    case "not_found":
      return "We hold nothing for that address.";
    case "expired":
      return "This link has expired.";
    case "invalid":
      return "This link is not valid.";
    default:
      return "We could not finish this request.";
  }
}

function bodyFor(outcome: PrivacyOutcome) {
  switch (outcome.status) {
    case "exported":
      return "This is the full waitlist record for your email address. You can download it as a file to keep.";
    case "deleted":
      return `We removed the waitlist entry for ${outcome.email}. Nothing about that address remains on the waitlist.`;
    case "not_found":
      return "There is no waitlist entry for that email address, so there is nothing to send or delete.";
    case "expired":
      return "Links stay valid for one day. Start a new request and we will send a fresh one.";
    case "invalid":
      return "It may have been copied incompletely, or it was already used. Start a new request to get a fresh link.";
    default:
      return "Something went wrong on our side. Please open the link again in a few minutes.";
  }
}
