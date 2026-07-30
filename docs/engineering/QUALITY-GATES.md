# Pre-publish quality gates

Last reviewed: July 2026.

Four Node scripts guard the site before publishing. Run all of them with `npm run qa:all`.
They exit non-zero on errors, so they can gate a deploy.

## `npm run qa:copy` (scripts/copy-qa.mjs)

Extracts user-facing prose from `src/routes` and `src/components`, then checks it for:

- em dashes, en dashes and typographic ellipses
- double spaces and stray spacing before punctuation
- sentence fragments and missing terminal punctuation
- inconsistent capitalisation and common typos
- repeated words and unbalanced quotes or brackets

Errors fail the run; stylistic notes are reported as warnings.

`npm run qa:copy:ai` adds an AI-assisted grammar pass over the same extracted prose for issues
heuristics cannot catch. It needs the Lovable AI gateway key in the environment.

## `npm run qa:seo` (scripts/seo-qa.mjs)

Fetches the server-rendered HTML of every public route and validates:

- title length 15 to 60 characters, unique per route
- meta description length 50 to 160 characters, unique per route
- exactly one `<h1>` per page
- one self-referencing canonical, matching `og:url`
- absolute `og:image` and `twitter:image` URLs with alt text and `summary_large_image`
- valid `application/ld+json`, including `@graph` containers, with every `@id` reference
  resolving inside the same block
- a `BreadcrumbList` on every route, starting at home and ending at the current page
- `FAQPage` entries matching the on-page FAQ text exactly
- `sitemap.xml` well-formedness and `robots.txt` presence

## `npm run qa:private` (scripts/private-routes-qa.mjs)

Keeps internal pages off the consumer surface. Sign-in, the account page, the staff insights
view, the researcher security policy and the token-gated confirmation pages are never product
pages, and this gate proves it at several levels that can regress independently:

- **policy**: every route in the generated route tree has a decision in `ROUTE_POLICY`
  (`src/lib/sitemap-routes.ts`), and each pinned private route is still marked non-indexable.
  Flipping one to `indexable` fails the run even if nothing else changes.
- **source**: each private page's route file declares `robots: noindex` in its own `head()`, so
  the page protects itself independently of the sitemap.
- **surface**: onsite search (`src/lib/search-index.ts`) and the related-link graph
  (`src/lib/related-links.ts`) only point at routes listed in `PUBLIC_ROUTES`, and neither file
  so much as mentions a private path. Both files also type their destinations as
  `PublicRoutePath`, so a private link fails typecheck before it ever reaches this gate.
- **served**: the running site's `sitemap.xml` lists no private path, every `User-agent` block in
  `robots.txt` disallows each of them, and each page responds with a `noindex` robots meta tag.
  A staff-only route answering 404 to a stranger passes, because the 404 page is noindex too.
- **x-robots-tag**: every internal URL also answers with
  `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` (see
  `src/lib/robots-header.ts`), so a direct fetch is covered even when no HTML is rendered. Machine
  endpoints under `/api/public/` and any 404 carry it too. Public product pages, `robots.txt`,
  `sitemap.xml` and `.well-known/security.txt` must NOT carry it, and the gate fails if they do.
- **crawl**: every public page is fetched and its internal `<a href>` values are collected. A link
  to any private route fails the run, so a crawler that only follows links can never discover one.
- **hidden**: staff-only URLs (`STAFF_ROUTE_PREFIXES` in `src/lib/staff-routes.ts`) reveal nothing
  without a staff session. Their gate runs in the browser, so the script checks the served shell:
  no redirect (a bounce to sign-in would confirm the page exists), no staff wording in the visible
  text, and a `noindex` header. The page title in `head()` is deliberately generic for the same
  reason.

`e2e/staff-routes.spec.ts` completes the picture in a real browser: a signed-out visitor at
`/insights` stays on that URL and sees the ordinary 404 screen with none of the page's content,
the home page carries no link to a staff route, and onsite search returns no staff result.

A new non-indexable page is picked up automatically: it is derived from the route policy rather
than a second hand-kept list. The pinned list inside the script only guards the routes that must
never change classification.

## `npm run qa:links` (scripts/link-qa.mjs)

Crawls the rendered HTML of every public route, collects `href` and `src` values, and requests
each one. Internal 404s, broken assets and broken sitemap entries fail the run. External link
failures are reported as warnings, since they can be transient. The script also asserts that an
unknown URL still returns a real HTTP 404.

