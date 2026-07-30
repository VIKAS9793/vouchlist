import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { relatedFor } from "@/lib/related-links";

/**
 * Onward links rendered near the foot of every indexable page. They are plain
 * anchors in the server-rendered HTML, so a crawler can walk the whole site
 * from any entry point.
 */
export function RelatedLinks({
  path,
  heading = "Keep reading",
}: {
  path: string;
  heading?: string;
}) {
  const links = relatedFor(path);
  if (links.length === 0) return null;

  return (
    <section className="border-t border-border/60 bg-mist/30">
      <div className="mx-auto w-full max-w-6xl px-6 py-16">
        <Reveal>
          <h2 className="font-display text-2xl font-semibold tracking-tight">{heading}</h2>
          <nav aria-label="Related pages" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="group flex h-full flex-col rounded-2xl border border-border/60 bg-background p-5 transition-colors hover:border-accent/50"
              >
                <span className="flex items-center gap-2 font-display text-base font-semibold">
                  {link.label}
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 text-accent-strong transition-transform group-hover:translate-x-0.5"
                  />
                </span>
                <span className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {link.blurb}
                </span>
              </Link>
            ))}
          </nav>
        </Reveal>
      </div>
    </section>
  );
}
