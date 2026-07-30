import { createFileRoute } from "@tanstack/react-router";
import { SITE_ORIGIN } from "@/lib/site";
import { breadcrumbScript, trailFor } from "@/lib/breadcrumbs";
import { pageGraphScript } from "@/lib/structured-data";
import ogImage from "@/assets/og-how-it-works.jpg.asset.json";
import { ConversationDemo } from "@/components/sections/ConversationDemo";
import { ArchitectureFlow } from "@/components/sections/ArchitectureFlow";
import { PrinciplesTimeline } from "@/components/sections/PrinciplesTimeline";
import { WaitlistSection } from "@/components/sections/WaitlistSection";
import { Reveal } from "@/components/motion/Reveal";
import { RelatedLinks } from "@/components/site/RelatedLinks";

const title = "How VouchList works: from group chat to trusted list";
const description =
  "Ask, recommend, capture, retrieve. See how VouchList quietly turns WhatsApp conversations into a searchable community recommendation list.";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: `${SITE_ORIGIN}/how-it-works` },
      { property: "og:image", content: `${SITE_ORIGIN}${ogImage.url}` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: title },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${SITE_ORIGIN}${ogImage.url}` },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/how-it-works` }],
    scripts: [
      breadcrumbScript(SITE_ORIGIN, trailFor("/how-it-works")),
      pageGraphScript({
        path: "/how-it-works",
        title,
        description,
        image: `${SITE_ORIGIN}${ogImage.url}`,
      }),
    ],
  }),
  component: HowItWorksPage,
});

function HowItWorksPage() {
  return (
    <>
      <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-6 py-20 lg:grid-cols-[1.05fr_1fr]">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.14em] text-accent-strong uppercase">
            How it works
          </p>
          <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
            Nobody changes what they do. Everything changes what they get.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            No downloads, no onboarding calls for residents, no new group. The community keeps
            chatting; VouchList keeps the answers.
          </p>
        </Reveal>
        <ConversationDemo />
      </section>
      <ArchitectureFlow />
      <PrinciplesTimeline />
      <WaitlistSection />
      <RelatedLinks path="/how-it-works" />
    </>
  );
}
