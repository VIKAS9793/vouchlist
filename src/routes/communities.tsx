import { createFileRoute } from "@tanstack/react-router";
import { SITE_ORIGIN } from "@/lib/site";
import { breadcrumbScript, trailFor } from "@/lib/breadcrumbs";
import { pageGraphScript } from "@/lib/structured-data";
import ogImage from "@/assets/og-communities.jpg.asset.json";
import { SocialValidation } from "@/components/sections/SocialValidation";
import { CommunityIntelligence } from "@/components/sections/CommunityIntelligence";
import { WaitlistSection } from "@/components/sections/WaitlistSection";
import { Reveal } from "@/components/motion/Reveal";
import { RelatedLinks } from "@/components/site/RelatedLinks";

const title = "Communities: who VouchList is built for";
const description =
  "Apartment communities, residents, parent groups, committees and housing societies use VouchList to keep their trusted recommendations in one place.";

export const Route = createFileRoute("/communities")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: `${SITE_ORIGIN}/communities` },
      { property: "og:image", content: `${SITE_ORIGIN}${ogImage.url}` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: title },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${SITE_ORIGIN}${ogImage.url}` },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/communities` }],
    scripts: [
      breadcrumbScript(SITE_ORIGIN, trailFor("/communities")),
      pageGraphScript({
        path: "/communities",
        title,
        description,
        image: `${SITE_ORIGIN}${ogImage.url}`,
      }),
    ],
  }),
  component: CommunitiesPage,
});

function CommunitiesPage() {
  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.14em] text-accent-strong uppercase">
            Communities
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold tracking-tight sm:text-6xl">
            Built for the group chat that runs your building.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Six hundred families, one WhatsApp group, and a decade of hard-won local knowledge
            scrolling past every day. That is the community VouchList was designed for.
          </p>
        </Reveal>
      </section>
      <SocialValidation />
      <CommunityIntelligence />
      <WaitlistSection />
      <RelatedLinks path="/communities" />
    </>
  );
}
