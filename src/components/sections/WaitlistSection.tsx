import { Reveal } from "@/components/motion/Reveal";
import { WaitlistForm } from "@/components/waitlist/WaitlistForm";

export function WaitlistSection() {
  return (
    <section id="waitlist" className="scroll-mt-24 py-24">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Bring VouchList to your society.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
            We're onboarding communities city by city, with the group admin's consent. Add your name
            and we'll walk your committee through it: no installation, no migration, no disruption.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="float-card p-8">
            <WaitlistForm />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
