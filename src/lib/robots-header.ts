/**
 * X-Robots-Tag policy.
 *
 * The `robots` meta tag only protects a page a crawler renders as HTML. A
 * header protects every fetch of a URL, including direct hits, non-HTML
 * responses and machine endpoints, so internal-only URLs stay out of search
 * even when something links to them by accident.
 *
 * The decision comes from the same ROUTE_POLICY the sitemap and robots.txt
 * use, so the three can never disagree.
 */
import { ROUTE_POLICY, type RoutePath } from "./sitemap-routes";

/** Sent for every internal-only URL. Belt and braces across all major engines. */
export const PRIVATE_ROBOTS_TAG = "noindex, nofollow, noarchive, nosnippet, noimageindex";

/**
 * Files that exist precisely so crawlers and researchers can fetch them.
 * Marking them noindex would be self-defeating.
 */
const CRAWLER_FILES = new Set<string>(["/robots.txt", "/sitemap.xml", "/.well-known/security.txt"]);

const INDEXABLE = new Set<string>(
  (Object.entries(ROUTE_POLICY) as [RoutePath, { indexable: boolean }][])
    .filter(([, policy]) => policy.indexable)
    .map(([path]) => path),
);

/** Build output and static assets: never pages, never indexed on their own. */
function isAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_build/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/@") ||
    pathname.startsWith("/node_modules/") ||
    pathname.startsWith("/src/")
  );
}

/** Trailing slashes are equivalent, so `/account/` is judged like `/account`. */
function normalise(pathname: string): string {
  return pathname !== "/" && pathname.endsWith("/") ? pathname.replace(/\/+$/, "") : pathname;
}

/**
 * The X-Robots-Tag for a URL, or `undefined` when the URL is a public page
 * that should be indexed normally.
 */
export function robotsTagFor(pathname: string, status = 200): string | undefined {
  const path = normalise(pathname);
  if (CRAWLER_FILES.has(path) || isAsset(path)) return undefined;
  // Anything that is not a live public page — private routes, API endpoints,
  // token pages, 404s, errors — is internal or has nothing worth indexing.
  if (status !== 200) return PRIVATE_ROBOTS_TAG;
  return INDEXABLE.has(path) ? undefined : PRIVATE_ROBOTS_TAG;
}
