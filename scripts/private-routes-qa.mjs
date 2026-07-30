#!/usr/bin/env node
/**
 * Keeps internal pages out of the consumer-facing surface.
 *
 * Sign-in, the account page, the staff insights view, the researcher security
 * policy and the token gated landing pages are not product pages. They must
 * stay out of sitemap.xml, stay disallowed in robots.txt, and carry a robots
 * noindex tag of their own so a stray link cannot get them indexed.
 *
 * Three layers are checked, because any one of them can regress alone:
 *   1. policy  - src/lib/sitemap-routes.ts still classifies each private route
 *                as non indexable, and every route in the generated tree has a
 *                classification at all
 *   2. source  - each private page route file declares `robots: noindex`
 *   3. surface - onsite search and the related-link graph only point at
 *                public product pages
 *   4. served  - the running site's sitemap.xml, robots.txt and page HTML agree
 *   5. crawl   - no public page links to a private route, so a crawler that
 *                only follows links can never discover one
 *   6. hidden  - staff only routes answer a signed out visitor with a 404 that
 *                leaks none of their content
 *
 * Usage: node scripts/private-routes-qa.mjs [--base http://localhost:8080]
 * Exits 1 on any error so it can gate publishing.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseArg = process.argv.indexOf("--base");
const BASE = (baseArg > -1 ? process.argv[baseArg + 1] : "http://localhost:8080").replace(
  /\/$/,
  "",
);

/**
 * Routes that must never become indexable, whatever else changes. The policy
 * file is the working source of truth; this list is the guard rail that stops
 * someone flipping one of these to `indexable` without noticing.
 */
const MUST_STAY_PRIVATE = [
  "/auth",
  "/account",
  "/insights",
  "/security",
  "/privacy/verify",
  "/waitlist/confirm",
];

/**
 * Routes that exist only for staff. Their gate runs in the browser, so the
 * server sends an empty app shell and the page itself resolves to the ordinary
 * not-found screen. What matters here is that the shell hands a stranger (or a
 * crawler, which runs no JavaScript) none of the page's own content.
 */
const STAFF_ONLY = [
  { route: "/insights", absent: ["signups", "cohort", "search console", "product interest"] },
];

const errors = [];
const warnings = [];
const err = (scope, msg) => errors.push({ scope, msg });
const failed = (scope) => errors.some((e) => e.scope === scope);

const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

/** Every route path the router can serve, from the generated tree. */
function generatedRoutePaths() {
  const src = read("src/routeTree.gen.ts");
  const block = /interface FileRoutesByTo\s*\{([\s\S]*?)\n\}/.exec(src);
  if (!block) throw new Error("FileRoutesByTo not found in src/routeTree.gen.ts");
  return [...block[1].matchAll(/^\s*'([^']+)'\s*:/gm)].map((m) => m[1]);
}

/** path -> isIndexable, as declared in src/lib/sitemap-routes.ts. */
function routePolicy() {
  const src = read("src/lib/sitemap-routes.ts");
  const block = /ROUTE_POLICY[^=]*=\s*\{([\s\S]*?)\n\};/.exec(src);
  if (!block) throw new Error("ROUTE_POLICY not found in src/lib/sitemap-routes.ts");
  const policy = new Map();
  for (const m of block[1].matchAll(/^\s*"([^"]+)":\s*(indexable|excluded)\(/gm)) {
    policy.set(m[1], m[2] === "indexable");
  }
  return policy;
}

/** Served path -> route file, read from each createFileRoute call. */
function routeFiles() {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name)) files.push(full);
    }
  };
  walk(path.join(ROOT, "src/routes"));

  const byPath = new Map();
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const m = /createFileRoute\(\s*["']([^"']+)["']\s*\)/.exec(src);
    if (!m) continue;
    // Layout segments are stripped from the URL, so the route declared as
    // /_authenticated/account is served at /account.
    const served = m[1].replace(/\/_[^/]+/g, "") || "/";
    byPath.set(served, { file: path.relative(ROOT, file), src });
  }
  return byPath;
}

