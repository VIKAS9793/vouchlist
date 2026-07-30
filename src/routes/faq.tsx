import { createFileRoute } from "@tanstack/react-router";
import { SITE_ORIGIN } from "@/lib/site";
import { breadcrumbScript, trailFor } from "@/lib/breadcrumbs";
import { pageGraphScript } from "@/lib/structured-data";
import ogImage from "@/assets/og-faq.jpg.asset.json";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal } from "@/components/motion/Reveal";
import { WaitlistSection } from "@/components/sections/WaitlistSection";
import { RelatedLinks } from "@/components/site/RelatedLinks";

const title = "FAQ: VouchList for WhatsApp communities";
const description =
  "Answers about how VouchList works, what it stores, who controls the list, and how a community can join the waitlist.";

const faqs = [
  {
    q: "Does everyone need to install an app?",
    a: "No. Residents keep using WhatsApp exactly as they do today. VouchList works alongside the group, so there is nothing for members to download or learn.",
  },
  {
    q: "Does VouchList read our whole group chat?",
    a: "VouchList looks for recommendation requests and replies so it can save the useful entries. Ordinary conversation is not turned into list entries, and admins can review or delete anything that was captured.",
  },
  {
    q: "Who controls the list?",
    a: "The community does. Admins can edit or remove entries, and can ask us to delete the community's list entirely at any time.",
  },
  {
    q: "Can vendors pay to be listed?",
    a: "No. There are no ads and no sponsored placements. A vendor only appears because a real neighbour recommended them.",
  },
  {
    q: "How does search work?",
    a: 'Ask in plain language, such as "reliable AC service", and VouchList answers with the vendors your own community has vouched for, along with who recommended them.',
  },
  {
    q: "How do we get VouchList for our society?",
    a: "Join the waitlist below. We add communities city by city and walk your committee through the permission step before anything is switched on.",
  },
];

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: `${SITE_ORIGIN}/faq` },
      { property: "og:image", content: `${SITE_ORIGIN}${ogImage.url}` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: title },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${SITE_ORIGIN}${ogImage.url}` },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/faq` }],
    scripts: [
      breadcrumbScript(SITE_ORIGIN, trailFor("/faq")),
      pageGraphScript({
        path: "/faq",
        title,
        description,
        image: `${SITE_ORIGIN}${ogImage.url}`,
        faqs,
      }),
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <>
      <section className="mx-auto w-full max-w-3xl px-6 py-20">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.14em] text-accent-strong uppercase">
            FAQ
          </p>
          <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight">
            Questions committees actually ask.
          </h1>
        </Reveal>
        <Reveal delay={0.08}>
          <Accordion type="single" collapsible className="mt-12">
            {faqs.map((faq) => (
              <AccordionItem key={faq.q} value={faq.q}>
                <AccordionTrigger className="text-left font-display text-base font-semibold">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent forceMount className="text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </section>
      <WaitlistSection />
      <RelatedLinks path="/faq" />
    </>
  );
}
