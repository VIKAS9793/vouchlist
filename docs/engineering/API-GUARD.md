# Guarding an `/api/public/*` endpoint

Everything under `src/routes/api/public/` bypasses site authentication, because
that prefix exists for callers who cannot sign in: browsers posting CSP
reports, the database scheduler, and any external service we hand a URL to. The
published site will not stop a stranger from reaching these routes, so each
handler has to prove the caller for itself.

`src/lib/api-guard.ts` is where that proof lives. Every endpoint calls the same
function, so the four routes cannot drift apart and a fifth one gets the same
protection by construction.

## The shape of a new endpoint

```ts
// src/routes/api/public/my-endpoint.ts
import { createFileRoute } from "@tanstack/react-router";
import { guardPublicRequest } from "@/lib/api-guard";

export const Route = createFileRoute("/api/public/my-endpoint")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const refusal = await guardPublicRequest(request, {
          bucket: "my-endpoint",
          rateLimit: { windowMs: 60_000, max: 20 },
          envSecret: "MY_ENDPOINT_TOKEN",
        });
        if (refusal) return refusal;

        // Only reached by a caller that is inside its budget and holds the token.
        const { doWork } = await import("@/lib/my-endpoint.server");
        return Response.json(await doWork());
      },
    },
  },
});
```

Three rules that are easy to get wrong:

1. **Return the refusal immediately.** `guardPublicRequest` returns a `Response`
   when the request must be refused and `null` when the handler may proceed.
   There is no throwing, so a forgotten `if (refusal) return refusal;` silently
   opens the endpoint.
2. **Guard before reading the body.** The guard is the first statement in the
   handler, ahead of parsing, importing server modules, or touching the
   database, so an unauthenticated flood costs almost nothing.
3. **Import server-only modules inside the handler.** Route files are reachable
   from the client bundle; a top-level `import` of a `.server` module or of
   `supabaseAdmin` pulls it into the browser graph.

The guard only protects the methods you declare. A route that exports `GET`
only will serve the app shell for a `POST`, which looks like an unguarded 200.
Declare every method the endpoint should answer, and nothing else.

## Choosing the access level

| Access level | Who calls it                                             | Options to set                               |
| ------------ | -------------------------------------------------------- | -------------------------------------------- |
| Open         | Browsers, unauthenticated clients                        | `rateLimit` only                             |
| Operator     | A person or dashboard holding a project secret           | `rateLimit` + `envSecret`                    |
| Scheduler    | The database cron job, which cannot read runtime secrets | `rateLimit` + `internalToken`                |
| Either       | Both of the above                                        | `rateLimit` + `envSecret` + `internalToken`  |
| Signed       | A caller that can send freshness metadata                | any of the above + `requireReplayProtection` |

### Open

No credential is possible, because the caller is an arbitrary browser. The
endpoint stays public and the flood cap is the whole defence, so keep the
handler cheap, bounded, and free of anything worth scraping.

```ts
await guardPublicRequest(request, {
  bucket: "csp-report",
  rateLimit: { windowMs: 60_000, max: 60 },
  headers: CORS, // merged into the 429 so the browser can read it
});
```

Use `headers` whenever the endpoint sets CORS headers on its success path; a
429 that omits them shows up in the browser as an opaque network error rather
than a rate limit.

### Operator

`envSecret` names an environment secret, not the value. The guard reads
`process.env[name]` per request, which is required on the Worker runtime where
environment values are injected at call time rather than at module load.

```ts
await guardPublicRequest(request, {
  bucket: "csp-dashboard",
  rateLimit: { windowMs: 60_000, max: 30 },
  envSecret: "CSP_REPORTS_TOKEN",
});
```

If the secret is unset, every token is refused. That is deliberate: a missing
secret closes the endpoint instead of opening it.

### Scheduler

The database scheduler runs inside Postgres and cannot read project secrets, so
it presents a token stored in the `internal_tokens` table. `internalToken` names
the row.

```ts
await guardPublicRequest(request, {
  bucket: "insights-digest",
  rateLimit: { windowMs: 60_000, max: 20 },
  internalToken: "insights_digest_cron",
});
```

The lookup uses the service-role client and is loaded lazily inside the guard,
so listing an `internalToken` does not pull admin credentials into any bundle.

### Either

