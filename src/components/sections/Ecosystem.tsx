import { motion } from "motion/react";
import { Reveal } from "@/components/motion/Reveal";
import { DeferredVisual } from "@/components/site/DeferredVisual";

const nodes = [
  "Trusted vendors",
  "Community",
  "WhatsApp",
  "Search",
  "AI",
  "Categories",
  "Admins",
  "Privacy",
];

export function Ecosystem() {
  return (
    <section id="capabilities" className="scroll-mt-24 py-24">
      <div className="mx-auto w-full max-w-6xl px-6">
        <Reveal>
          <h2 className="max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            One quiet list, joining everything your community already uses.
          </h2>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Nothing is replaced, and everything is connected.
          </p>
        </Reveal>

        <div className="mt-16 grid items-center gap-12 lg:grid-cols-2">
          <DeferredVisual className="relative mx-auto aspect-square w-full max-w-md">
            <motion.div
              className="absolute inset-0"
              animate={{ rotate: 360 }}
              transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
            >
              {nodes.map((node, i) => {
                const angle = (i / nodes.length) * Math.PI * 2;
                const left = 50 + 42 * Math.cos(angle);
                const top = 50 + 42 * Math.sin(angle);
                return (
                  <motion.span
                    key={node}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-[var(--shadow-float)]"
                    style={{ left: `${left}%`, top: `${top}%` }}
                    animate={{ rotate: -360 }}
                    transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
                  >
                    {node}
                  </motion.span>
                );
              })}
            </motion.div>

            <svg
              className="absolute inset-0 size-full text-accent-strong/25"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              {nodes.map((node, i) => {
                const angle = (i / nodes.length) * Math.PI * 2;
                return (
                  <line
                    key={node}
                    x1="50"
                    y1="50"
                    x2={50 + 42 * Math.cos(angle)}
                    y2={50 + 42 * Math.sin(angle)}
                    stroke="currentColor"
                    strokeWidth="0.4"
                    strokeDasharray="2 2"
                  />
                );
              })}
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="0.3" />
            </svg>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-primary px-5 py-3 text-primary-foreground shadow-[var(--shadow-lift)]">
              <span className="font-display text-base font-semibold">VouchList</span>
            </div>
          </DeferredVisual>

          <div className="grid gap-5">
            {[
              {
                title: "Sits beside WhatsApp, never in front of it",
                copy: "Your group stays exactly as it is. VouchList listens only to what the community opts to share.",
              },
              {
                title: "Technology you never have to think about",
                copy: "The sorting and saving happen quietly in the background. Residents only ever see a clean answer.",
              },
              {
                title: "Admins keep the keys",
                copy: "Group admins decide what is captured, what is published, and what is removed.",
              },
            ].map((item) => (
              <Reveal key={item.title}>
                <div className="rounded-3xl border-l-2 border-accent/50 pl-6">
                  <h3 className="font-display text-xl font-semibold">{item.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                    {item.copy}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
