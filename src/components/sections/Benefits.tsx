import { BrainCircuit, Clock, Compass } from "lucide-react";
import { Stagger, StaggerItem, Reveal } from "@/components/motion/Reveal";

const benefits = [
  {
    icon: Clock,
    title: "Save time",
    line: "Never ask twice.",
    copy: "The answer your community found once stays found. No scrolling, no re-asking, no waiting for someone to be online.",
  },
  {
    icon: BrainCircuit,
    title: "Build a shared memory",
    line: "The list keeps growing.",
    copy: "Every conversation adds to a shared list that gets more useful each month, and stays put when families move out.",
  },
  {
    icon: Compass,
    title: "Make better decisions",
    line: "Trust your neighbours.",
    copy: "A recommendation from the family two floors up beats a paid listing from a stranger. Every time.",
  },
];

export function Benefits() {
  return (
    <section id="benefits" className="scroll-mt-24 border-y border-border/60 bg-mist/40 py-24">
      <div className="mx-auto w-full max-w-6xl px-6">
        <Reveal>
          <h2 className="max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            What changes for the people who live there.
          </h2>
        </Reveal>

        <Stagger className="mt-14 grid gap-6 lg:grid-cols-3" gap={0.1}>
          {benefits.map((benefit) => (
            <StaggerItem key={benefit.title}>
              <article className="float-card h-full p-8 transition-shadow duration-300 hover:shadow-[var(--shadow-lift)]">
                <benefit.icon
                  className="size-6 text-accent-strong"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <h3 className="mt-6 font-display text-2xl font-semibold">{benefit.title}</h3>
                <p className="mt-2 text-base font-medium text-accent-strong">{benefit.line}</p>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  {benefit.copy}
                </p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
