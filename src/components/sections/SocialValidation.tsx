import { Building2, GraduationCap, Home, ShieldCheck, Users } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";

const facts = [
  {
    title: "No new app",
    copy: "VouchList works inside the WhatsApp group your community already uses, so nobody has to install or learn anything.",
  },
  {
    title: "Designed for invited groups only",
    copy: "The concept is built around opted-in housing societies where the admin chooses to bring it in. No group gets the bot unless its admin says yes.",
  },
  {
    title: "Judged by questions answered",
    copy: "Success is a neighbour getting the answer they needed, not how many messages were sent or how long anyone spent in the app.",
  },
];

const audiences = [
  { icon: Building2, title: "Apartment communities", copy: "Towers, blocks and gated layouts." },
  { icon: Users, title: "Residents", copy: "The people who actually hire the plumber." },
  {
    icon: GraduationCap,
    title: "Parent groups",
    copy: "Tuitions, paediatricians, activity classes.",
  },
  { icon: ShieldCheck, title: "Committees", copy: "Vendors vetted once, reused forever." },
  {
    icon: Home,
    title: "Housing societies",
    copy: "A list that stays even when the committee changes.",
  },
];

export function SocialValidation() {
  return (
    <section id="pilot" className="scroll-mt-24 py-24">
      <div className="mx-auto w-full max-w-6xl px-6">
        <Reveal>
          <h2 className="max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            People trust their neighbours, not adverts.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-10 sm:grid-cols-3">
          {facts.map((fact) => (
            <Reveal key={fact.title}>
              <p className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                {fact.title}
              </p>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {fact.copy}
              </p>
            </Reveal>
          ))}
        </div>

        <Stagger className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {audiences.map((item) => (
            <StaggerItem key={item.title}>
              <div className="float-card h-full p-6 transition-transform duration-300 hover:-translate-y-1">
                <item.icon
                  className="size-5 text-accent-strong"
                  aria-hidden="true"
                  strokeWidth={1.6}
                />
                <p className="mt-4 font-display text-base font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.copy}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
