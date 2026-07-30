import { createFileRoute } from "@tanstack/react-router";
import { SITE_ORIGIN } from "@/lib/site";
import { breadcrumbScript, trailFor } from "@/lib/breadcrumbs";
import { pageGraphScript } from "@/lib/structured-data";
import ogImage from "@/assets/og-features.jpg.asset.json";
import { Ecosystem } from "@/components/sections/Ecosystem";
import { Benefits } from "@/components/sections/Benefits";
import { WaitlistSection } from "@/components/sections/WaitlistSection";
import { Reveal } from "@/components/motion/Reveal";
import { RelatedLinks } from "@/components/site/RelatedLinks";

const title = "Features: how VouchList saves group recommendations";
const description =
  "Save and search the recommendations your community already shares. VouchList spots real questions, keeps trusted contacts and answers in plain language.";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: `${SITE_ORIGIN}/features` },
      { property: "og:image", content: `${SITE_ORIGIN}${ogImage.url}` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: title },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${SITE_ORIGIN}${ogImage.url}` },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/features` }],
    scripts: [
      breadcrumbScript(SITE_ORIGIN, trailFor("/features")),
      pageGraphScript({
        path: "/features",
        title,
        description,
        image: `${SITE_ORIGIN}${ogImage.url}`,
      }),
    ],
  }),
  component: FeaturesPage,
});

function FeaturesPage() {
  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.14em] text-accent-strong uppercase">
            Features
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold tracking-tight sm:text-6xl">
            Everything a community needs. Nothing it has to learn.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            VouchList is deliberately small. It does one thing well: it makes sure a good
            recommendation is never lost again.
          </p>
        </Reveal>
      </section>
      <Ecosystem />
      <Benefits />
      <WaitlistSection />
      <RelatedLinks path="/features" />
    </>
  );
}
