import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

const CONTACT_EMAIL = "vikassahani17@gmail.com";

/**
 * RFC 9116 security.txt, served from a route so it also picks up the
 * site-wide security headers. Expires one year from the response date.
 */
export const Route = createFileRoute("/.well-known/security.txt")({
  server: {
    handlers: {
      GET: async () => {
        const req = getRequest();
        const requestUrl = new URL(req.url);
        const proto = req.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
        const host = req.headers.get("host") ?? requestUrl.host;
        const origin = host ? `${proto}://${host}` : "";

        const expires = new Date();
        expires.setUTCFullYear(expires.getUTCFullYear() + 1);

        const body = [
          `Contact: mailto:${CONTACT_EMAIL}`,
          `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, "Z")}`,
          "Preferred-Languages: en",
          `Canonical: ${origin}/.well-known/security.txt`,
          `Policy: ${origin}/security`,
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
