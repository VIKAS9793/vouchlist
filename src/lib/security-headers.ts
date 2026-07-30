/**
 * Security headers applied to every response served by the site.
 *
 * Kept in one place so the pre-publish QA gate (scripts/security-qa.mjs) can
 * assert the exact policy the server sends.
 */
import { robotsTagFor } from "./robots-header";

const SUPABASE_ORIGIN = (() => {
  const raw = process.env.VITE_SUPABASE_URL ?? "";
  try {
    return raw ? new URL(raw).origin : "";
  } catch {
    return "";
  }
})();

const isDev = process.env.NODE_ENV !== "production";

/** Path that collects CSP violation reports (public, unauthenticated by design). */
export const CSP_REPORT_PATH = "/api/public/csp-report";

/** Name of the Reporting API endpoint group used by `report-to`. */
export const CSP_REPORT_GROUP = "csp-endpoint";

export type CspMode = "enforce" | "report-only";

/**
 * Resolves the CSP rollout mode.
 *
 * Set `CSP_MODE=report-only` (or `CSP_REPORT_ONLY=1`) to ship the strict policy
 * as `Content-Security-Policy-Report-Only`: browsers evaluate it and POST every
 * violation to CSP_REPORT_PATH without blocking anything. Once the report feed
 * is clean, drop the flag to enforce.
 */
export function cspMode(): CspMode {
  const raw = (process.env.CSP_MODE ?? "").toLowerCase().trim();
  if (raw === "report-only" || raw === "report_only" || raw === "reportonly") return "report-only";
  if (raw === "enforce") return "enforce";
  const legacy = (process.env.CSP_REPORT_ONLY ?? "").toLowerCase().trim();
  if (legacy === "1" || legacy === "true" || legacy === "yes") return "report-only";
  return "enforce";
}

/** Generates a fresh, unguessable per-request CSP nonce. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=+$/, "");
}

/** Google Analytics (gtag.js) hosts, allowlisted only when a property is set. */
const ANALYTICS_ENABLED = Boolean(process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY);
const ANALYTICS_SCRIPT_SRC = ANALYTICS_ENABLED ? ["https://www.googletagmanager.com"] : [];
const ANALYTICS_CONNECT_SRC = ANALYTICS_ENABLED
  ? [
      "https://www.googletagmanager.com",
      "https://*.google-analytics.com",
      "https://*.analytics.google.com",
      "https://*.googletagmanager.com",
    ]
  : [];

function contentSecurityPolicy(nonce: string): string {
  const connect = [
    "'self'",
    SUPABASE_ORIGIN,
    SUPABASE_ORIGIN ? SUPABASE_ORIGIN.replace(/^https:/, "wss:") : "",
    ...ANALYTICS_CONNECT_SRC,
    isDev ? "ws:" : "",
  ].filter(Boolean);

  return [
    "default-src 'self'",
    // Inline hydration/router/JSON-LD scripts are stamped with this nonce at
    // response time, so no 'unsafe-inline' is needed.
    `script-src 'self' 'nonce-${nonce}'${
      ANALYTICS_SCRIPT_SRC.length ? ` ${ANALYTICS_SCRIPT_SRC.join(" ")}` : ""
    }`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    `style-src-elem 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    // style="..." attributes cannot carry a nonce; scoped to attributes only.
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src ${connect.join(" ")}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
    // Legacy (CSP2) and modern (Reporting API) violation sinks.
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${CSP_REPORT_GROUP}`,
  ].join("; ");
}

export function securityHeaders(nonce: string, mode: CspMode = cspMode()): Record<string, string> {
  const policy = contentSecurityPolicy(nonce);
  return {
    [mode === "report-only" ? "content-security-policy-report-only" : "content-security-policy"]:
      policy,
    "reporting-endpoints": `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`,
    "report-to": JSON.stringify({
      group: CSP_REPORT_GROUP,
      max_age: 10886400,
      endpoints: [{ url: CSP_REPORT_PATH }],
      include_subdomains: true,
    }),
    "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    // Google sign-in happens in a popup that reports back to this page.
    // Strict "same-origin" severs that link, so the popup would complete and
    // the page would never hear about it.
    "cross-origin-opener-policy": "same-origin-allow-popups",
    "cross-origin-resource-policy": "same-origin",
    "x-permitted-cross-domain-policies": "none",
  };
}

type HtmlRewriterCtor = new () => {
  on(selector: string, handlers: unknown): { transform(response: Response): Response };
};

function isHtml(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").includes("text/html");
}

/** Stamps every inline <script>/<style> element with the request nonce. */
async function stampNonce(response: Response, nonce: string): Promise<Response> {
  if (!isHtml(response) || !response.body) return response;

  const Rewriter = (globalThis as { HTMLRewriter?: HtmlRewriterCtor }).HTMLRewriter;
  if (Rewriter) {
    const handler = {
      element(element: {
        hasAttribute(n: string): boolean;
        setAttribute(n: string, v: string): void;
      }) {
        if (element.hasAttribute("src") || element.hasAttribute("href")) return;
        element.setAttribute("nonce", nonce);
      },
    };
    return new Rewriter().on("script, style", handler).transform(response);
  }

  // Node/dev fallback: buffer and rewrite the markup.
  const html = await response.text();
  const stamped = html.replace(/<(script|style)(\s[^>]*)?>/gi, (tag, name: string, attrs = "") => {
    if (/\snonce\s*=/i.test(attrs) || /\ssrc\s*=/i.test(attrs)) return tag;
    return `<${name} nonce="${nonce}"${attrs}>`;
  });
  return new Response(stamped, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/** Returns the response carrying the security headers, preserving existing ones. */
export async function withSecurityHeaders(
  response: Response,
  nonce = createNonce(),
  requestUrl?: string,
): Promise<Response> {
  const stamped = await stampNonce(response, nonce);
  const headers = new Headers(stamped.headers);
  for (const [key, value] of Object.entries(securityHeaders(nonce))) {
    headers.set(key, value);
  }
  // Internal-only URLs get a crawler directive in the headers as well as the
  // page's own robots meta tag, so a direct fetch is covered too.
  if (requestUrl) {
    let pathname: string | undefined;
    try {
      pathname = new URL(requestUrl).pathname;
    } catch {
      pathname = undefined;
    }
    const tag = pathname ? robotsTagFor(pathname, stamped.status) : undefined;
    if (tag) headers.set("x-robots-tag", tag);
    else headers.delete("x-robots-tag");
  }
  return new Response(stamped.body, {
    status: stamped.status,
    statusText: stamped.statusText,
    headers,
  });
}