function checkPolicy(policy, generated) {
  const scope = "policy";
  for (const route of generated) {
    if (!policy.has(route)) err(scope, `route ${route} has no entry in ROUTE_POLICY`);
  }
  for (const route of MUST_STAY_PRIVATE) {
    if (!policy.has(route)) {
      err(scope, `${route} is missing from ROUTE_POLICY, so nothing keeps it private`);
      continue;
    }
    if (policy.get(route)) err(scope, `${route} is marked indexable but must stay private`);
  }
  console.log(
    `[${failed(scope) ? "FAIL" : "ok  "}] policy       ${generated.length} route(s) classified, ${MUST_STAY_PRIVATE.length} pinned private`,
  );
}

/** Non indexable routes that are real pages, so a crawler could reach them. */
function privatePages(policy) {
  return [...policy.entries()]
    .filter(([route, isIndexable]) => {
      if (isIndexable) return false;
      if (route === "/$") return false; // the 404 handler, not a page of its own
      if (route.startsWith("/api/")) return false; // machine endpoints, no HTML
      if (route.includes(".")) return false; // robots.txt, sitemap.xml, security.txt
      return true;
    })
    .map(([route]) => route);
}

function checkSource(pages, files) {
  const scope = "source";
  for (const route of pages) {
    const entry = files.get(route);
    if (!entry) {
      err(scope, `no route file found for ${route}`);
      continue;
    }
    if (!/name:\s*["']robots["'][^}]*noindex/.test(entry.src)) {
      err(scope, `${entry.file} does not declare a robots noindex tag for ${route}`);
    }
  }
  console.log(
    `[${failed(scope) ? "FAIL" : "ok  "}] source       ${pages.length} private page(s) declare noindex`,
  );
}

/** The public destinations declared in src/lib/sitemap-routes.ts. */
function publicRoutes() {
  const src = read("src/lib/sitemap-routes.ts");
  const block = /PUBLIC_ROUTES[^=]*=\s*\[([\s\S]*?)\];/.exec(src);
  if (!block) throw new Error("PUBLIC_ROUTES not found in src/lib/sitemap-routes.ts");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/**
 * Onsite search, the related-link graph and the post signup links may only
 * point at public product pages. A private route reaching any of them would
 * hand visitors a door to an internal page and feed crawlers an internal link.
 */
function checkSurface(policy, pages) {
  const scope = "surface";
  const allowed = publicRoutes();

  for (const route of allowed) {
    if (!policy.has(route)) {
      err(scope, `PUBLIC_ROUTES lists ${route}, which has no entry in ROUTE_POLICY`);
    } else if (!policy.get(route)) {
      err(scope, `PUBLIC_ROUTES lists ${route}, but the policy marks it private`);
    }
  }

  const sources = [
    { file: "src/lib/search-index.ts", label: "onsite search", pattern: /\bto:\s*"([^"]+)"/g },
    { file: "src/lib/related-links.ts", label: "related links", pattern: /"(\/[^"]*)"\s*:/g },
  ];
  let destinations = 0;
  for (const { file, label, pattern } of sources) {
    const src = read(file);
    for (const match of src.matchAll(pattern)) {
      const route = match[1];
      destinations += 1;
      if (!allowed.includes(route)) {
        err(scope, `${label} (${file}) points at ${route}, which is not a public page`);
      }
    }
    // Catch a private path written anywhere in these files, including inside
    // graph arrays and keyword strings.
    for (const route of pages) {
      if (new RegExp(`["'\`]${route}(?=["'\`/#?])`).test(src)) {
        err(scope, `${label} (${file}) mentions the private route ${route}`);
      }
    }
  }

  console.log(
    `[${failed(scope) ? "FAIL" : "ok  "}] surface      ${destinations} search and link destination(s), all public`,
  );
}

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": "vouchlist-private-routes-qa" } });
  return { status: res.status, headers: res.headers, text: await res.text() };
}

