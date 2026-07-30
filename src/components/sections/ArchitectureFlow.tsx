import { motion } from "motion/react";
import { Reveal } from "@/components/motion/Reveal";

const layers = [
  { title: "WhatsApp groups", copy: "Where the conversation already happens." },
  { title: "Spot the question", copy: "It notices a real ask and ignores the chatter." },
  { title: "Save the reply", copy: "Who was recommended, and who vouched for them." },
  { title: "Tidy the details", copy: "Name, service, phone number and context, kept neatly." },
  { title: "File it away", copy: "Sorted the way neighbours actually think." },
  { title: "Simple search", copy: "Ask in everyday words, get one clear answer." },
  { title: "Who trusts whom", copy: "You can see which neighbours stand behind each name." },
  { title: "Ready later", copy: "Useful next week, next year, next resident." },
];

export function ArchitectureFlow() {
  return (
    <section id="architecture" className="scroll-mt-24 py-24">
      <div className="mx-auto w-full max-w-5xl px-6">
        <Reveal>
          <h2 className="max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            From a message that scrolls away to a list your community keeps.
          </h2>
        </Reveal>

        <ol className="mt-14 space-y-2">
          {layers.map((layer, index) => (
            <motion.li
              key={layer.title}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ type: "spring", stiffness: 100, damping: 20, delay: index * 0.06 }}
              className="relative flex items-start gap-5 rounded-2xl px-4 py-4 transition-colors hover:bg-mist/60"
            >
              <div className="flex flex-col items-center self-stretch">
                <span className="mt-1.5 size-2.5 rounded-full bg-accent" aria-hidden="true" />
                {index < layers.length - 1 ? (
                  <span className="mt-1 w-px flex-1 bg-border" aria-hidden="true" />
                ) : null}
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">{layer.title}</h3>
                <p className="text-sm text-muted-foreground">{layer.copy}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
