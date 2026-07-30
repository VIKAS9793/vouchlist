import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, MailCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { RelatedLinks } from "@/components/site/RelatedLinks";
import { SITE_ORIGIN } from "@/lib/site";
import { breadcrumbScript, trailFor } from "@/lib/breadcrumbs";
import { pageGraphScript } from "@/lib/structured-data";
import { requestPrivacyAction } from "@/lib/privacy.functions";
import ogImage from "@/assets/og-trust.jpg.asset.json";

const title = "Get a copy of your details or have them deleted";
const description =
  "Ask VouchList for a copy of your waitlist details, or have them deleted. No account needed: we send a one time link to your email address.";

export const Route = createFileRoute("/privacy/request")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_ORIGIN}/privacy/request` },
      { property: "og:image", content: `${SITE_ORIGIN}${ogImage.url}` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: title },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE_ORIGIN}${ogImage.url}` },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/privacy/request` }],
    scripts: [
      breadcrumbScript(SITE_ORIGIN, trailFor("/privacy/request")),
      pageGraphScript({
        path: "/privacy/request",
        title,
        description,
        image: `${SITE_ORIGIN}${ogImage.url}`,
      }),
    ],
  }),
  component: PrivacyRequestPage,
});

type Kind = "export" | "delete";

function PrivacyRequestPage() {
  const submit = useServerFn(requestPrivacyAction);
  const [kind, setKind] = useState<Kind>("export");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  // Until React has taken over the form, a click would submit it the plain
  // browser way and lose the request, so the button waits for hydration.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setState("sending");
    try {
      const result = await submit({ data: { email, kind, website } });
      if (result.ok) {
        setState("sent");
      } else {
        setError(result.message);
        setState("idle");
        document.getElementById("privacy-email")?.focus();
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setState("idle");
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-20">
      <Breadcrumbs />
      <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        Your details, your call
      </h1>
      <p className="mt-4 text-muted-foreground">
        You do not need an account. Tell us the email address you used on the waitlist and we will
        send a link to that address. Opening the link is how we know it is really you. The link
        works once and expires after a day.
      </p>

      {state === "sent" ? (
        <div
          className="mt-10 rounded-3xl border border-border bg-card p-8"
          role="status"
          aria-live="polite"
        >
          <MailCheck className="size-8 text-accent-strong" aria-hidden="true" />
          <h2 className="mt-4 font-display text-2xl font-semibold">Check your inbox</h2>
          <p className="mt-3 text-muted-foreground">
            If that address is on our waitlist, a confirmation link is on its way. We answer the
            same way either way, so nobody can use this form to find out who signed up.
          </p>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="mt-10 rounded-3xl border border-border bg-card p-8"
          noValidate
        >
          <fieldset>
            <legend className="text-sm font-semibold">What would you like us to do?</legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    value: "export",
                    label: "Send me a copy",
                    icon: Download,
                    hint: "Everything we hold about you.",
                  },
                  {
                    value: "delete",
                    label: "Delete my details",
                    icon: Trash2,
                    hint: "Removed from the waitlist for good.",
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer gap-3 rounded-2xl border p-4 text-sm transition-colors ${
                    kind === option.value ? "border-accent-strong bg-accent/10" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={option.value}
                    checked={kind === option.value}
                    onChange={() => setKind(option.value)}
                    className="mt-1 size-4 accent-[var(--accent-strong)]"
                  />
                  <span>
                    <span className="flex items-center gap-2 font-semibold">
                      <option.icon className="size-4" aria-hidden="true" />
                      {option.label}
                    </span>
                    <span className="mt-1 block text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-6">
            <Label htmlFor="privacy-email">Your email address</Label>
            <Input
              id="privacy-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "privacy-email-error" : "privacy-email-hint"}
              className="mt-2 min-h-11"
            />
            <p id="privacy-email-hint" className="mt-2 text-xs text-muted-foreground">
              Use the same address you signed up with.
            </p>
            {error ? (
              <p id="privacy-email-error" role="alert" className="mt-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="privacy-website">Leave this empty</label>
            <input
              id="privacy-website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={!ready || state === "sending"}
            className="mt-8 min-h-11 rounded-xl"
          >
            {state === "sending" ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Sending the link
              </>
            ) : (
              "Send me the link"
            )}
          </Button>
        </form>
      )}
      <RelatedLinks path="/privacy/request" heading="Where to go next" />
    </div>
  );
}
