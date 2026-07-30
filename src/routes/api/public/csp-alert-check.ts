import { createFileRoute } from "@tanstack/react-router";
import { cloakedHandler, guardPublicRequest } from "@/lib/api-guard";

/**
 * Scheduled spike check for CSP violations.
 *
 * Called every 15 minutes by the database scheduler. It lives under
 * /api/public/* because that prefix bypasses site auth, so it uses the shared
 * guard: the dashboard secret or the scheduler's `internal_tokens` row, plus a
 * rate limit. Anything else is refused by the shared guard with 401 (missing or
 * malformed credential) or 403 (invalid token, or a replayed request).
 */
async function run(request: Request) {
  const refusal = await guardPublicRequest(request, {
    bucket: "csp-alert-check",
    rateLimit: { windowMs: 60_000, max: 20 },
    envSecret: "CSP_REPORTS_TOKEN",
    internalToken: "csp_alert_cron",
  });
  if (refusal) return refusal;

  const { evaluateSpikes } = await import("@/lib/csp-alerts.server");
  try {
    const result = await evaluateSpikes();
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (cause) {
    console.error(`[csp-alert] check failed: ${(cause as Error)?.message ?? cause}`);
    return new Response(JSON.stringify({ error: (cause as Error).message }), {
      status: 500,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
}

export const Route = createFileRoute("/api/public/csp-alert-check")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
      // The scheduler only ever uses GET or POST; the rest look missing.
      PUT: cloakedHandler(),
      PATCH: cloakedHandler(),
      DELETE: cloakedHandler(),
      OPTIONS: cloakedHandler(),
    },
  },
});
