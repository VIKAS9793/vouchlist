import { useState } from "react";
import { Loader2 } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { cn } from "@/lib/utils";

/** Google's mark, inline so the button paints without a network round trip. */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false" className={className}>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export type GoogleSignInButtonProps = {
  /** Same-origin path to land on once the session exists. */
  redirectTo?: string;
  className?: string;
  label?: string;
};

/** Key the destination is parked under while the browser is at Google. */
export const POST_SIGN_IN_KEY = "vouchlist:post-sign-in";

export function GoogleSignInButton({
  redirectTo = "/account",
  className,
  label = "Continue with Google",
}: GoogleSignInButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      // Google must return to a public page. Parking the real destination
      // here keeps it out of the redirect URL, which cannot point at a page
      // that is itself behind the sign-in check.
      window.sessionStorage.setItem(POST_SIGN_IN_KEY, redirectTo);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth`,
      });
      if (result.redirected) return;
      if (result.error) {
        setError("Google sign-in did not complete. Please try again.");
        setBusy(false);
        return;
      }
      // Signed in without leaving the page: the session is set, so move on.
      window.location.assign(redirectTo);
    } catch {
      setError("Google sign-in did not complete. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className={cn("w-full", className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-busy={busy}
        className="inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-xl border border-input bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
      >
        {busy ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <GoogleMark className="size-[18px]" />
        )}
        {busy ? "Opening Google" : label}
      </button>
      <p role="alert" aria-live="polite" className="mt-3 min-h-5 text-sm text-destructive">
        {error}
      </p>
    </div>
  );
}
