import { breadcrumbList, trailFor, type Crumb } from "@/lib/breadcrumbs";
import { SITE_ORIGIN } from "@/lib/site";

/**
 * Shared schema.org nodes for the public site.
 *
 * Every indexable page emits ONE JSON-LD block containing the same
 * Organization / Person / WebSite identity nodes plus a page-specific WebPage
 * node (and a FAQPage node where the page answers questions). Keeping the
 * identity in one module means the publisher details can never drift between
 * pages, and keeping it in one block per page means internal @id references
 * always resolve inside that block.
 */

const ORG_ID = `${SITE_ORIGIN}/#organization`;
const OWNER_ID = `${SITE_ORIGIN}/#owner`;
const SITE_ID = `${SITE_ORIGIN}/#website`;
const LOGO_ID = `${SITE_ORIGIN}/#logo`;

const ORG_DESCRIPTION =
  "VouchList turns the recommendations shared in your WhatsApp society group into a trusted list anyone can search. No new app, and only with your permission.";

export function organizationNode() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "VouchList",
    legalName: "VouchList",
    url: `${SITE_ORIGIN}/`,
    description: ORG_DESCRIPTION,
    slogan: "Trusted recommendations from your own community",
    logo: {
      "@type": "ImageObject",
      "@id": LOGO_ID,
      url: `${SITE_ORIGIN}/logo.png`,
      contentUrl: `${SITE_ORIGIN}/logo.png`,
      width: 512,
      height: 512,
      caption: "VouchList",
    },
    image: { "@id": LOGO_ID },
    email: "vikassahani17@gmail.com",
    founder: { "@id": OWNER_ID },
    foundingDate: "2026",
    areaServed: "Mumbai, India",
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "vikassahani17@gmail.com",
        availableLanguage: ["English"],
      },
    ],
  };
}

export function personNode() {
  return {
    "@type": "Person",
    "@id": OWNER_ID,
    name: "Vikas Dayashankar Sahani",
    jobTitle: "Founder and Product Manager",
    email: "vikassahani17@gmail.com",
    worksFor: { "@id": ORG_ID },
    sameAs: [
      "https://www.linkedin.com/in/vikas-sahani-727420358",
      "https://github.com/VIKAS9793",
      "https://myportfoliohubexpo.netlify.app",
    ],
  };
}

export function webSiteNode() {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    name: "VouchList",
    alternateName: "VouchList community recommendations",
    url: `${SITE_ORIGIN}/`,
    description: ORG_DESCRIPTION,
    inLanguage: "en",
    copyrightYear: 2026,
    copyrightHolder: { "@id": OWNER_ID },
    publisher: { "@id": ORG_ID },
  };
}

export type Faq = { q: string; a: string };

export type PageGraphOptions = {
  /** Site-relative path, e.g. "/faq". */
  path: string;
  title: string;
  description: string;
  /** Absolute URL of the page's social/hero image, when it has one. */
  image?: string;
  /** Present only on pages that visibly answer these questions. */
  faqs?: Faq[];
  /** Set on routes whose head does not already emit a breadcrumbScript. */
  includeBreadcrumb?: boolean;
  /** Overrides the trail lookup when a route needs a custom trail. */
  trail?: Crumb[];
};

/**
 * Builds the single JSON-LD head script for a page.
 */
export function pageGraphScript(options: PageGraphOptions) {
  const { path, title, description, image, faqs, includeBreadcrumb, trail } = options;
  const url = `${SITE_ORIGIN}${path}`;
  const pageId = `${url}#webpage`;

  const webPage: Record<string, unknown> = {
    "@type": "WebPage",
    "@id": pageId,
    url,
    name: title,
    description,
    inLanguage: "en",
    isPartOf: { "@id": SITE_ID },
    about: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
  };
  if (image) {
    webPage.primaryImageOfPage = {
      "@type": "ImageObject",
      "@id": `${url}#primaryimage`,
      url: image,
      contentUrl: image,
      width: 1200,
      height: 630,
      caption: title,
    };
  }

  const graph: Record<string, unknown>[] = [
    organizationNode(),
    personNode(),
    webSiteNode(),
    webPage,
  ];

  if (faqs && faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      name: title,
      url,
      inLanguage: "en",
      isPartOf: { "@id": pageId },
      publisher: { "@id": ORG_ID },
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  if (includeBreadcrumb) {
    graph.push(breadcrumbList(SITE_ORIGIN, trail ?? trailFor(path)));
  }

  return {
    type: "application/ld+json",
    children: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
  };
}
