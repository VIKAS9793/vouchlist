import { Check, X } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";

const without = [
  "“Guys, sorry to repeat, any good plumber?”",
  "The answer was given last March. It's 4,000 messages up.",
  "Ten minutes of scrolling, no result.",
  "Three neighbours retype the same number.",
  "Good vendors get forgotten. Bad ones come back.",
];

const withVouch = [
  "Ask once. The answer is already saved.",
  "Every recommendation kept, with who vouched for it.",
  "Search in plain language, get one clear answer.",
  "Categories sort themselves as the group talks.",
  "Trust builds up instead of fading away.",
];

export function PainSplit() {
  return (
    <section id="problem" className="scroll-mt-24 border-y border-border/60 bg-mist/40 py-24">
      <div className="mx-auto w-full max-w-6xl px-6">
        <Reveal>
          <h2 className="max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            This already happens in your group, every single week.
          </h2>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            The knowledge exists. It just has nowhere to live.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <Stagger className="float-card p-8">
            <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Without VouchList
            </p>
            <ul className="mt-6 space-y-4">
              {without.map((item) => (
                <StaggerItem
                  key={item}
                  as="li"
                  className="flex gap-3 text-base text-muted-foreground"
                >
                  <X className="mt-0.5 size-5 shrink-0 text-destructive/70" aria-hidden="true" />
                  <span>{item}</span>
                </StaggerItem>
              ))}
            </ul>
          </Stagger>

          <Stagger className="rounded-3xl border border-accent/25 bg-accent/6 p-8 shadow-[var(--shadow-float)]">
            <p className="text-xs font-semibold tracking-[0.14em] text-accent-strong uppercase">
              With VouchList
            </p>
            <ul className="mt-6 space-y-4">
              {withVouch.map((item) => (
                <StaggerItem key={item} as="li" className="flex gap-3 text-base text-foreground">
                  <Check className="mt-0.5 size-5 shrink-0 text-accent-strong" aria-hidden="true" />
                  <span>{item}</span>
                </StaggerItem>
              ))}
            </ul>
          </Stagger>
        </div>
      </div>
    </section>
  );
}
