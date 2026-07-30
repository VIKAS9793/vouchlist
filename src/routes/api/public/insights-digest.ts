import { createFileRoute } from "@tanstack/react-router";
import { cloakedHandler, guardPublicRequest } from "@/lib/api-guard";

/**
 * Weekly product interest digest run.
 *
 * Called once a week by the database scheduler. It lives under /api/public/*
 * because that prefix bypasses site auth, so it uses the shared guard: a token
 * kept in `internal_tokens` plus a rate limit; anything else is refused by the
 * shared guard with 401 (missing or malformed) or 403 (invalid or replayed).
 */
async function run(request: Request) {
  const url = new URL(request.url);
  const refusal = await guardPublicRequest(request, {
    bucket: "insights-digest",
    rateLimit: { windowMs: 60_000, max: 20 },
    internalToken: "insights_digest_cron",
  });
  if (refusal) return refusal;

  const digest = await import("@/lib/insights-digest.server");
  try {
    // `?preview=1` renders the same email without sending it.
    if (url.searchParams.get("preview")) {
      const html = digest.renderDigestHtml(await digest.buildWeeklyDigest());
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }
    const result = await digest.sendWeeklyDigest();
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (cause) {
    console.error(`[insights-digest] run failed: ${(cause as Error)?.message ?? cause}`);
    return new Response(JSON.stringify({ error: (cause as Error).message }), {
      status: 500,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
}

export const Route = createFileRoute("/api/public/insights-digest")({
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