List both when a human should be able to trigger a scheduled job by hand.
`csp-alert-check` does this: the operator secret or the cron row is accepted,
and anything else is refused.

### Signed

A caller that controls its own request headers can also prove freshness with
`x-request-timestamp` (epoch milliseconds) and `x-request-nonce` (a unique
printable string). Validation is opportunistic by default so existing
schedulers keep working; set `requireReplayProtection: true` to make both
headers mandatory, and `replayWindowMs` to change the five minute default.

```ts
await guardPublicRequest(request, {
  bucket: "payout-hook",
  rateLimit: { windowMs: 60_000, max: 10 },
  envSecret: "PAYOUT_HOOK_TOKEN",
  requireReplayProtection: true,
  replayWindowMs: 120_000,
});
```

Half a pair is a malformed request: a nonce with no clock never expires, and a
timestamp with no nonce can be replayed freely inside the window. Replay
bookkeeping runs only after the token is accepted, so an anonymous flood cannot
fill the nonce table.

Signature-verified webhooks are the one case that does not fit. When a provider
signs the raw body (Stripe, GitHub, Slack), still call the guard for the rate
limit, then verify the HMAC over the raw text yourself before parsing.

## Picking a rate limit

`rateLimit` is a fixed window counter: `max` requests per `windowMs` per caller,
where the caller is `cf-connecting-ip`, then the first hop of
`x-forwarded-for`, then `unknown`. Every caller behind a shared proxy collapses
into one bucket, so size the budget for the noisiest legitimate client and treat
it as a flood cap rather than a quota.

`bucket` names the counter and defaults to the request path. Set it explicitly:
it keeps each endpoint's budget separate, keeps the name stable if the route
moves, and is the string the tests assert against. Two endpoints sharing a
bucket name share a budget, which is occasionally what you want for a pair of
read and write routes on the same resource.

The counter is per isolate and in memory. It is a cheap abuse brake, not a
distributed quota, and it resets on deploy.

## What a refusal looks like

A gated endpoint keeps its own existence secret. Until a caller proves it holds
the token, every refusal is the site's ordinary 404 for the path it asked for:
same status, same body, same headers. A scanner sweeping the prefix cannot tell
`/api/public/csp-dashboard` from `/api/public/nonsense`, so it learns nothing
from the sweep.

| Situation                                             | What the caller sees              |
| ----------------------------------------------------- | --------------------------------- |
| No credential presented                               | 404, identical to a missing route |
| Unusable credential                                   | 404, identical to a missing route |
| Credential presented and rejected                     | 404, identical to a missing route |
| Over the flood cap, not yet authenticated             | 404, identical to a missing route |
| Unsupported method on a gated route                   | 404, identical to a missing route |
| Over the flood cap, after authenticating              | 429, `cache-control: no-store`    |
| Stale timestamp or reused nonce, after authenticating | 403, `reason: replayed`           |

The dividing line is authentication, not the kind of mistake. Once a caller has
shown the right token it is a known party, and hiding failures from it would
only make its own outages hard to debug, so it gets the honest 429 or 403 with a
JSON `reason`. Before that point there is no honest answer to give, because
answering at all is the leak.

This costs a legitimate caller some clarity: a scheduler with a mistyped token
sees a 404 and cannot tell a bad credential from a bad URL. Read
`/api/public/guard-metrics`, where the real reason (`missing`, `malformed`,
`invalid`, `rate_limited`) is recorded per endpoint against a caller digest.
That is the intended debugging path, and it is itself gated.

"Unusable" covers an empty `Authorization` header, a scheme that is not
`Bearer`, a comma separated list, a value with control characters, a token over
`MAX_TOKEN_LENGTH` (512), and an empty `?token=`. The `?token=` query fallback
exists for the database scheduler, which cannot set headers; prefer the header
everywhere else, since query strings land in logs.

`csp-report` is the exception, and deliberately so. Browsers post to it
unauthenticated, its existence is published in the CSP header itself, and there
is nothing to hide: it answers an unsupported method with a plain 405 and an
`Allow` header.

### Declaring the methods you do not serve

An undeclared method falls through to the app shell, which answers 200 and marks
the route as real. Gated routes therefore declare every method and hand the ones
they do not serve to `cloakedHandler()`; `csp-report` uses `methodNotAllowed()`.

