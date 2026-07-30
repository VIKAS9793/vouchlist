import { createFileRoute } from "@tanstack/react-router";
import { cloakedHandler, guardPublicRequest } from "@/lib/api-guard";
import { guardMetrics, guardMetricsPrometheus } from "@/lib/api-guard-metrics";

/**
 * Counters for the shared `/api/public/*` guard: how many requests each
 * endpoint allowed, rate limited, or refused, and why.
 *
 * The counters live in the worker isolate, so a reading covers one instance
 * since it started rather than the whole fleet. It is enough to see a token
 * being guessed or a flood cap being hit; the structured log lines carry the
 * durable record.
 *
 * Gated behind the same operator token as the CSP dashboard.
 */
export const Route = createFileRoute("/api/public/guard-metrics")({
  server: {
    handlers: {
      // Anything other than GET answers like a missing route.
      POST: cloakedHandler(),
      PUT: cloakedHandler(),
      PATCH: cloakedHandler(),
      DELETE: cloakedHandler(),
      OPTIONS: cloakedHandler(),
      GET: async ({ request }) => {
        const refusal = await guardPublicRequest(request, {
          bucket: "guard-metrics",
          rateLimit: { windowMs: 60_000, max: 30 },
          envSecret: "CSP_REPORTS_TOKEN",
        });
        if (refusal) return refusal;

        const format = new URL(request.url).searchParams.get("format");
        if (format === "prometheus") {
          return new Response(guardMetricsPrometheus(), {
            status: 200,
            headers: {
              "content-type": "text/plain; version=0.0.4; charset=utf-8",
              "cache-control": "no-store",
            },
          });
        }

        return new Response(JSON.stringify(guardMetrics(), null, 2), {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      },
    },
  },
});
