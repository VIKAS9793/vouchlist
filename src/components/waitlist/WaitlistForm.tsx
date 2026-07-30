import { useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrivacyNotice } from "@/components/site/PrivacyNotice";
import { hashEmail, trackWaitlistConversion } from "@/lib/analytics";
import { postSignupLinks } from "@/lib/related-links";
import { joinWaitlist, waitlistSchema, type WaitlistInput } from "./waitlist";

const roles = [
  "Resident",
  "Apartment committee member",
  "Society admin",
  "WhatsApp group admin",
  "Parent group organiser",
  "Just curious",
];

const empty: WaitlistInput = { name: "", email: "", community: "", city: "", role: "" };

/** Field order, used to move focus to the first field that failed validation. */
const fieldOrder: (keyof WaitlistInput)[] = ["name", "email", "community", "city", "role"];

export function WaitlistForm({ compact = false }: { compact?: boolean }) {
  const [values, setValues] = useState<WaitlistInput>(empty);
  // Anti-bot: an off-screen field real people never fill, plus how long the
  // form was on screen. Both are verified again on the server.
  const [website, setWebsite] = useState("");
  const mountedAt = useRef(Date.now());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;
  const errorId = (name: string) => `${uid}-${name}-error`;
  const hintId = (name: string) => `${uid}-${name}-hint`;
  const formRef = useRef<HTMLFormElement>(null);
  const errorSummaryRef = useRef<HTMLParagraphElement>(null);

  /** Moves keyboard focus to the first invalid control so it is announced. */
  function focusFirstError(next: Record<string, string>) {
    const first = fieldOrder.find((key) => next[key]);
    if (!first) return;
    const control = formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(fieldId(first))}`);
    control?.focus();
  }

  function update(key: keyof WaitlistInput, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = waitlistSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      setStatus("idle");
      setMessage("");
      focusFirstError(next);
      return;
    }
    setErrors({});
    setStatus("loading");
    const result = await joinWaitlist(parsed.data, {
      website,
      elapsedMs: Date.now() - mountedAt.current,
    });
    if (!result.ok) {
      setStatus("error");
      setMessage(result.message);
      // Send focus to the rejection message: spam blocks and rate limits give
      // no field-level cue, so a screen reader user needs to land on it.
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    setStatus("done");
    // Conversion: server confirmed the signup, so report it with the metadata
    // that was actually submitted (no raw email leaves the browser).
    trackWaitlistConversion({
      eventId: result.eventId,
      duplicate: result.duplicate,
      city: parsed.data.city || undefined,
      role: parsed.data.role || undefined,
      community: parsed.data.community || undefined,
      emailHash: await hashEmail(parsed.data.email),
      formLocation: compact ? "waitlist_dialog" : window.location.pathname,
    });
    setMessage(
      result.pending
        ? result.duplicate
          ? "You are already on the list and still need to confirm. Open the confirmation link we emailed you."
          : "Check your inbox and click the confirmation link. Your place is held once you confirm."
        : "You're already confirmed. We'll reach out when your city opens up.",
    );
  }

  if (status === "done") {
    return (
      <div
        className="flex flex-col items-start gap-3 rounded-3xl border border-accent/30 bg-accent/8 p-8"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="size-7 text-accent-strong" aria-hidden="true" />
        <p className="font-display text-xl font-semibold">Welcome to the neighbourhood.</p>
        <p className="text-sm text-muted-foreground">{message}</p>
        <nav aria-label="What to read next" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
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
        <PrivacyNotice />
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="grid gap-5"
      noValidate
      aria-busy={status === "loading"}
      aria-labelledby={`${uid}-form-label`}
    >
      <p id={`${uid}-form-label`} className="sr-only">
        Join the VouchList waitlist
      </p>
      {/* Progress and rejection announcements for assistive technology. */}
      <p className="sr-only" role="status" aria-live="polite">
        {status === "loading" ? "Submitting your waitlist request" : ""}
      </p>
      <div
        aria-hidden="true"
        className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden"
      >
        <label htmlFor={fieldId("website")}>Leave this field empty</label>
        <input
          id={fieldId("website")}
          name="website"
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <div className={compact ? "grid gap-5" : "grid gap-5 sm:grid-cols-2"}>
        <Field
          id={fieldId("name")}
          label="Your name"
          error={errors.name}
          errorId={errorId("name")}
          hintId={hintId("name")}
          hint="Use the name your neighbours know you by."
          required
        >
          <Input
            id={fieldId("name")}
            value={values.name}
            autoComplete="name"
            required
            aria-required="true"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={`${hintId("name")}${errors.name ? ` ${errorId("name")}` : ""}`}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Your full name"
          />
        </Field>
        <Field
          id={fieldId("email")}
          label="Email"
          error={errors.email}
          errorId={errorId("email")}
          hintId={hintId("email")}
          hint="We only email when your community can be onboarded."
          required
        >
          <Input
            id={fieldId("email")}
            type="email"
            value={values.email}
            autoComplete="email"
            required
            aria-required="true"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={`${hintId("email")}${errors.email ? ` ${errorId("email")}` : ""}`}
            onChange={(e) => update("email", e.target.value)}
            placeholder="Your email address"
          />
        </Field>
        <Field
          id={fieldId("community")}
          label="Community or society"
          error={errors.community}
          errorId={errorId("community")}
          hintId={hintId("community")}
          hint="Optional. The group or society you would use VouchList with."
        >
          <Input
            id={fieldId("community")}
            value={values.community}
            aria-invalid={errors.community ? true : undefined}
            aria-describedby={`${hintId("community")}${errors.community ? ` ${errorId("community")}` : ""}`}
            onChange={(e) => update("community", e.target.value)}
            placeholder="Your society or group name"
          />
        </Field>
        <Field
          id={fieldId("city")}
          label="City"
          error={errors.city}
          errorId={errorId("city")}
          hintId={hintId("city")}
          hint="Optional. Helps us decide which city opens next."
        >
          <Input
            id={fieldId("city")}
            value={values.city}
            aria-invalid={errors.city ? true : undefined}
            aria-describedby={`${hintId("city")}${errors.city ? ` ${errorId("city")}` : ""}`}
            onChange={(e) => update("city", e.target.value)}
            placeholder="Mumbai"
          />
        </Field>
      </div>

      <Field
        id={fieldId("role")}
        label="I am a"
        error={errors.role}
        errorId={errorId("role")}
        hintId={hintId("role")}
        hint="Optional. Use the arrow keys to choose an option."
      >
        <select
          id={fieldId("role")}
          value={values.role}
          aria-invalid={errors.role ? true : undefined}
          aria-describedby={`${hintId("role")}${errors.role ? ` ${errorId("role")}` : ""}`}
          onChange={(e) => update("role", e.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Select one (optional)</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </Field>

      {status === "error" ? (
        <p
          ref={errorSummaryRef}
          tabIndex={-1}
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring"
          role="alert"
        >
          <span className="sr-only">Submission blocked: </span>
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="submit"
          size="lg"
          className="min-h-11 rounded-xl"
          disabled={status === "loading"}
        >
          {status === "loading" ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Joining
            </>
          ) : (
            "Join the waitlist"
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          No spam. No new app. We only email when your community can be onboarded.
        </p>
      </div>
      <PrivacyNotice />
    </form>
  );
}

function Field({
  id,
  label,
  error,
  errorId,
  hint,
  hintId,
  required = false,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  errorId: string;
  hint: string;
  hintId: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            {" *"}
          </span>
        ) : (
          <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
        )}
      </Label>
      {children}
      <span id={hintId} className="text-xs text-muted-foreground">
        {hint}
      </span>
      {error ? (
        <span id={errorId} className="text-xs text-destructive" role="alert">
          <span className="sr-only">Error: </span>
          {error}
        </span>
      ) : null}
    </div>
  );
}
