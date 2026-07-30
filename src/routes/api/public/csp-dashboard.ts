import { createFileRoute } from "@tanstack/react-router";
import { cloakedHandler, guardPublicRequest } from "@/lib/api-guard";

/**
 * Read side of CSP reporting: a grouped view of recent violations, as JSON or
 * as a small self-contained HTML dashboard.
 *
 * It lives under /api/public/* because that prefix bypasses site auth, so the
 * shared guard checks a bearer token held in CSP_REPORTS_TOKEN and rate limits
 * the caller. Without a valid token the route is indistinguishable from a
 * missing one, so it does not advertise itself to a scanner.
 */
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string,
  );
}

export const Route = createFileRoute("/api/public/csp-dashboard")({
  server: {
    handlers: {
      // Only GET is real. Every other method answers like a missing route, so
      // the endpoint cannot be found by probing verbs either.
      POST: cloakedHandler(),
      PUT: cloakedHandler(),
      PATCH: cloakedHandler(),
      DELETE: cloakedHandler(),
      OPTIONS: cloakedHandler(),
      GET: async ({ request }) => {
        const refusal = await guardPublicRequest(request, {
          bucket: "csp-dashboard",
          rateLimit: { windowMs: 60_000, max: 30 },
          envSecret: "CSP_REPORTS_TOKEN",
        });
        if (refusal) return refusal;
        const url = new URL(request.url);

        const { reportSummary } = await import("@/lib/csp-reports.server");
        const { recentAlerts } = await import("@/lib/csp-alerts.server");
        const hours = Math.min(Math.max(Number(url.searchParams.get("hours") ?? 168), 1), 24 * 90);

        let summary;
        let alerts: Awaited<ReturnType<typeof recentAlerts>> = [];
        try {
          summary = await reportSummary(hours);
          alerts = await recentAlerts(25);
        } catch (cause) {
          return new Response(`Could not read reports: ${(cause as Error).message}`, {
            status: 500,
            headers: { "cache-control": "no-store" },
          });
        }

        if (url.searchParams.get("format") !== "html") {
          return new Response(JSON.stringify({ windowHours: hours, ...summary, alerts }, null, 2), {
            status: 200,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        }

        const rows =
          summary.groups
            .map(
              (g) => `<tr>
      <td class="num">${g.count}</td>
      <td><code>${escapeHtml(g.effectiveDirective)}</code></td>
      <td><code>${escapeHtml(g.blockedUri || "(inline)")}</code></td>
      <td>${escapeHtml(g.documentUri)}</td>
      <td>${escapeHtml(g.sourceFile)}${g.lineNumber ? `:${g.lineNumber}` : ""}</td>
      <td>${escapeHtml(g.disposition)}</td>
      <td>${escapeHtml(g.lastSeen)}</td>
    </tr>`,
            )
            .join("\n") ||
          `<tr><td colspan="7" class="empty">No violations reported in this window.</td></tr>`;

        const alertRows =
          alerts
            .map(
              (a) => `<tr>
      <td><span class="sev ${escapeHtml(a.severity)}">${escapeHtml(a.severity)}</span></td>
      <td><code>${escapeHtml(a.effective_directive)}</code></td>
      <td><code>${escapeHtml(a.blocked_uri || "(inline)")}</code></td>
      <td class="num">${a.window_count}</td>
      <td class="num">${a.baseline_count}</td>
      <td>${a.notified ? escapeHtml(a.channel) : "log only"}</td>
      <td>${escapeHtml(a.created_at)}</td>
    </tr>`,
            )
            .join("\n") ||
          `<tr><td colspan="7" class="empty">No spikes have been raised.</td></tr>`;

        const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>CSP violations</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; margin: 2rem auto; max-width: 72rem; padding: 0 1rem; }
  h1 { font-size: 1.4rem; margin-bottom: .25rem; }
  p.meta { color: #666; margin-top: 0; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid #8884; vertical-align: top; word-break: break-word; }
  th { font-weight: 600; }
  td.num { font-variant-numeric: tabular-nums; font-weight: 600; }
  td.empty { text-align: center; color: #666; padding: 2rem; }
  code { font-size: 12px; }
  span.sev { font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: .04em; }
  span.sev.critical { color: #b91c1c; }
  span.sev.warning { color: #b45309; }
  h2 { font-size: 1.1rem; margin: 2.5rem 0 .5rem; }
</style></head>
<body>
  <h1>Content Security Policy violations</h1>
  <p class="meta">${summary.total} report(s) since ${escapeHtml(summary.since)}, grouped into ${summary.groups.length} distinct violation(s).</p>
  <table>
    <thead><tr><th>Count</th><th>Directive</th><th>Blocked</th><th>Page</th><th>Source</th><th>Mode</th><th>Last seen</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <h2>Spike alerts</h2>
  <p class="meta">Raised when a violation is new, or clearly busier in the last 15 minutes than its own 24 hour baseline.</p>
  <table>
    <thead><tr><th>Severity</th><th>Directive</th><th>Blocked</th><th>In window</th><th>Baseline</th><th>Delivered</th><th>Raised</th></tr></thead>
    <tbody>
${alertRows}
    </tbody>
  </table>
</body></html>`;

        return new Response(html, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
