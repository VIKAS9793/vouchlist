import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { OWNER_EMAIL } from "./PrivacyNotice";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-mist/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-sm text-muted-foreground">
            The trusted shared list for WhatsApp communities. Built with consent, kept in your
            neighbourhood.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Owned and built by Vikas Dayashankar Sahani.
          </p>
          <p className="mt-2 text-sm">
            <a
              className="text-accent-strong underline underline-offset-4"
              href="mailto:vikassahani17@gmail.com"
            >
              vikassahani17@gmail.com
            </a>
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link to="/features" className="text-muted-foreground hover:text-foreground">
            Features
          </Link>
          <Link to="/how-it-works" className="text-muted-foreground hover:text-foreground">
            How it works
          </Link>
          <Link to="/communities" className="text-muted-foreground hover:text-foreground">
            Communities
          </Link>
          <Link to="/trust" className="text-muted-foreground hover:text-foreground">
            Trust &amp; privacy
          </Link>
          <Link to="/trust" hash="privacy" className="text-muted-foreground hover:text-foreground">
            Privacy &amp; data
          </Link>
          <a href={`mailto:${OWNER_EMAIL}`} className="text-muted-foreground hover:text-foreground">
            Contact
          </a>
          <Link to="/faq" className="text-muted-foreground hover:text-foreground">
            FAQ
          </Link>
        </nav>
      </div>
      <div className="mx-auto w-full max-w-6xl space-y-3 px-6 pb-10 text-xs text-muted-foreground">
        <p className="max-w-3xl">
          Privacy: we collect only the waitlist details you choose to share, and we use them solely
          to contact you about onboarding your community. We do not sell data and we do not run ads.
          For questions, corrections or deletion requests, email{" "}
          <a
            className="text-accent-strong underline underline-offset-4"
            href={`mailto:${OWNER_EMAIL}`}
          >
            {OWNER_EMAIL}
          </a>{" "}
          or read the{" "}
          <Link
            to="/trust"
            hash="privacy"
            className="text-accent-strong underline underline-offset-4"
          >
            full privacy and data practices
          </Link>
          .
        </p>
        <p>
          © 2026 Vikas Dayashankar Sahani. VouchList is an independent product, not affiliated with
          WhatsApp or Meta.
        </p>
      </div>
    </footer>
  );
}
