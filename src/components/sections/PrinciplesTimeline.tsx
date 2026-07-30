import { motion } from "motion/react";
import { Reveal } from "@/components/motion/Reveal";

const stages = [
  { title: "Capture", copy: "A recommendation is spoken." },
  { title: "Organise", copy: "It gets saved and sorted." },
  { title: "Verify", copy: "Neighbours confirm it." },
  { title: "Search", copy: "Someone needs it." },
  { title: "Reuse", copy: "It saves them an hour." },
  { title: "Grow", copy: "The list gets stronger." },
];

export function PrinciplesTimeline() {
  return (
    <section id="principles" className="scroll-mt-24 py-24">
      <div className="mx-auto w-full max-w-6xl px-6">
        <Reveal>
          <h2 className="max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Every recommendation goes through the same six steps.
          </h2>
        </Reveal>

        <div
          className="mt-16 overflow-x-auto pb-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          tabIndex={0}
          role="group"
          aria-label="The six steps a recommendation goes through, scroll sideways"
        >
          <ol className="relative flex min-w-[52rem] items-start gap-6">
            <span className="absolute top-3 right-4 left-4 h-px bg-border" aria-hidden="true" />
            {stages.map((stage, index) => (
              <motion.li
                key={stage.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ type: "spring", stiffness: 100, damping: 20, delay: index * 0.09 }}
                className="relative flex-1"
              >
                <span className="relative z-10 block size-6 rounded-full border-4 border-background bg-accent" />
                <h3 className="mt-5 font-display text-lg font-semibold">{stage.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{stage.copy}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