## `npm run qa:security` (scripts/security-qa.mjs)

Requests every public route, plus `robots.txt`, `sitemap.xml` and an unknown URL, and asserts
each response carries the site-wide security headers:

- `Content-Security-Policy`: requires `default-src`, `script-src`, `style-src`, `img-src`,
  `connect-src`, `frame-ancestors`, `base-uri`, `form-action` and `object-src`; rejects a
  wildcard `default-src`, `frame-ancestors` weaker than `'self'`, an unlocked `base-uri`, and
  an `object-src` that is not `'none'`. `'unsafe-inline'` in `script-src`, `style-src` or
  `style-src-elem` fails the gate, and a `'nonce-...'` source is required in `script-src`.
  `'unsafe-eval'` in any directive fails the gate, in every mode and environment. Wildcard
  sources are reported as warnings.
- CSP nonces: every HTML response must reuse its header nonce on all inline `<script>` and
  `<style>` elements, and no nonce may repeat across requests.
- `Strict-Transport-Security`: `max-age` of at least 180 days, with `includeSubDomains` and
  `preload` recommended.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a strict `Referrer-Policy`,
  `Permissions-Policy`, `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy`.
- Flags `X-Powered-By` if a host ever adds it.
- Report sink: `POST /api/public/csp-report` must accept a valid violation report with `204`,
  reject malformed JSON with `400`, and reject a non-JSON content type with `415`.
- Rollout mode: the gate accepts either `Content-Security-Policy` or
  `Content-Security-Policy-Report-Only`. Report-only is a warning by default; run
  `node scripts/security-qa.mjs --require-enforce` to fail the build unless CSP is enforced.

### CSP report-only rollout

Set `CSP_MODE=report-only` (or `CSP_REPORT_ONLY=1`) to send the strict policy as
`Content-Security-Policy-Report-Only`. Browsers then evaluate the policy without blocking
anything and POST every violation to `/api/public/csp-report`, which is rate limited
(60 requests per minute per client), capped at 16 KB per request, and logs a one-line
`[csp] ...` warning per violation. Watch the reports, fix any legitimate violation, then
remove the flag (or set `CSP_MODE=enforce`) to enforce.

### Where violations show up

Each accepted report is written three ways, so a violation is never invisible:

1. A structured `[csp] <mode> <directive> blocked <uri> on <page>` line in the server logs.
2. A short in-memory ring buffer (last 200) for the current worker.
3. A durable row in the `csp_reports` table, which is the only view that survives a
   deploy or a request landing on a different worker.

Read them back at `GET /api/public/csp-dashboard`, which groups identical violations
(directive + blocked URI + page + source line) into one row with a count, first-seen and
last-seen. `?format=html` renders a small dashboard, otherwise it returns JSON;
`?hours=N` sets the window (default 168, i.e. one week).

The route sits under `/api/public/*`, which bypasses site auth, so it gates itself on the
`CSP_REPORTS_TOKEN` secret — sent either as `Authorization: Bearer <token>` or `?token=`.
Anything without a valid token gets a plain `404`, so the endpoint does not announce itself
to a scanner. Reports store the page, the blocked resource, the source location and the
user agent only: no IP address, no cookies, no session.

### CSP spike alerts

`POST /api/public/csp-alert-check` runs the spike detector. A scheduled job calls it every
15 minutes; the scheduler cannot read runtime secrets, so it presents a key held in
`internal_tokens`. The dashboard token is accepted too, and anything else gets a `404`.

A violation alerts when it fired at least 10 times in the last 15 minutes **and** is either
brand new (unseen in the previous 24 hours) or at least 4x its own baseline rate for that
window. 100 or more in a window is `critical` rather than `warning`. The same violation is
not re-alerted for an hour, so a persistent script does not notify every cycle.

Every alert is written to `csp_alerts` before delivery, so a failing notification loses the
message and never the evidence. Alerts always log (`[csp-alert] …`); when
`CSP_ALERT_WEBHOOK_URL` is set they are also posted as `{ text, severity, fingerprint,
windowCount, baselineCount }`, which Slack, Teams and most generic sinks accept. Recent
alerts appear under the violations table on the dashboard.

