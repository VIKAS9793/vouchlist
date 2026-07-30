import { createFileRoute } from "@tanstack/react-router";
import { SITE_ORIGIN } from "@/lib/site";
import { pageGraphScript } from "@/lib/structured-data";
import ogImage from "@/assets/og-home.jpg.asset.json";
import { Hero } from "@/components/sections/Hero";
import { TrustMarks } from "@/components/visuals/TrustMarks";
import { PainSplit } from "@/components/sections/PainSplit";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { USP } from "@/components/sections/USP";
import { SuccessMeasures } from "@/components/sections/SuccessMeasures";
import { TrustArchitecture } from "@/components/sections/TrustArchitecture";
import { OnboardingTour } from "@/components/site/OnboardingTour";
import { WaitlistSection } from "@/components/sections/WaitlistSection";
import { RelatedLinks } from "@/components/site/RelatedLinks";

const title = "VouchList: Trusted recommendations from your own community";
const description =
  "VouchList turns the recommendations shared in your WhatsApp society group into a trusted list anyone can search. No new app, and only with your permission.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: `${SITE_ORIGIN}/` },
      { property: "og:image", content: `${SITE_ORIGIN}${ogImage.url}` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: title },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${SITE_ORIGIN}${ogImage.url}` },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/` }],
    scripts: [
      pageGraphScript({
        path: "/",
        title,
        description,
        image: `${SITE_ORIGIN}${ogImage.url}`,
        includeBreadcrumb: true,
      }),
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <Hero />
      <TrustMarks className="border-y border-border/60 bg-mist/30 py-14" />
      <PainSplit />
      <HowItWorks />
      <USP />
      <SuccessMeasures />
      <TrustArchitecture />
      <WaitlistSection />
      <RelatedLinks path="/" heading="Explore VouchList" />
      <OnboardingTour />
    </>
  );
}
