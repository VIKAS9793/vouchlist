import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BadgeCheck, Search, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

const steps = [
  { key: "ask", label: "Someone asks" },
  { key: "recommend", label: "Neighbours reply" },
  { key: "capture", label: "VouchList captures" },
  { key: "retrieve", label: "Months later" },
] as const;

export function ConversationDemo({ showFlowLink = false }: { showFlowLink?: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => (s + 1) % steps.length), 3200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-accent/6 blur-2xl"
      />
      <div className="float-card overflow-hidden shadow-[var(--shadow-lift)]">
        <div className="flex items-center justify-between border-b border-border bg-mist/60 px-5 py-3">
          <p className="text-sm font-medium">Green Meadows · Tower C</p>
          <span className="text-xs text-muted-foreground">248 members</span>
        </div>

        <div className="min-h-[22rem] space-y-3 p-5">
          <Bubble side="left" name="Priya">
            Any good electrician? Our lobby lights keep tripping 😩
          </Bubble>

          <AnimatePresence>
            {step >= 1 && (
              <Bubble side="right" name="Rahul" key="rec">
                Call Suresh. The 4th floor uses him. Fixed our wiring in a day, fair rates.
              </Bubble>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {step >= 2 && (
              <motion.div
                key="card"
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 110, damping: 18 }}
                className="rounded-2xl border border-accent/30 bg-accent/8 p-4"
              >
                <p className="flex items-center gap-2 text-xs font-medium text-accent-strong">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  Saved to your community list
                </p>
                <p className="mt-2 font-display text-base font-semibold">Suresh · Electrician</p>
                <p className="text-sm text-muted-foreground">
                  Vouched by Rahul · Tower C · Category: Home repair
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {step >= 3 && (
              <motion.div
                key="search"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 110, damping: 18 }}
                className="space-y-3 rounded-2xl border border-border bg-background p-4"
              >
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Search className="size-4" aria-hidden="true" />
                  “electrician”
                </p>
                <div className="flex items-center gap-2 rounded-xl bg-mist/70 px-3 py-2 text-sm">
                  <BadgeCheck className="size-4 text-success" aria-hidden="true" />
                  Suresh, vouched by 3 neighbours
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 border-t border-border bg-mist/50 px-5 py-3">
          {steps.map((s, i) => (
            <span
              key={s.key}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                i <= step ? "bg-accent" : "bg-border"
              }`}
            />
          ))}
          <span className="ml-3 w-28 shrink-0 text-right text-xs text-muted-foreground">
            {steps[step].label}
          </span>
        </div>
      </div>

      {showFlowLink ? (
        <p className="mt-4 text-center text-sm">
          <Link
            to="/how-it-works"
            className="inline-flex items-center gap-1.5 font-medium text-accent-strong underline underline-offset-4"
          >
            See the full flow, step by step
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function Bubble({
  side,
  name,
  children,
}: {
  side: "left" | "right";
  name: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 110, damping: 18 }}
      className={side === "right" ? "flex justify-end" : "flex justify-start"}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          side === "right"
            ? "rounded-br-md bg-success/20 text-foreground"
            : "rounded-bl-md bg-mist text-foreground"
        }`}
      >
        <p className="mb-1 text-xs font-medium text-muted-foreground">{name}</p>
        {children}
      </div>
    </motion.div>
  );
}
