/**
 * Canonical origin for the public site.
 *
 * Canonical and og:url must name ONE host, not whichever host served the
 * request. The same build is reachable on preview hosts
 * (id-preview--*.lovable.app, project--*-dev.lovable.app) as well as the
 * production host; if each of those self-referenced, crawlers would treat
 * them as duplicate copies of every page. Pointing all of them at the
 * production origin consolidates the signals onto one URL per page.
 */
export const SITE_ORIGIN = "https://vouchlist.lovable.app";

/** Absolute canonical URL for a site-relative path ("/", "/faq", ...). */
export function canonicalUrl(path: string): string {
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}
