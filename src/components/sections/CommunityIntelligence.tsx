import { motion } from "motion/react";
import { Reveal } from "@/components/motion/Reveal";
import { DeferredVisual } from "@/components/site/DeferredVisual";

export function CommunityIntelligence() {
  return (
    <section
      id="community-intelligence"
      className="scroll-mt-24 border-y border-border/60 bg-mist/40 py-24"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-14 px-6 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Today the answers vanish. Tomorrow they add up.
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
            An active society group shares genuinely useful recommendations every week, and most of
            them are buried within days. With VouchList, the same conversations build a list that
            keeps getting more valuable, long after the people who started it have moved on.
          </p>
          <dl className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Without a saved list</dt>
              <dd className="mt-1 font-display text-2xl font-semibold">Flat forever</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">With VouchList</dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-accent-strong">
                Grows every week
              </dd>
            </div>
          </dl>
        </Reveal>

        <Reveal>
          <div className="float-card p-8">
            <DeferredVisual className="aspect-[320/200] w-full">
              <svg
                viewBox="0 0 320 200"
                className="w-full"
                role="img"
                aria-label="Chart comparing a group with no saved list, which stays flat, against a VouchList group, where saved answers keep adding up"
              >
                <line
                  x1="24"
                  y1="176"
                  x2="304"
                  y2="176"
                  stroke="var(--color-border)"
                  strokeWidth="1"
                />
                <line
                  x1="24"
                  y1="16"
                  x2="24"
                  y2="176"
                  stroke="var(--color-border)"
                  strokeWidth="1"
                />
                <motion.path
                  d="M24 168 L304 162"
                  fill="none"
                  stroke="var(--color-muted-foreground)"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
                <motion.path
                  d="M24 168 C 110 165, 175 130, 220 92 S 285 34, 304 24"
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.6, ease: "easeOut", delay: 0.2 }}
                />
                {[
                  [110, 158],
                  [175, 128],
                  [220, 92],
                  [268, 52],
                  [304, 26],
                ].map(([cx, cy], i) => (
                  <motion.circle
                    key={`${cx}-${cy}`}
                    cx={cx}
                    cy={cy}
                    r="4"
                    fill="var(--color-accent)"
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      delay: 0.6 + i * 0.16,
                      type: "spring",
                      stiffness: 200,
                      damping: 14,
                    }}
                  />
                ))}
              </svg>
            </DeferredVisual>
            <p className="mt-6 text-sm text-muted-foreground">
              Recommendations retained over time, one community.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
