import { Reveal } from "@/components/motion/Reveal";

const measures = [
  {
    label: "Our main measure",
    value: "Resolved asks",
    copy: "A question in the group that ends with a name someone actually calls. That is the only number we build towards.",
  },
  {
    label: "Designed for",
    value: "Housing societies",
    copy: "Dense residential communities where neighbours already share recommendations in WhatsApp groups — the problem this concept is built to solve.",
  },
  {
    label: "What we will not chase",
    value: "Daily app opens",
    copy: "Nobody should have to visit VouchList. If the group gets its answer faster, we have done our job.",
  },
];

export function SuccessMeasures() {
  return (
    <section id="how-we-measure" className="scroll-mt-24 border-y border-border/60 py-24">
      <div className="mx-auto w-full max-w-6xl px-6">
        <Reveal>
          <h2 className="max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            How we will know it is working.
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            This is a demand-validation study, so we will not quote numbers we have not earned. Here
            is what we would measure, and what we would deliberately ignore.
          </p>
        </Reveal>

        <ul className="mt-14 grid list-none gap-6 md:grid-cols-3">
          {measures.map((m, i) => (
            <li key={m.value}>
              <Reveal delay={i * 0.08}>
                <div className="float-card h-full p-7">
                  <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    {m.label}
                  </p>
                  <div className="mt-4">
                    <p className="font-display text-2xl font-semibold">{m.value}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.copy}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
