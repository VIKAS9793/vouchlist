import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_ORIGIN } from "@/lib/site";
import { breadcrumbScript, trailFor } from "@/lib/breadcrumbs";
import { pageGraphScript } from "@/lib/structured-data";
import ogImage from "@/assets/og-trust.jpg.asset.json";
import { TrustArchitecture } from "@/components/sections/TrustArchitecture";
import { WaitlistSection } from "@/components/sections/WaitlistSection";
import { Reveal } from "@/components/motion/Reveal";
import { RelatedLinks } from "@/components/site/RelatedLinks";

const title = "Trust and privacy: how VouchList handles community data";
const description =
  "Permission first, checked by your admins, no ads and no copied listings. Read how VouchList protects the data and trust of every community it serves.";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: `${SITE_ORIGIN}/trust` },
      { property: "og:image", content: `${SITE_ORIGIN}${ogImage.url}` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: title },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${SITE_ORIGIN}${ogImage.url}` },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/trust` }],
    scripts: [
      breadcrumbScript(SITE_ORIGIN, trailFor("/trust")),
      pageGraphScript({
        path: "/trust",
        title,
        description,
        image: `${SITE_ORIGIN}${ogImage.url}`,
      }),
    ],
  }),
  component: TrustPage,
});

function TrustPage() {
  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.14em] text-accent-strong uppercase">
            Trust
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold tracking-tight sm:text-6xl">
            A community's trust is the product.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            This page is maintained by the VouchList team to answer common privacy questions.
            VouchList only works in a group after its admins say yes, and a community can ask us to
            delete its list at any time.
          </p>
        </Reveal>
      </section>
      <TrustArchitecture />
      <section id="privacy" className="scroll-mt-24 mx-auto w-full max-w-3xl px-6 py-20">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            What we do and don't store
          </h2>
          <div className="mt-6 space-y-4 text-muted-foreground">
            <p>
              VouchList is designed to keep the recommendation, not the conversation. When a message
              contains a vendor recommendation, we save that entry neatly: the vendor, the service,
              the contact details shared, and who vouched for it. Messages that are not
              recommendations are not turned into entries.
            </p>
            <p>
              Group admins can review, edit and remove any entry. Vendors cannot pay to appear, and
              there are no advertisements anywhere in the product.
            </p>
            <p>
              Waitlist details you submit on this site are used only to track demand and contact you
              if this concept moves to a built product.
            </p>
            <p>
              Want a copy of what we hold about you, or want it deleted? You do not need an account:
              use the{" "}
              <Link
                to="/privacy/request"
                className="text-accent-strong underline underline-offset-4"
              >
                data request form
              </Link>{" "}
              and we will email you a one time link to confirm it is really you.
            </p>
            <p>
              Any other question? Write to{" "}
              <a
                className="text-accent-strong underline underline-offset-4"
                href="mailto:vikassahani17@gmail.com"
              >
                vikassahani17@gmail.com
              </a>
              .
            </p>
          </div>
        </Reveal>
      </section>
      <WaitlistSection />
      <RelatedLinks path="/trust" />
    </>
  );
}
