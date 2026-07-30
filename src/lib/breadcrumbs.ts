export type Crumb = { name: string; path: string };

/**
 * Single source of truth for breadcrumb trails. Both the visible breadcrumb
 * navigation and the BreadcrumbList JSON-LD read from this map, so they can
 * never drift apart.
 */
export const crumbTrails: Record<string, Crumb[]> = {
  "/": [],
  "/features": [{ name: "Features", path: "/features" }],
  "/how-it-works": [{ name: "How it works", path: "/how-it-works" }],
  "/communities": [{ name: "Communities", path: "/communities" }],
  "/trust": [{ name: "Trust and privacy", path: "/trust" }],
  "/faq": [{ name: "FAQ", path: "/faq" }],
  "/security": [{ name: "Security", path: "/security" }],
  "/waitlist/confirm": [{ name: "Confirm your email", path: "/waitlist/confirm" }],
  "/privacy/request": [
    { name: "Trust and privacy", path: "/trust" },
    { name: "Your details", path: "/privacy/request" },
  ],
  "/privacy/verify": [
    { name: "Trust and privacy", path: "/trust" },
    { name: "Your details", path: "/privacy/request" },
    { name: "Confirm your request", path: "/privacy/verify" },
  ],
};

/** Returns the trail for a pathname, ignoring any trailing slash. */
export function trailFor(pathname: string): Crumb[] {
  const key = pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return crumbTrails[key] ?? [];
}

/**
 * Builds a schema.org BreadcrumbList node. Home is always the first crumb.
 */
export function breadcrumbList(origin: string, trail: Crumb[] = []) {
  const items: Crumb[] = [{ name: "Home", path: "/" }, ...trail];
  return {
    "@type": "BreadcrumbList",
    "@id": `${origin}${items[items.length - 1].path}#breadcrumb`,
    itemListElement: items.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${origin}${crumb.path}`,
    })),
  };
}

/**
 * Head script entry for a page's BreadcrumbList JSON-LD.
 */
export function breadcrumbScript(origin: string, trail: Crumb[] = []) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      ...breadcrumbList(origin, trail),
    }),
  };
}