async function checkSitemap(pages) {
  const scope = "sitemap.xml";
  const res = await get(`${BASE}/sitemap.xml`);
  if (res.status !== 200) {
    err(scope, `responded ${res.status}`);
    return;
  }
  const locs = [...res.text.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map((m) => m[1].trim());
  const paths = locs.map((loc) => {
    try {
      return new URL(loc).pathname.replace(/(.)\/$/, "$1");
    } catch {
      err(scope, `entry "${loc}" is not an absolute URL`);
      return loc;
    }
  });
  for (const route of pages) {
    if (paths.includes(route)) err(scope, `lists private route ${route}`);
  }
  console.log(
    `[${failed(scope) ? "FAIL" : "ok  "}] sitemap.xml  ${locs.length} URL(s), no private route listed`,
  );
}

async function checkRobots(pages) {
  const scope = "robots.txt";
  const res = await get(`${BASE}/robots.txt`);
  if (res.status !== 200) {
    err(scope, `responded ${res.status}`);
    return;
  }
  // A Disallow only applies to the User-agent block it sits under, so each
  // block is read on its own rather than searching the file as one blob.
  const blocks = [];
  let current = null;
  for (const raw of res.text.split(/\r?\n/)) {
    const line = raw.trim();
    const ua = /^user-agent:\s*(.+)$/i.exec(line);
    if (ua) {
      if (!current) {
        current = { agents: [], disallow: [] };
        blocks.push(current);
      }
      current.agents.push(ua[1].trim());
      continue;
    }
    const dis = /^disallow:\s*(.*)$/i.exec(line);
    if (dis && current) {
      current.disallow.push(dis[1].trim());
      continue;
    }
    if (!line) current = null; // a blank line closes the block
  }

  if (!blocks.length) {
    err(scope, "no User-agent block found");
    return;
  }
  if (!blocks.some((b) => b.agents.includes("*"))) err(scope, "no wildcard (User-agent: *) block");

  for (const block of blocks) {
    const who = block.agents.join(", ");
    if (block.disallow.includes("/"))
      err(scope, `User-agent: ${who} is blocked from the whole site`);
    for (const route of pages) {
      const covered = block.disallow.some(
        (rule) => rule && route.startsWith(rule.replace(/\*$/, "")),
      );
      if (!covered) err(scope, `${route} is not disallowed for User-agent: ${who}`);
    }
  }
  console.log(
    `[${failed(scope) ? "FAIL" : "ok  "}] robots.txt   ${blocks.length} block(s) disallow every private route`,
  );
}

async function checkServedPages(pages) {
  const scope = "served";
  for (const route of pages) {
    const res = await get(`${BASE}${route}`);
    if (res.status >= 500) {
      err(scope, `${route} responded ${res.status}`);
      continue;
    }
    // A header protects every fetch of the URL, not just a rendered page.
    const tag = (res.headers.get("x-robots-tag") ?? "").toLowerCase();
    if (!tag) err(scope, `${route} sends no X-Robots-Tag header`);
    else if (!/noindex/.test(tag) || !/nofollow/.test(tag)) {
      err(scope, `${route} sends X-Robots-Tag "${tag}" instead of noindex, nofollow`);
    }
    // 404 is the right answer for a staff only route seen by a stranger, and
    // the 404 page is itself noindex, so the same tag check applies.
    const robots = /<meta[^>]+name=["']robots["'][^>]*>/i.exec(res.text);
    if (!robots) {
      err(scope, `${route} serves no robots meta tag (status ${res.status})`);
      continue;
    }
    if (!/noindex/i.test(robots[0]))
      err(scope, `${route} serves "${robots[0]}" instead of noindex`);
  }
  console.log(
    `[${failed(scope) ? "FAIL" : "ok  "}] served       ${pages.length} private page(s) send noindex (meta + header)`,
  );
}

/**
 * The header must be narrow: internal URLs, machine endpoints and 404s carry
 * it, public product pages and the crawler files must not, or the whole site
 * would fall out of search.
 */
async function checkRobotsHeader(policy) {
  const scope = "x-robots-tag";
  const publicPages = [...policy.entries()].filter(([, ok]) => ok).map(([route]) => route);
  const mustCarry = [
    ...[...policy.entries()]
      .filter(([route, ok]) => !ok && route.startsWith("/api/"))
      .map(([route]) => route),
    "/this-route-does-not-exist",
  ];
  const mustNotCarry = [...publicPages, "/robots.txt", "/sitemap.xml", "/.well-known/security.txt"];

  for (const route of mustCarry) {
    const res = await get(`${BASE}${route}`);
    const tag = (res.headers.get("x-robots-tag") ?? "").toLowerCase();
    if (!/noindex/.test(tag)) err(scope, `${route} (status ${res.status}) sends no noindex header`);
  }
  for (const route of mustNotCarry) {
    const res = await get(`${BASE}${route}`);
    const tag = res.headers.get("x-robots-tag");
    if (tag)
      err(scope, `public URL ${route} sends X-Robots-Tag "${tag}" and would drop out of search`);
  }
  console.log(
    `[${failed(scope) ? "FAIL" : "ok  "}] x-robots-tag ${mustCarry.length} internal URL(s) noindexed, ${mustNotCarry.length} public URL(s) untouched`,
  );
}

/**
 * Crawlers discover pages by following links. Fetch every public page and make
 * sure none of its anchors points at a private route, so link discovery alone
 * can never reach an internal page.
 */
async function checkInternalLinks(policy, pages) {
  const scope = "crawl";
  const publicPages = [...policy.entries()]
    .filter(([route, ok]) => ok && !route.includes(".") && !route.startsWith("/api/"))
    .map(([route]) => route);

  let links = 0;
  for (const page of publicPages) {
    const res = await get(`${BASE}${page}`);
    if (res.status !== 200) {
      err(scope, `public page ${page} responded ${res.status}`);
      continue;
    }
    for (const match of res.text.matchAll(/<a\b[^>]*\shref=["']([^"']+)["']/gi)) {
      const href = match[1];
      if (!href.startsWith("/")) continue; // offsite or in-page anchor
      links += 1;
      const target = href.split(/[?#]/)[0].replace(/(.)\/$/, "$1");
      if (pages.includes(target)) {
        err(scope, `${page} links to the private route ${target}`);
      }
    }
  }
  console.log(
    `[${failed(scope) ? "FAIL" : "ok  "}] crawl        ${links} internal link(s) across ${publicPages.length} public page(s), none private`,
  );
}

/** Readable text only: markup, scripts, styles and asset URLs are not content. */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Staff pages must be invisible rather than merely unindexed. Their gate is
 * client side, so the checks are: the shell carries no staff content, it is
 * noindexed, and it never redirects to a sign-in screen that would confirm the
 * page exists. The rendered 404 for a signed out browser is covered by the
 * Playwright spec e2e/staff-routes.spec.ts.
 */
async function checkHiddenForStrangers() {
  const scope = "hidden";

  for (const { route, absent } of STAFF_ONLY) {
    const res = await get(`${BASE}${route}`);
    if (res.status >= 500) {
      err(scope, `${route} responded ${res.status}`);
      continue;
    }
    if (res.status >= 300 && res.status < 400) {
      err(scope, `${route} redirects (${res.status}), which confirms the page exists`);
    }
    const text = visibleText(res.text);
    for (const needle of absent) {
      if (text.includes(needle.toLowerCase())) {
        err(scope, `${route} shows the staff wording "${needle}" without JavaScript`);
      }
    }
    const tag = (res.headers.get("x-robots-tag") ?? "").toLowerCase();
    if (!/noindex/.test(tag)) err(scope, `${route} sends no noindex header to a stranger`);
  }
  console.log(
    `[${failed(scope) ? "FAIL" : "ok  "}] hidden       ${STAFF_ONLY.length} staff route(s) reveal nothing without a staff session`,
  );
}

async function run() {
  console.log(`Private route QA against ${BASE}\n`);
  const policy = routePolicy();
  const generated = generatedRoutePaths();
  const files = routeFiles();

  checkPolicy(policy, generated);
  const pages = privatePages(policy);
  checkSource(pages, files);
  checkSurface(policy, pages);

  try {
    await checkSitemap(pages);
    await checkRobots(pages);
    await checkServedPages(pages);
    await checkRobotsHeader(policy);
    await checkInternalLinks(policy, pages);
    await checkHiddenForStrangers();
  } catch (e) {
    err("served", `the site could not be reached (${e.message}). Is the dev server running?`);
  }

  console.log(`\nPrivate pages: ${pages.join(", ")}`);
  for (const w of warnings) console.log(`WARN  ${w.scope}: ${w.msg}`);
  for (const e of errors) console.log(`ERROR ${e.scope}: ${e.msg}`);
  if (errors.length) {
    console.log(`\n${errors.length} error(s). Internal routes must stay unindexed.`);
    process.exit(1);
  }
  console.log("No errors.");
}

run();