The policy itself lives in `src/lib/security-headers.ts` and is applied to every response in
`src/server.ts`, so routes, text endpoints and error pages are all covered. `robots.txt` is
served from `src/routes/robots[.]txt.ts` rather than `public/` for the same reason.
`'unsafe-eval'` is never added, in any environment: the policy has no dev-only exception, and
the gate fails if it ever reappears.

Each response gets a fresh random nonce, generated in `src/server.ts` and stamped onto every
inline `<script>` and `<style>` element (streamed through `HTMLRewriter` in production). A small
bootstrap script in `src/routes/__root.tsx` publishes that nonce to runtime style injectors, so
dialogs and scroll locks style themselves without `'unsafe-inline'`. `style-src-attr` keeps
`'unsafe-inline'` because `style="..."` attributes cannot carry a nonce.

## `npm run qa:deps` (scripts/deps-qa.mjs)

Supply-chain gate that runs right after the header check. It reads `bun.lock`, resolves every
installed package and version (direct and transitive), and queries the public npm advisory
database in batches of 200, the same data source `npm audit` uses.

- Advisories rated `high` or `critical` fail the run and block publishing.
- `moderate` and `low` advisories are printed as warnings.
- `--level moderate` tightens the gate, `--json` prints a machine-readable report.
- Network failures exit with code 2, so a flaky registry is never reported as a clean scan.

False positives and accepted risks go in `scripts/deps-allowlist.json`, keyed by GHSA id or by
package name, each with a written reason. Real fixes are upgrades: bump the package in
`package.json` (an `overrides` entry when the vulnerable package is transitive) and re-run
`bun install --save-text-lockfile`. `brace-expansion` and `js-yaml` are pinned through
`overrides` for exactly that reason.

## `npm run qa:secrets` (scripts/secrets-qa.mjs)

Secret hygiene gate. It fails the run when any of the following is true:

- `.gitignore` no longer covers a required category: dependencies, build output, Wrangler and
  `.dev.vars`, local env files, certificates and private keys, service account JSON, editor and
  OS junk, test artefacts, coverage and TypeScript build info.
- A tracked source file contains something that looks like a credential: a private key block, a
  Supabase secret key or service-role JWT, a Stripe secret key, a GitHub, AWS, Google or Slack
  token.
- `.env` holds a variable whose name implies a private value (`SERVICE_ROLE`, `SECRET`,
  `PRIVATE`, `PASSWORD`, `*_TOKEN`).

Only publishable values belong in `.env` (project id, project URL, publishable key). Private
credentials are stored as project secrets and read from the server runtime, never committed.

## `npm run qa:rls` (scripts/rls-qa.mjs)

Database access gate. It reads the live schema through `psql` and asserts that the tables
holding waitlist and CSP report data stay closed to the public Data API. `waitlist`,
`waitlist_throttle` and `csp_reports` are gated, so a problem there fails the run:

- the table exists in the `public` schema and row level security is enabled
- at least one policy exists, and every policy covering `anon` or `authenticated` denies by
  default, meaning both its `USING` and `WITH CHECK` expressions resolve to `false`
- `anon`, `authenticated` and `PUBLIC` hold no select, insert, update or delete privilege
- `service_role` still holds all four, so the server functions keep working

`privacy_requests`, `csp_alerts` and `internal_tokens` run through the same checks as warnings.
They carry legacy `anon` and `authenticated` grants that the deny-all policies neutralise, and
the warnings keep that visible until the grants are revoked.

The gate needs the managed database environment. Without `PGHOST` it exits 1 rather than
reporting a clean scan.

Both colour themes are audited: every route runs twice per viewport, light and dark, because
either one can be the visitor's choice.

## `npm run qa:spam` (scripts/spam-qa.ts)

Waitlist abuse gate, run with Bun so it can import the real server module.

Guards it exercises directly:

- Honeypot: a visually hidden, `tabIndex={-1}` field that only automation fills.
- Timing: submissions faster than 2.5 seconds are rejected.
- Content: links or bbcode in the name, community and city fields, disposable email domains,
  and repeated-character names.
- Rate limits: 5 per hour and 15 per day per address, 3 per day per email, counted in the
  `waitlist_throttle` table. Keys are SHA-256 buckets, so raw addresses and emails are never
  stored. A throttle read error fails closed. Loopback and private addresses skip the
  address limit so local development and repeated test runs are not blocked; email limits
  still apply.

