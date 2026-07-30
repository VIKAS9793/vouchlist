import { createFileRoute } from "@tanstack/react-router";
import { guardPublicRequest, methodNotAllowed } from "@/lib/api-guard";

const MAX_BODY_BYTES = 16_384;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

export const Route = createFileRoute("/api/public/csp-report")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      // Browsers post here, so this endpoint is public by design and says so
      // plainly rather than pretending an unsupported method is a wrong path.
      GET: async () => methodNotAllowed("POST, OPTIONS", CORS),
      PUT: async () => methodNotAllowed("POST, OPTIONS", CORS),
      PATCH: async () => methodNotAllowed("POST, OPTIONS", CORS),
      DELETE: async () => methodNotAllowed("POST, OPTIONS", CORS),
      POST: async ({ request }) => {
        // Open by design (browsers post here unauthenticated), so the shared
        // guard only enforces the per-caller flood cap.
        const refusal = await guardPublicRequest(request, {
          bucket: "csp-report",
          rateLimit: { windowMs: 60_000, max: 60 },
          headers: CORS,
        });
        if (refusal) return refusal;

        const { normalizeReport, persistReport, recordReport } =
          await import("@/lib/csp-reports.server");

        const type = request.headers.get("content-type") ?? "";
        if (!/json|csp-report/i.test(type))
          return new Response(null, { status: 415, headers: CORS });

        // Refuse an oversized body before buffering any of it.
        const declared = Number(request.headers.get("content-length") ?? 0);
        if (declared > MAX_BODY_BYTES) return new Response(null, { status: 413, headers: CORS });

        const text = await request.text();
        if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413, headers: CORS });

        let payload: unknown;
        try {
          payload = JSON.parse(text);
        } catch {
          return new Response(null, { status: 400, headers: CORS });
        }

        // The Reporting API batches reports as an array.
        const items = Array.isArray(payload) ? payload.slice(0, 20) : [payload];
        const userAgent = request.headers.get("user-agent") ?? "";
        const stored: Promise<void>[] = [];
        let accepted = 0;
        for (const item of items) {
          const violation = normalizeReport(item);
          if (!violation) continue;
          recordReport(violation);
          stored.push(persistReport(violation, userAgent));
          accepted += 1;
        }
        // persistReport never rejects; awaiting keeps the write alive past the
        // response on runtimes that tear the isolate down immediately.
        await Promise.all(stored);

        return new Response(null, {
          status: accepted ? 204 : 400,
          headers: CORS,
        });
      },
    },
  },
});
