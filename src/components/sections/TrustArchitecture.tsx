import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { TrustSeal } from "@/components/visuals/TrustSeal";
import { DeferredVisual } from "@/components/site/DeferredVisual";
import {
  BadgeCheck,
  EyeOff,
  Handshake,
  Lock,
  ScanFace,
  ShieldCheck,
  SmartphoneNfc,
  UsersRound,
} from "lucide-react";

const pillars = [
  {
    icon: Handshake,
    title: "Only with permission",
    copy: "Nothing starts until a community says yes.",
  },
  {
    icon: SmartphoneNfc,
    title: "No new app",
    copy: "Residents keep using WhatsApp exactly as before.",
  },
  {
    icon: UsersRound,
    title: "Community controlled",
    copy: "The group owns its list and can delete it at any time.",
  },
  {
    icon: ShieldCheck,
    title: "Admins stay in charge",
    copy: "Admins can check, edit and remove any entry.",
  },
  {
    icon: BadgeCheck,
    title: "Human recommendations",
    copy: "Only real people vouch. No auto-listings.",
  },
  { icon: EyeOff, title: "No ads", copy: "No sponsored slots. Vendors cannot buy a place." },
  { icon: ScanFace, title: "Nothing hidden", copy: "Every saved entry shows where it came from." },
  {
    icon: Lock,
    title: "Minimal data",
    copy: "We keep the recommendation, not the rest of the conversation.",
  },
];

export function TrustArchitecture() {
  return (
    <section
      id="trust-architecture"
      className="scroll-mt-24 border-y border-border/60 bg-mist/40 py-24"
    >
      <div className="mx-auto w-full max-w-6xl px-6">
        <Reveal>
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
            <DeferredVisual className="size-20 shrink-0 sm:size-24">
              <TrustSeal className="size-full text-accent-strong" />
            </DeferredVisual>
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-accent-strong uppercase">
                Privacy first
              </p>
              <h2 className="mt-4 max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                Everything begins with consent.
              </h2>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">
                A community's trust is not a feature we add later. It is the only reason any of this
                works.
              </p>
            </div>
          </div>
        </Reveal>

        <Stagger className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" gap={0.06}>
          {pillars.map((pillar) => (
            <StaggerItem key={pillar.title}>
              <div className="float-card h-full p-6">
                <pillar.icon
                  className="size-5 text-accent-strong"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
                <h3 className="mt-4 font-display text-base font-semibold">{pillar.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{pillar.copy}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
