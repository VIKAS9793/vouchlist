import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { robotsDisallowPaths } from "@/lib/sitemap-routes";

/**
 * Served from a route (not public/) so the response passes through the app
 * server and receives the site-wide security headers.
 */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const req = getRequest();
        const requestUrl = new URL(req.url);
        const proto = req.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
        const host = req.headers.get("host") ?? requestUrl.host;
        const origin = host ? `${proto}://${host}` : "";

        // Derived from the same route policy that builds sitemap.xml, so the
        // two files can never disagree about what is indexable.
        const disallow = robotsDisallowPaths().map((p) => `Disallow: ${p}`);

        const body = [
          "User-agent: Googlebot",
          "Allow: /",
          ...disallow,
          "",
          "User-agent: Bingbot",
          "Allow: /",
          ...disallow,
          "",
          "User-agent: Twitterbot",
          "Allow: /",
          ...disallow,
          "",
          "User-agent: facebookexternalhit",
          "Allow: /",
          ...disallow,
          "",
          "User-agent: *",
          "Allow: /",
          ...disallow,
          "",
          `Sitemap: ${origin}/sitemap.xml`,
          "",
        ].join("\n");

        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
