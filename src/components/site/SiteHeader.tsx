import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { WaitlistDialog } from "@/components/waitlist/WaitlistDialog";
import { ThemeToggle } from "./ThemeToggle";
import { SiteSearch } from "./SiteSearch";
import { AuthMenu } from "./AuthMenu";

const links = [
  { to: "/features", label: "Features" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/communities", label: "Communities" },
  { to: "/trust", label: "Trust" },
  { to: "/faq", label: "FAQ" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link to="/" aria-label="VouchList home">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "text-foreground bg-secondary" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <SiteSearch />
          <ThemeToggle />
          <div className="hidden md:block">
            <AuthMenu />
          </div>
          <WaitlistDialog>
            <Button className="hidden min-h-10 rounded-xl md:inline-flex">Join waitlist</Button>
          </WaitlistDialog>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border/60 bg-background md:hidden">
          <nav aria-label="Mobile" className="mx-auto grid w-full max-w-6xl gap-1 px-6 py-4">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-base text-foreground/80 transition-colors hover:bg-secondary"
              >
                {link.label}
              </Link>
            ))}
            <WaitlistDialog>
              <Button className="mt-2 min-h-11 w-full rounded-xl">Join waitlist</Button>
            </WaitlistDialog>
            <div className="mt-1 flex">
              <AuthMenu onNavigate={() => setOpen(false)} />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
