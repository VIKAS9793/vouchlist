import type { FileRoutesByTo } from "@/routeTree.gen";

/**
 * Every URL the router can serve, straight from the generated route tree.
 * Adding a route file makes this union grow, and the exhaustive record below
 * then fails typecheck until the new route is classified — so the sitemap can
 * never silently drift from production routes.
 */
export type RoutePath = keyof FileRoutesByTo;

export type ChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export type RoutePolicy =
  | { indexable: true; changefreq: ChangeFreq; priority: string }
  | { indexable: false; reason: string };

const indexable = (changefreq: ChangeFreq, priority: string): RoutePolicy => ({
  indexable: true,
  changefreq,
  priority,
});
const excluded = (reason: string): RoutePolicy => ({ indexable: false, reason });

/**
 * The pages a visitor is allowed to discover: the only destinations that may
 * appear in onsite search, the related-link graph or any indexing feed.
 * Widening this union is the single deliberate step needed to make a page
 * public, and `PUBLIC_ROUTES` below is checked against ROUTE_POLICY at start
 * up so it can never point at a route classified as private.
 */
export type PublicRoutePath =
  "/" | "/features" | "/how-it-works" | "/communities" | "/trust" | "/faq" | "/privacy/request";

export const PUBLIC_ROUTES: PublicRoutePath[] = [
  "/",
  "/features",
  "/how-it-works",
  "/communities",
  "/trust",
  "/faq",
  "/privacy/request",
];

/** True when a path is one of the pages visitors may be pointed at. */
export function isPublicRoute(path: string): path is PublicRoutePath {
  return (PUBLIC_ROUTES as string[]).includes(path);
}

/** One decision per route. Exhaustive by construction (see RoutePath). */
export const ROUTE_POLICY: Record<RoutePath, RoutePolicy> = {
  "/": indexable("weekly", "1.0"),
  "/features": indexable("monthly", "0.8"),
  "/how-it-works": indexable("monthly", "0.8"),
  "/communities": indexable("monthly", "0.8"),
  "/trust": indexable("monthly", "0.7"),
  "/faq": indexable("monthly", "0.6"),
  "/privacy/request": indexable("yearly", "0.4"),

  "/$": excluded("catch-all 404 handler"),
  "/security": excluded("internal disclosure policy for researchers, not a product page"),
  "/auth": excluded("sign-in screen, nothing to index"),
  "/account": excluded("per-person page behind sign-in"),
  "/insights": excluded("private analytics view behind sign-in"),
  "/privacy/verify": excluded("single-use, token-gated landing page"),
  "/waitlist/confirm": excluded("single-use, token-gated landing page"),
  "/robots.txt": excluded("crawler directive file, not a page"),
  "/sitemap.xml": excluded("the sitemap itself"),
  "/.well-known/security.txt": excluded("machine-readable disclosure file"),
  "/api/public/csp-report": excluded("machine-only endpoint"),
  "/api/public/csp-dashboard": excluded("machine-only, token-gated endpoint"),
  "/api/public/csp-alert-check": excluded("machine-only, token-gated endpoint"),
  "/api/public/insights-digest": excluded("machine-only, token-gated endpoint"),
  "/api/public/guard-metrics": excluded("machine-only, token-gated endpoint"),
};

export interface SitemapEntry {
  path: RoutePath;
  changefreq: ChangeFreq;
  priority: string;
}

/** Indexable routes, in declaration order. */
export function sitemapEntries(): SitemapEntry[] {
  return (Object.entries(ROUTE_POLICY) as [RoutePath, RoutePolicy][])
    .filter(([, policy]) => policy.indexable)
    .map(([path, policy]) => ({
      path,
      changefreq: (policy as Extract<RoutePolicy, { indexable: true }>).changefreq,
      priority: (policy as Extract<RoutePolicy, { indexable: true }>).priority,
    }));
}

/**
 * Disallow rules for robots.txt, derived from the same policy so the two files
 * can never disagree. `/api/*` collapses to a single `/api/` prefix rule.
 */
export function robotsDisallowPaths(): string[] {
  const rules = new Set<string>();
  for (const [path, policy] of Object.entries(ROUTE_POLICY) as [RoutePath, RoutePolicy][]) {
    if (policy.indexable) continue;
    if (path.startsWith("/api/")) {
      rules.add("/api/");
      continue;
    }
    // Files and the splat route need no rule: crawlers only follow real pages,
    // and robots.txt/sitemap.xml/security.txt are meant to be fetched.
    if (path === "/$" || path.includes(".")) continue;
    rules.add(path);
  }
  return [...rules];
}
