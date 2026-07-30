import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Home,
  Compass,
  Route as RouteIcon,
  Users,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";

const sections = [
  {
    to: "/features",
    label: "Features",
    description: "What VouchList adds to your community group.",
    icon: Compass,
  },
  {
    to: "/how-it-works",
    label: "How it works",
    description: "From a WhatsApp ask to a saved recommendation.",
    icon: RouteIcon,
  },
  {
    to: "/communities",
    label: "Communities",
    description: "Built for residential societies and committees.",
    icon: Users,
  },
  {
    to: "/trust",
    label: "Trust and privacy",
    description: "You opt in, your admins check it, and there are no ads.",
    icon: ShieldCheck,
  },
  {
    to: "/faq",
    label: "FAQ",
    description: "Answers to the questions committees ask first.",
    icon: HelpCircle,
  },
] as const;

export function NotFound() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-20 md:py-28">
      <div className="max-w-2xl">
        <p className="font-mono text-sm font-medium tracking-widest text-primary uppercase">
          Error 404
        </p>
        <h1 className="mt-4 font-display text-4xl leading-tight font-bold tracking-tight text-foreground md:text-5xl">
          We could not find that page
        </h1>
        <p className="mt-4 text-base text-muted-foreground md:text-lg">
          The link may be out of date or the address may have a typo. Everything on VouchList is
          still one step away.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Home className="size-4" aria-hidden="true" />
            Back to home
          </Link>
          <Link
            to="/how-it-works"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            See how it works
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <nav aria-label="Main sections" className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            className="group float-card rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/40"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-secondary text-primary">
              <section.icon className="size-4" aria-hidden="true" />
            </span>
            <span className="mt-4 flex items-center gap-2 text-base font-semibold text-foreground">
              {section.label}
              <ArrowRight
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">{section.description}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}
