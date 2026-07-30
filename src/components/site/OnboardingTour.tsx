import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Compass, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  trackTourComplete,
  trackTourSkip,
  trackTourStart,
  trackTourStepComplete,
  type TourEventContext,
} from "@/lib/analytics";
import { hasSeenTour, markTourSeen, tourSteps } from "@/lib/onboarding-tour";

/**
 * A short guided tour of the homepage. Every transition is instrumented so the
 * start, per-step completion and drop-off can be read as one funnel.
 */
export function OnboardingTour() {
  const [phase, setPhase] = useState<"hidden" | "nudge" | "running">("hidden");
  const [index, setIndex] = useState(0);
  const run = useRef<{ id: string; trigger: string; startedAt: number } | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);

  // Offer the tour to first-time visitors only, after hydration.
  useEffect(() => {
    if (!hasSeenTour()) setPhase("nudge");
  }, []);

  const context = useCallback(
    (extra: Partial<TourEventContext> = {}): TourEventContext => ({
      tourId: run.current?.id ?? "unknown",
      trigger: run.current?.trigger ?? "manual",
      totalSteps: tourSteps.length,
      elapsedMs: run.current ? Date.now() - run.current.startedAt : undefined,
      ...extra,
    }),
    [],
  );

  const scrollTo = useCallback((anchor: string) => {
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const start = useCallback(
    (trigger: string) => {
      run.current = { id: crypto.randomUUID(), trigger, startedAt: Date.now() };
      setIndex(0);
      setPhase("running");
      markTourSeen();
      trackTourStart(context({ trigger }));
      scrollTo(tourSteps[0].anchor);
    },
    [context, scrollTo],
  );

  const next = useCallback(() => {
    const step = tourSteps[index];
    trackTourStepComplete(context({ stepIndex: index, stepId: step.id }));

    if (index === tourSteps.length - 1) {
      trackTourComplete(context({ stepIndex: index, stepId: step.id }));
      setPhase("hidden");
      return;
    }
    const upcoming = tourSteps[index + 1];
    setIndex(index + 1);
    scrollTo(upcoming.anchor);
  }, [context, index, scrollTo]);

  const skip = useCallback(() => {
    const step = tourSteps[index];
    // stepIndex here is how many steps were finished, so drop-off is exact.
    trackTourSkip(context({ stepIndex: index, stepId: step.id }));
    markTourSeen();
    setPhase("hidden");
  }, [context, index]);

  // Escape leaves the tour the same way the skip button does.
  useEffect(() => {
    if (phase !== "running") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, skip]);

  useEffect(() => {
    if (phase === "running") panel.current?.focus();
  }, [phase, index]);

  if (phase === "hidden") return null;

  if (phase === "nudge") {
    return (
      <div className="fixed bottom-6 left-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <Compass className="mt-0.5 size-5 text-accent-strong" aria-hidden="true" />
          <div>
            <p className="font-medium">New here? Take the two minute tour.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Four short steps covering the problem, how it works and how to bring it to your
              community.
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button className="min-h-10 rounded-xl" onClick={() => start("manual")}>
            Start the tour
          </Button>
          <Button
            variant="ghost"
            className="min-h-10 rounded-xl"
            onClick={() => {
              markTourSeen();
              setPhase("hidden");
            }}
          >
            Not now
          </Button>
        </div>
      </div>
    );
  }

  const step = tourSteps[index];
  const last = index === tourSteps.length - 1;

  return (
    <div
      ref={panel}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
      className="fixed bottom-6 left-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-border bg-card p-5 shadow-lg outline-none"
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Step {index + 1} of {tourSteps.length}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 size-8"
          aria-label="Skip the tour"
          onClick={skip}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <h2 id="tour-title" className="mt-2 font-display text-lg font-semibold">
        {step.title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
      <div className="mt-4 flex items-center gap-2">
        <Button className="min-h-10 rounded-xl" onClick={next}>
          {last ? "Finish tour" : "Next"}
          {last ? null : <ArrowRight className="size-4" aria-hidden="true" />}
        </Button>
        <Button variant="ghost" className="min-h-10 rounded-xl" onClick={skip}>
          Skip
        </Button>
      </div>
    </div>
  );
}