Wiring checks that the protection cannot be bypassed: the browser module must not write to the
waitlist table, the form must still render the honeypot and send submit timing, and the server
function must call validation, bot detection and the limiter.

Row level security backs this up. Visitors have no insert grant on the waitlist table, so the
only write path is the server function, and a duplicate email is rejected by a unique index.

Rate limiting is application level rather than edge level: it counts attempts in the database
per request. It stops scripted floods and repeat signups, but it is not a substitute for an
edge WAF against a large distributed attack.

## `npm run qa:a11y` (scripts/a11y-qa.mjs)

Runs axe-core in headless Chromium against every public route, the 404 page and the open
waitlist dialog, at both a desktop (1280x900) and a mobile (390x844) viewport. Rules are limited
to WCAG 2.0, 2.1 and 2.2 level A and AA (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`),
which covers the 2.2 additions such as focus appearance, dragging alternatives and target size.

- Violations with impact `critical` or `serious` fail the run and block publishing.
- `moderate` and `minor` violations are printed as warnings.
- Axe "incomplete" results are printed as manual review notes; they need a human decision and do
  not fail the run.
- `--strict` also fails on `moderate`; `--base <url>` audits a different origin.

Because scroll-triggered reveal animations start elements at low opacity, the script scrolls each
page to the bottom and back before auditing so contrast is measured on settled content.

## `npm run qa:a11y:forms` (scripts/a11y-form-qa.mjs)

The site-wide audit only ever sees the waitlist form at rest, and forms usually fail
accessibility in their error states. This gate drives both renderings of the form, the inline one
on the home page and the one inside the dialog, through every state a visitor can reach, in light
and dark themes at desktop and mobile sizes (36 form states in total):

1. resting
2. empty required fields after a submit attempt
3. a malformed email address
4. a server rejection (a link in the name is treated as spam), which has no field-level cue
5. the success panel after a real submission

Each state is checked with axe-core on the same WCAG 2.0/2.1/2.2 A and AA rule set, plus
behavioural assertions axe cannot make:

- every visible control has an accessible name from a `label` or `aria-label`;
- `aria-describedby` never points at an element that does not exist;
- controls are only marked `aria-invalid` after a failed submit, and an invalid control always has
  describing error text;
- an error state renders a `role="alert"` region with real text, so the failure is announced and
  is not signalled by colour alone;
- focus moves to the first invalid field, and to the rejection message when the block is
  form level, so keyboard users never lose their place;
- controls meet the WCAG 2.2 target size minimum, and carry focus-visible styling;
- the success panel is a live region, so the confirmation is announced.

Contrast is resolved rather than deferred. Axe leaves `color-contrast` "incomplete" whenever a
node's centre point is clipped out of a scrolling container, which happens every time the dialog
scrolls itself to the first error and pushes the fields above it out of view. The gate reacts by
scrolling each such node fully into view and re-running the contrast rule on that node alone: a
node that passes is resolved, a node that fails becomes an error, and only a node that still
cannot be measured is left as a note.

`--strict` also fails on `moderate`; `--base <url>` audits a different origin. The run currently
reports zero errors, zero warnings and zero manual review items.

## `npm run qa:e2e` (Playwright, `e2e/`)

Runs a headless Chromium smoke suite against the running site (`playwright.config.ts` starts the
dev server, or reuses one already listening on `http://localhost:8080`; override with
`E2E_BASE_URL`).

- `e2e/pages.spec.ts`: every public route returns 200, renders exactly one `h1`, shows the
  primary navigation and a VouchList title, and logs no console errors or uncaught exceptions.
  An unknown URL still returns a real 404 with working recovery links.
- `e2e/cta.spec.ts`: header navigation reaches each section, the hero "See how it works" anchor
  scrolls to the section, the waitlist dialog blocks invalid submissions with visible field
  errors, and a full waitlist submission reaches the backend and renders the confirmation.
- `e2e/waitlist-backend.spec.ts`: persistence check. It asserts the backend insert returns HTTP
  201, the confirmation renders, and then reads the stored row back and compares every field
  (name, normalised email, community, city, role, generated id, recent `created_at`). A second
  test confirms an invalid email is rejected before it ever reaches the store.
