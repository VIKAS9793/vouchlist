import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

export const OWNER_EMAIL = "vikassahani17@gmail.com";

/**
 * Short privacy and contact disclosure shown wherever we collect details.
 * Links to the full trust and privacy page, which is reachable from every page.
 */
export function PrivacyNotice({ className = "" }: { className?: string }) {
  return (
    <p
      className={`flex items-start gap-2 text-xs leading-relaxed text-muted-foreground ${className}`}
    >
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden="true" />
      <span>
        We use your details only to contact you about bringing VouchList to your community. These
        waitlist details are kept apart from the product itself: inside a group, VouchList saves the
        recommendation and nothing else from the conversation. We never sell your details and we
        never post to your groups. Read the{" "}
        <Link
          to="/trust"
          hash="privacy"
          className="text-accent-strong underline underline-offset-4"
        >
          privacy and data practices
        </Link>
        , ask for{" "}
        <Link to="/privacy/request" className="text-accent-strong underline underline-offset-4">
          a copy of your details or have them deleted
        </Link>
        , or email{" "}
        <a
          className="text-accent-strong underline underline-offset-4"
          href={`mailto:${OWNER_EMAIL}`}
        >
          {OWNER_EMAIL}
        </a>
        .
      </span>
    </p>
  );
}
