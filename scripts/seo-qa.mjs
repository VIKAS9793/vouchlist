#!/usr/bin/env node
/**
 * Automated SEO validation for every route.
 *
 * Fetches the server-rendered HTML for each route and validates:
 *   - <title> presence, length, uniqueness, no placeholder text
 *   - meta description presence, length, uniqueness
 *   - Open Graph + Twitter card tags (title, description, url, image, type, card)
 *   - canonical: exactly one, self-referencing, agrees with og:url
 *   - headings: exactly one <h1>, non-empty, no terminal punctuation
 *   - JSON-LD: parses, has @context/@type, and FAQPage entries match on-page copy
 *
 * Usage: node scripts/seo-qa.mjs [--base http://localhost:8080]
 * Exits 1 when any ERROR is found so it can gate publishing.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Single source of truth: src/lib/site.ts. Read rather than import so this
// script stays dependency-free and fails loudly if the constant disappears.
const SITE_ORIGIN = (() => {
  const src = readFileSync(path.join(ROOT, "src/lib/site.ts"), "utf8");
  const match = src.match(/SITE_ORIGIN\s*=\s*["'](https?:\/\/[^"']+)["']/);
  if (!match) throw new Error("SITE_ORIGIN not found in src/lib/site.ts");
  return match[1].replace(/\/$/, "");
})();
const baseArg = process.argv.indexOf("--base");
const BASE = (baseArg > -1 ? process.argv[baseArg + 1] : "http://localhost:8080").replace(
  /\/$/,
  "",
);

const LIMITS = {
  titleMin: 15,
  titleMax: 60,
  descMin: 50,
  descMax: 160,
};
const PLACEHOLDERS = [/lovable app/i, /lovable generated project/i, /untitled/i, /^home$/i];
// Routes that deliberately carry `noindex`, so the indexable-page rules
// (og:image, breadcrumbs, unique marketing copy) do not apply to them.
// /security is an internal disclosure policy for researchers, reached only
// through /.well-known/security.txt, so it is noindex like the sign-in pages.
const NOINDEX_ROUTES = new Set(["/auth", "/account", "/security"]);

const errors = [];
const warnings = [];
const err = (route, msg) => errors.push({ route, msg });
const warn = (route, msg) => warnings.push({ route, msg });

function discoverRoutes() {
  const files = readdirSync(path.join(ROOT, "src/routes"));
  const routes = [];
  for (const f of files) {
    if (!f.endsWith(".tsx")) continue;
    if (f.startsWith("__") || f.startsWith("-")) continue;
    if (f.includes("$")) continue; // dynamic routes need params; skip
    if (f === "index.tsx") {
      routes.push("/");
      continue;
    }
    const seg = f
      .replace(/\.tsx$/, "")
      .replace(/^_[^.]*\./, "")
      .replace(/\.index$/, "")
      .replace(/\./g, "/");
    if (!seg) continue;
    routes.push("/" + seg);
  }
  // Nested, indexable routes that live in a folder rather than a flat file.
  // Tokenised one-off pages (waitlist confirm, privacy verify) are noindex and
  // deliberately excluded.
  routes.push("/privacy/request");
  return [...new Set(routes)].filter((r) => !NOINDEX_ROUTES.has(r)).sort();
}

const decode = (s = "") =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

const textOf = (html) =>
  decode(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

function parseHead(html) {
  const metas = [];
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const attr = (name) => {
      const r = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
      return r ? decode(r[2] ?? r[3] ?? "") : undefined;
    };
    metas.push({ name: attr("name"), property: attr("property"), content: attr("content") ?? "" });
  }
  const meta = (key) => {
    const hit = metas.find((x) => x.name === key || x.property === key);
    return hit ? hit.content.trim() : undefined;
  };
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const canonicals = [...html.matchAll(/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/gi)].map(
    (m) => {
      const r = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(m[0]);
      return r ? decode(r[2] ?? r[3] ?? "") : "";
    },
  );
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => textOf(m[1]));
  const jsonld = [
    ...html.matchAll(
      /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ].map((m) => m[1]);
  const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  return {
    title: titleMatch ? textOf(titleMatch[1]) : undefined,
    meta,
    canonicals,
    h1s,
    jsonld,
    bodyText: textOf(bodyMatch ? bodyMatch[1] : html),
  };
}

function checkLength(route, label, value, min, max) {
  if (value.length < min)
    warn(route, `${label} is short (${value.length} chars, aim for ${min}-${max})`);
  if (value.length > max) err(route, `${label} is too long (${value.length} chars, max ${max})`);
}

function sameUrl(a, b) {
  if (!a || !b) return false;
  const norm = (u) => u.replace(/\/+$/, "") || "/";
  try {
    return norm(new URL(a, BASE).pathname) === norm(new URL(b, BASE).pathname);
  } catch {
    return norm(a) === norm(b);
  }
}

function validateJsonLd(route, blocks, bodyText) {
  if (blocks.length === 0) {
    warn(route, "no JSON-LD structured data on this route");
    return;
  }
  const seenTypes = new Set();
  blocks.forEach((raw, i) => {
    let data;
    try {
      data = JSON.parse(decode(raw));
    } catch (e) {
      err(route, `JSON-LD block #${i + 1} is not valid JSON (${e.message})`);
      return;
    }
    const top = Array.isArray(data) ? data : [data];
    for (const entry of top) {
      if (!entry["@context"]) err(route, `JSON-LD block #${i + 1} is missing "@context"`);
      else if (!String(entry["@context"]).includes("schema.org"))
        err(route, `JSON-LD block #${i + 1} has a non schema.org "@context"`);
    }
    // A block may be a single node, an array of nodes, or a @graph container.
    const nodes = top.flatMap((entry) =>
      Array.isArray(entry["@graph"]) ? entry["@graph"] : [entry],
    );
    // Collect every declared @id, including nested nodes such as logo ImageObject.
    const ids = new Set();
    const collect = (v) => {
      if (Array.isArray(v)) return v.forEach(collect);
      if (v && typeof v === "object") {
        if (v["@id"] && v["@type"]) ids.add(v["@id"]);
        Object.values(v).forEach(collect);
      }
    };
    collect(nodes);
    for (const node of nodes) {
      const type = node["@type"];
      if (!type) {
        err(route, `JSON-LD block #${i + 1} is missing "@type"`);
        continue;
      }
      if (seenTypes.has(type)) err(route, `duplicate JSON-LD "@type": ${type}`);
      seenTypes.add(type);

      // Every internal @id reference must resolve within the same block.
      const refs = JSON.stringify(node).match(/"@id":"(#[^"]*|[^"]*#[^"]*)"/g) ?? [];
      for (const ref of refs) {
        const id = ref.slice('"@id":"'.length, -1);
        if (!ids.has(id)) err(route, `JSON-LD ${type} references unresolved @id "${id}"`);
      }

      for (const [k, v] of Object.entries(node)) {
        if (v === undefined || v === null || v === "") err(route, `JSON-LD ${type}.${k} is empty`);
        if (typeof v === "string" && /^(https?:)?\/\/$/.test(v.trim()))
          err(route, `JSON-LD ${type}.${k} is not a usable URL`);
      }

      if (type === "FAQPage") {
        const entities = node.mainEntity;
        if (!Array.isArray(entities) || entities.length === 0) {
          err(route, "FAQPage has no mainEntity questions");
          continue;
        }
        entities.forEach((q, qi) => {
          const label = `FAQPage question #${qi + 1}`;
          if (q["@type"] !== "Question") err(route, `${label} is missing "@type": "Question"`);
          if (!q.name) err(route, `${label} is missing "name"`);
          const ans = q.acceptedAnswer;
          if (!ans || ans["@type"] !== "Answer" || !ans.text) {
            err(route, `${label} is missing a valid acceptedAnswer`);
            return;
          }
          const norm = (s) => textOf(s).replace(/\s+/g, " ").trim();
          if (q.name && !bodyText.includes(norm(q.name)))
            err(route, `${label} text is not on the page: "${q.name}"`);
          if (!bodyText.includes(norm(ans.text)))
            err(route, `${label} answer does not match the on-page answer exactly`);
        });
      }

      if (type === "BreadcrumbList") {
        const items = node.itemListElement;
        if (!Array.isArray(items) || items.length === 0) {
          err(route, "BreadcrumbList has no itemListElement");
          continue;
        }
        items.forEach((it, bi) => {
          const label = `BreadcrumbList item #${bi + 1}`;
          if (it["@type"] !== "ListItem") err(route, `${label} is missing "@type": "ListItem"`);
          if (it.position !== bi + 1)
            err(route, `${label} has position ${it.position}, expected ${bi + 1}`);
          if (!it.name) err(route, `${label} is missing "name"`);
          if (!it.item || !/^https?:\/\//.test(String(it.item)))
            err(route, `${label} needs an absolute "item" URL`);
        });
        if (!sameUrl(items[0].item ?? "", "/"))
          err(route, "BreadcrumbList must start at the home page");
        const last = items[items.length - 1].item ?? "";
        if (!sameUrl(last, route))
          err(route, `BreadcrumbList last item "${last}" does not match the current route`);
      }
    }
  });
  if (!seenTypes.has("BreadcrumbList")) err(route, "no BreadcrumbList JSON-LD on this route");
}

async function checkSitemapAndRobots(routes) {
  const scope = "sitemap/robots";
  try {
    const res = await fetch(`${BASE}/sitemap.xml`);
    if (!res.ok) {
      err(scope, `/sitemap.xml responded ${res.status}`);
    } else {
      const xml = await res.text();
      if (!/<urlset\b/.test(xml)) err(scope, "/sitemap.xml has no <urlset> element");
      const locs = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map((m) => decode(m[1]).trim());
      for (const route of routes) {
        if (!locs.some((l) => sameUrl(l || "/", route)))
          err(scope, `sitemap is missing route ${route}`);
      }
      for (const loc of locs) {
        if (!routes.some((r) => sameUrl(loc || "/", r)))
          err(scope, `sitemap lists unknown route "${loc}"`);
      }
      console.log(
        `[${errors.some((e) => e.route === scope) ? "FAIL" : "ok  "}] /sitemap.xml  ${locs.length} URL(s)`,
      );
    }
  } catch (e) {
    err(scope, `/sitemap.xml could not be fetched (${e.message})`);
  }

  try {
    const res = await fetch(`${BASE}/robots.txt`);
    if (!res.ok) {
      err(scope, `/robots.txt responded ${res.status}`);
      return;
    }
    const txt = await res.text();
    if (!/^user-agent:/im.test(txt)) err(scope, "robots.txt has no User-agent block");
    if (/^\s*disallow:\s*\/\s*$/im.test(txt))
      err(scope, 'robots.txt blocks all crawlers with "Disallow: /"');
    console.log(
      `[ok  ] /robots.txt  ${txt.split(/\r?\n/).filter(Boolean).length} directive line(s)`,
    );
  } catch (e) {
    err(scope, `/robots.txt could not be fetched (${e.message})`);
  }
}

async function run() {
  const routes = discoverRoutes();
  const titles = new Map();
  const descriptions = new Map();

  console.log(`SEO QA against ${BASE}`);
  console.log(`Routes: ${routes.join(", ")}\n`);

  for (const route of routes) {
    let html;
    try {
      const res = await fetch(`${BASE}${route}`, { headers: { "user-agent": "vouchlist-seo-qa" } });
      if (!res.ok) {
        err(route, `responded ${res.status}`);
        continue;
      }
      html = await res.text();
    } catch (e) {
      err(route, `could not be fetched (${e.message}). Is the dev server running?`);
      continue;
    }

    const { title, meta, canonicals, h1s, jsonld, bodyText } = parseHead(html);

    // Title
    if (!title) err(route, "missing <title>");
    else {
      if (PLACEHOLDERS.some((re) => re.test(title))) err(route, `placeholder title: "${title}"`);
      checkLength(route, "title", title, LIMITS.titleMin, LIMITS.titleMax);
      if (titles.has(title)) err(route, `duplicate title, also used by ${titles.get(title)}`);
      else titles.set(title, route);
    }

    // Description
    const desc = meta("description");
    if (!desc) err(route, "missing meta description");
    else {
      if (PLACEHOLDERS.some((re) => re.test(desc)))
        err(route, `placeholder description: "${desc}"`);
      checkLength(route, "description", desc, LIMITS.descMin, LIMITS.descMax);
      if (descriptions.has(desc))
        err(route, `duplicate description, also used by ${descriptions.get(desc)}`);
      else descriptions.set(desc, route);
    }

    // Social tags
    for (const key of ["og:title", "og:description", "og:type", "og:url", "og:image"]) {
      if (!meta(key)) err(route, `missing ${key}`);
    }
    for (const key of ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]) {
      if (!meta(key)) err(route, `missing ${key}`);
    }
    const card = meta("twitter:card");
    if (card && card !== "summary_large_image" && card !== "summary")
      err(route, `invalid twitter:card value "${card}"`);
    for (const key of ["og:image", "twitter:image"]) {
      const v = meta(key);
      if (v && !/^https?:\/\//i.test(v)) err(route, `${key} must be an absolute URL, got "${v}"`);
    }
    if (!meta("og:image:alt")) warn(route, "missing og:image:alt");

    // Canonical + og:url
    if (canonicals.length === 0) err(route, 'missing <link rel="canonical">');
    if (canonicals.length > 1)
      err(route, `${canonicals.length} canonical links (must be exactly one)`);
    const canonical = canonicals[0];
    if (canonical && !sameUrl(canonical, route))
      err(route, `canonical does not self-reference (points at "${canonical}")`);
    const ogUrl = meta("og:url");
    if (ogUrl && !sameUrl(ogUrl, route))
      err(route, `og:url does not self-reference (points at "${ogUrl}")`);
    if (canonical && ogUrl && !sameUrl(canonical, ogUrl))
      err(route, "canonical and og:url disagree");
    // Every host serving this build (preview, dev, production) must name the
    // same canonical origin, otherwise the copies compete as duplicates.
    for (const [key, value] of [
      ["canonical", canonical],
      ["og:url", ogUrl],
      ["og:image", meta("og:image")],
      ["twitter:image", meta("twitter:image")],
    ]) {
      if (!value) continue;
      let origin;
      try {
        origin = new URL(value).origin;
      } catch {
        err(route, `${key} is not an absolute URL ("${value}")`);
        continue;
      }
      if (origin !== SITE_ORIGIN)
        err(route, `${key} uses "${origin}" instead of the canonical origin ${SITE_ORIGIN}`);
    }

    // Headings
    if (h1s.length === 0) err(route, "no <h1> on the page");
    if (h1s.length > 1) err(route, `${h1s.length} <h1> elements (must be exactly one)`);
    for (const h of h1s) {
      if (!h) err(route, "empty <h1>");
      else {
        if (/[.,;:!]$/.test(h)) warn(route, `<h1> ends with punctuation: "${h}"`);
        if (h.length > 70) warn(route, `<h1> is long (${h.length} chars): "${h}"`);
      }
    }

    // Structured data
    validateJsonLd(route, jsonld, bodyText);

    const routeErrors = errors.filter((e) => e.route === route).length;
    const routeWarnings = warnings.filter((w) => w.route === route).length;
    const status = routeErrors ? "FAIL" : routeWarnings ? "warn" : "ok  ";
    console.log(
      `[${status}] ${route}  title ${title ? title.length : 0} chars, description ${desc ? desc.length : 0} chars, ${jsonld.length} JSON-LD block(s)`,
    );
  }

  await checkSitemapAndRobots(routes);

  if (warnings.length) {
    console.log("\nWarnings:");
    for (const w of warnings) console.log(`  warn  ${w.route}: ${w.msg}`);
  }
  if (errors.length) {
    console.log("\nErrors:");
    for (const e of errors) console.log(`  ERROR ${e.route}: ${e.msg}`);
  }

  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s).`);
  if (errors.length) process.exit(1);
}

run();