- `e2e/analytics-waitlist.spec.ts`: conversion tracking. A real submission must produce a
  `waitlist_signup` analytics event carrying the submitted metadata (city, role, whether a
  community was named, duplicate flag) plus the backend-minted `event_id`, a `generate_lead`
  event for new signups only, and no raw email address anywhere in the payload. gtag.js is
  stubbed at the network layer so the assertion never depends on Google being reachable.
- `e2e/a11y-waitlist.spec.ts`: accessibility regression tests for the waitlist form. Where the
  publish gate above sweeps broadly across themes and viewports, these pin the five states that
  are easy to break in a later refactor: idle, in flight, client validation errors, a spam block
  and a rate limited reply. Each state is scanned with axe on the WCAG 2.2 AA rule set and then
  asserted on behaviour: the in-flight state holds the server response open so the run can check
  `aria-busy`, the polite progress region and the still-named disabled button; the spam block and
  the rate limit must announce a real message through `role="alert"` and take focus, because
  neither has a field to attach an error to; and a rate limited form must stay editable rather
  than looking like a validation failure.

The end-to-end submission writes a real waitlist row using a unique `@vouchlist.test` address, so
runs never collide with each other or with real signups.

Waitlist rows are insert-only for visitors, so the read-back in `e2e/backend.ts` uses the
server-side key (`SUPABASE_SERVICE_ROLE_KEY` plus `SUPABASE_URL`). When that key is not present,
the verification step skips rather than failing, and the response-level assertions still run.

## Adding a route

A new public route needs, in the same change: its own `head()` with a unique title,
description, canonical, `og:url`, and social images; a `BreadcrumbList`; an entry in
`src/routes/sitemap[.]xml.ts`; an entry in the `pages` list in `e2e/pages.spec.ts`; and a passing
`npm run qa:all`.

## `npm run qa:perf` (scripts/perf-qa.mjs)

Enforces the product performance budgets with Lighthouse. The script builds the app
(`npm run build`), serves the real production output with `wrangler dev`, then audits every
public route in headless Chromium. Dev-server numbers are not used, because unbundled modules
and missing minification make them meaningless.

Budgets, applied per route:

| Metric                       | Budget          |
| ---------------------------- | --------------- |
| Lighthouse performance score | greater than 95 |
| Largest Contentful Paint     | under 2500 ms   |
| First Contentful Paint       | under 1800 ms   |
| Speed Index                  | under 3400 ms   |
| Total Blocking Time          | under 200 ms    |
| Cumulative Layout Shift      | under 0.1       |

Any route that misses a budget is an error and exits 1, which blocks publishing.

Options:

- `--no-build` reuses an existing `dist/` build.
- `--base <url>` audits an already running origin instead of building and serving.
- `--mobile` switches to mobile emulation with slow 4G throttling.
- `--route /faq` audits a single route and can be repeated.

Local numbers run on unthrottled hardware, so treat them as a regression guard rather than a
prediction of field performance.

## `npm run qa:perf:dashboard` (scripts/perf-dashboard.mjs)

Every `qa:perf` run writes a machine readable report to `reports/perf/latest-<profile>.json`
and appends the run to `reports/perf/history.jsonl`. The dashboard script renders those
reports as a self-contained HTML page at `reports/perf/dashboard.html` for quick triage:

- a score dial per route, coloured green inside budget, amber within two points of it, red on failure
- an LCP bar drawn against the 2500 ms budget, with routes sorted slowest first
- a sparkline of the last twenty runs so a regression is visible as a rising line
- chips for FCP, TBT, Speed Index and CLS, each coloured against its own budget
- the list of budget failures for the run, and a desktop panel plus a mobile panel when both profiles have been measured

Usage:

- `npm run qa:perf:dashboard` runs the audit first, then renders and prints the `file://` link.
- `npm run qa:perf:report` re-renders from the reports already on disk without re-auditing.

`reports/` is git ignored, so dashboards stay local and never ship with the site.

## Image QA (`npm run qa:image`)

Runs first in `qa:all`. It fails the build when:

- any raster asset in `public/` or `src/assets/` exceeds the 200 KB paint budget
- a `.png` / `.jpg` ships without an `.avif` or `.webp` sibling
- an `<img>` in `src/` lacks `width`/`height`, `alt`, or a loading hint

Rendered raster images should go through `SmartImage`
(`src/components/site/SmartImage.tsx`), which negotiates AVIF then WebP then the
original file and always sets intrinsic dimensions so nothing shifts while loading.
