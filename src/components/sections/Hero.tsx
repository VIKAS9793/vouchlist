import { motion } from "motion/react";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WaitlistDialog } from "@/components/waitlist/WaitlistDialog";
import { ConversationDemo } from "./ConversationDemo";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_75%_-10%,var(--color-accent)/8%,transparent)]"
      />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-16 px-6 py-20 lg:min-h-[calc(100dvh-4.5rem)] lg:grid-cols-[1.05fr_1fr] lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-accent-strong" aria-hidden="true" />
            Works inside the WhatsApp groups you already have
          </span>

          <h1 className="mt-6 font-display text-5xl leading-[1.03] font-semibold tracking-tight text-balance-tight sm:text-6xl">
            Your neighbours already know.
            <span className="block text-muted-foreground">VouchList remembers.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Every good plumber, tuition teacher and packers-and-movers recommendation is already in
            your society group, and then it scrolls away. VouchList quietly turns those messages
            into a shared list your community can search any time. No new app. No new habits.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <WaitlistDialog>
              <Button size="lg" className="min-h-12 rounded-xl px-6 text-base">
                Join the waitlist
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </WaitlistDialog>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-12 rounded-xl border-border px-6 text-base"
            >
              <a href="#how-it-works">
                <Search className="size-4" aria-hidden="true" />
                See how it works
              </a>
            </Button>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Permission first · Approved by your admins · Nothing leaves your community
          </p>
        </motion.div>

        <ConversationDemo showFlowLink />
      </div>
    </section>
  );
}
