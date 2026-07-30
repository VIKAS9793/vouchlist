import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SITE_ORIGIN } from "@/lib/site";
import { sitemapEntries } from "@/lib/sitemap-routes";
import { lastmodFor } from "@/lib/route-lastmod.generated";

// Same canonical origin the pages self-reference, so sitemap URLs and
// <link rel="canonical"> never disagree.
const BASE_URL = SITE_ORIGIN;

// <lastmod> comes from src/lib/route-lastmod.generated.ts, which
// scripts/gen-lastmod.mjs rebuilds before every production build from the
// newest commit across each route's own source graph. That is an
// authoritative, page-specific timestamp: build time or a shared constant
// would be a non-page-specific fallback that crawlers ignore. Routes with no
// resolvable history simply omit the element.

/**
 * Entries come from src/lib/sitemap-routes.ts, which is keyed by the generated
 * route tree. A new route file fails typecheck until it is marked indexable or
 * excluded, so this list always matches the routes production serves.
 */

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = sitemapEntries().map((e) => {
          const lastmod = lastmodFor(e.path);
          return [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
            `    <changefreq>${e.changefreq}</changefreq>`,
            `    <priority>${e.priority}</priority>`,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n");
        });

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