```ts
import { cloakedHandler, guardPublicRequest } from "@/lib/api-guard";

handlers: {
  GET: async ({ request }) => { /* ... */ },
  POST: cloakedHandler(),
  PUT: cloakedHandler(),
  PATCH: cloakedHandler(),
  DELETE: cloakedHandler(),
}
```

`cloakedNotFound()` builds the disguise by fetching a genuinely missing path
once per worker and reusing the response, rewriting the echoed path so the body
length matches what the caller would have received. It falls back to a plain 404
if that sample cannot be taken.

## Comparing secrets

Never compare a presented token with `===`. `guardPublicRequest` already uses
`secretEquals`, which compares fixed width SHA-256 digests so neither the length
of the expected value nor the position of the first differing byte is
observable in the response timing. If you compare a secret anywhere else, for
example a signature you verify yourself, use the same helper:

```ts
import { secretEquals } from "@/lib/api-guard";

if (!(await secretEquals(presented, expected))) return authFailure("invalid");
```

`timingSafeEqual` is the lower level primitive for two values that are already
known to be the same length; `secretEquals` is the right default.

## Tests you inherit, and the one you must write

`src/lib/api-public.integration.test.ts` drives the real route handlers and
asserts, for every endpoint, that the token checks, the timing safe comparison
and the rate limit behave as described above. It globs the route directory and
**fails when a new `/api/public/*` file is not listed**, so adding an endpoint
means adding its entry:

```ts
{
  name: "my-endpoint",
  file: "my-endpoint.ts",
  method: "POST",
  gated: true,
  max: 20,                 // must match the rateLimit you declared
  accepts: "env" as const, // "env" | "internal" | "both"
}
```

That one entry generates the whole matrix for the new route. `e2e/api-public.spec.ts`
adds a wire level check that the same refusals hold over real HTTP.

Run both with `npm run qa:unit` and `npx playwright test e2e/api-public.spec.ts`;
`npm run qa:all` runs them alongside the other pre-publish gates.

## Checklist

- [ ] Route file under `src/routes/api/public/`, only the methods it should answer
- [ ] `guardPublicRequest` is the first statement in every handler, and its result is returned
- [ ] Explicit `bucket` and a `rateLimit` sized for the noisiest legitimate caller
- [ ] `envSecret` and/or `internalToken` set unless the endpoint is genuinely open
- [ ] `headers` passed if the success path sets CORS
- [ ] Server-only modules imported inside the handler
- [ ] No PII on the response, and no secret echoed in an error
- [ ] Endpoint added to the table in `src/lib/api-public.integration.test.ts`

## Logging and metrics

You do not wire this up: `guardPublicRequest` records every decision itself, so
a new endpoint is observable the moment it uses the guard. The `bucket` name is
the label it is reported under, which is the other reason to always set one.

**Structured log.** One JSON line per decision, written by
`src/lib/api-guard-metrics.ts`:

```json
{
  "at": "2026-07-30T11:45:54.360Z",
  "log": "api-guard",
  "endpoint": "csp-dashboard",
  "outcome": "missing",
  "method": "GET",
  "caller": "25350f51",
  "gated": true,
  "durationMs": 0
}
```

Refusals go to `console.warn` and allowed requests to `console.debug`, so a log
search for `"log":"api-guard"` at warn level shows only the interesting traffic.
`outcome` is one of `allowed`, `rate_limited`, `missing`, `malformed`,
`invalid`, `replayed` — the same closed set the guard answers with, so a spike
in `invalid` on one endpoint reads as token guessing, and a spike in
`rate_limited` reads as a flood or a cap that is set too tight.

`caller` is a short non-reversible digest of the caller key, never the address.
It is enough to see that one source produced every refusal without putting an
IP in the log. Tokens are never logged in any form.

**Counters.** `GET /api/public/guard-metrics`, gated by `CSP_REPORTS_TOKEN`
like the CSP dashboard, returns per-endpoint totals, the outcome breakdown,
distinct caller count, and last refusal time. Add `?format=prometheus` for text
exposition (`api_guard_requests_total{endpoint,outcome}` and
`api_guard_callers{endpoint}`) if you want to scrape it.

The counters live in the worker isolate, so a reading covers one instance since
it started, not the fleet, and both the endpoint and caller maps are bounded
the same way the rate limit buckets are. Treat the counters as a live gauge and
the log lines as the durable record.
