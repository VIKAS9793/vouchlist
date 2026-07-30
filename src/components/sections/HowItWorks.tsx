import { motion } from "motion/react";
import { Archive, MessageCircleQuestion, Search, ThumbsUp } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";

const steps = [
  {
    icon: MessageCircleQuestion,
    title: "Ask",
    copy: "A neighbour types a question in the group, exactly like they always have.",
  },
  {
    icon: ThumbsUp,
    title: "Recommend",
    copy: "Two or three people reply with someone they've actually used and trust.",
  },
  {
    icon: Archive,
    title: "Capture",
    copy: "VouchList notices the recommendation, saves the details, and files it under the right category.",
  },
  {
    icon: Search,
    title: "Retrieve",
    copy: "Months later, anyone in the community searches and gets the answer in seconds.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 border-y border-border/60 bg-mist/40 py-24">
      <div className="mx-auto w-full max-w-6xl px-6">
        <Reveal>
          <h2 className="max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Four moments. None of them feel like software.
          </h2>
        </Reveal>

        <ol className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <motion.li
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ type: "spring", stiffness: 90, damping: 20, delay: index * 0.1 }}
              className="float-card relative p-7"
            >
              <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Step {index + 1}
              </span>
              <motion.span
                className="mt-5 grid size-12 place-items-center rounded-2xl bg-accent/12 text-accent-strong"
                animate={{ y: [0, -4, 0] }}
                transition={{
                  duration: 3.4,
                  repeat: Infinity,
                  delay: index * 0.4,
                  ease: "easeInOut",
                }}
              >
                <step.icon className="size-5" strokeWidth={1.6} aria-hidden="true" />
              </motion.span>
              <h3 className="mt-5 font-display text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.copy}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
