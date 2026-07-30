import { ArrowDown } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";

const traditional = ["Internet", "Strangers", "Adverts", "Answers for everyone"];
const vouchlist = ["Your group", "Neighbours", "Real experiences", "People they trust"];

export function USP() {
  return (
    <section
      id="why-vouchlist"
      className="scroll-mt-24 bg-ink py-24 text-background dark:bg-mist/30 dark:text-foreground"
    >
      <div className="mx-auto w-full max-w-6xl px-6">
        <Reveal>
          <h2 className="max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            The first shared memory built for WhatsApp groups.
          </h2>
          <p className="mt-4 max-w-xl text-lg opacity-70">
            Search engines answer the world. VouchList answers your street.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          <Ladder title="Searching online" items={traditional} muted />
          <Ladder title="VouchList" items={vouchlist} />
        </div>
      </div>
    </section>
  );
}

function Ladder({ title, items, muted }: { title: string; items: string[]; muted?: boolean }) {
  return (
    <Reveal>
      <div
        className={`rounded-3xl border p-8 ${
          muted ? "border-background/15 dark:border-border" : "border-accent/40 bg-accent/6"
        }`}
      >
        <p
          className={`text-xs font-semibold tracking-[0.14em] uppercase ${
            muted ? "opacity-60" : "text-accent"
          }`}
        >
          {title}
        </p>
        <ol className="mt-6 space-y-1">
          {items.map((item, i) => (
            <li key={item}>
              <p className={`font-display text-2xl font-semibold ${muted ? "opacity-70" : ""}`}>
                {item}
              </p>
              {i < items.length - 1 ? (
                <ArrowDown
                  className={`my-2 size-4 ${muted ? "opacity-40" : "text-accent"}`}
                  aria-hidden="true"
                />
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </Reveal>
  );
}
