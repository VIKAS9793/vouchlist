#!/usr/bin/env node
/**
 * Automated broken-link check for every public route.
 *
 * Crawls the server-rendered HTML of all discovered routes, collects every
 * internal href/src (links, images, scripts, stylesheets, sitemap entries),
 * and requests each one. Any 404 or other non-OK response is an ERROR.
 * External links are checked with a HEAD request and reported as warnings
 * only, so a flaky third party never blocks a publish.
 *
 * Usage: node scripts/link-qa.mjs [--base http://localhost:8080] [--external]
 * Exits 1 when any ERROR is found so it can gate publishing.
 */
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseArg = process.argv.indexOf("--base");
const BASE = (baseArg > -1 ? process.argv[baseArg + 1] : "http://localhost:8080").replace(
  /\/$/,
  "",
);
const CHECK_EXTERNAL = process.argv.includes("--external");

const errors = [];
const warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

function discoverRoutes() {
  const files = readdirSync(path.join(ROOT, "src/routes"));
  const routes = ["/"];
  for (const f of files) {
    if (!/\.(tsx|ts)$/.test(f)) continue;
    if (f.startsWith("__") || f.startsWith("-") || f.startsWith("$")) continue;
    if (f.includes("$")) continue; // dynamic routes need params
    if (f === "index.tsx") continue;
    const seg = f
      .replace(/\.(tsx|ts)$/, "")
      .replace(/\[\.\]/g, "\u0000")
      .replace(/^_[^.]*\./, "")
      .replace(/\.index$/, "")
      .replace(/\.(?![a-z]{2,4}$)/g, "/")
      .replace(/\u0000/g, ".")
      .replace(/^\//, "");
    if (!seg || seg.startsWith("api/")) continue;
    routes.push("/" + seg);
  }
  return [...new Set(routes)].sort();
}

const decode = (s = "") =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/g, "/")
    .replace(/&quot;/g, '"')
    .trim();

function extractLinks(html) {
  const found = new Set();
  const attr = /(?:href|src)\s*=\s*"([^"]+)"/gi;
  let m;
  while ((m = attr.exec(html))) {
    const raw = decode(m[1]);
    if (!raw || raw.startsWith("#") || /^(mailto:|tel:|data:|javascript:|blob:)/i.test(raw))
      continue;
    found.add(raw);
  }
  return [...found];
}

function classify(raw) {
  if (/^https?:\/\//i.test(raw)) {
    const url = new URL(raw);
    const baseHost = new URL(BASE).host;
    return url.host === baseHost
      ? { kind: "internal", url: url.pathname + url.search }
      : { kind: "external", url: raw };
  }
  if (raw.startsWith("//")) return { kind: "external", url: "https:" + raw };
  if (!raw.startsWith("/")) return { kind: "skip", url: raw };
  return { kind: "internal", url: raw };
}

async function head(url) {
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: "GET", redirect: "follow" });
    }
    return res.status;
  } catch (e) {
    return `network error: ${e.message}`;
  }
}

async function main() {
  const routes = discoverRoutes();
  console.log(`Broken link check against ${BASE}`);
  console.log(`Routes: ${routes.join(", ")}\n`);

  const pages = new Map();
  for (const route of routes) {
    const res = await fetch(BASE + route, { redirect: "follow" });
    if (!res.ok) {
      err(`${route} -> page itself returned ${res.status}`);
      continue;
    }
    pages.set(route, await res.text());
  }

  // Sitemap entries count as promised public URLs.
  try {
    const sm = await fetch(BASE + "/sitemap.xml");
    if (sm.ok) {
      const xml = await sm.text();
      const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]));
      pages.set("sitemap.xml", locs.map((l) => `href="${l}"`).join(" "));
    }
  } catch {
    warn("sitemap.xml could not be fetched");
  }

  const targets = new Map(); // url -> Set(sources)
  for (const [route, html] of pages) {
    for (const raw of extractLinks(html)) {
      const { kind, url } = classify(raw);
      if (kind === "skip") continue;
      const key = `${kind}:${url}`;
      if (!targets.has(key)) targets.set(key, new Set());
      targets.get(key).add(route);
    }
  }

  const internal = [...targets.keys()].filter((k) => k.startsWith("internal:"));
  const external = [...targets.keys()].filter((k) => k.startsWith("external:"));

  for (const key of internal) {
    const p = key.slice("internal:".length);
    const status = await head(BASE + p);
    const sources = [...targets.get(key)].join(", ");
    if (status === 404) err(`404: ${p} (linked from ${sources})`);
    else if (typeof status !== "number") err(`${status}: ${p} (linked from ${sources})`);
    else if (status >= 400) err(`HTTP ${status}: ${p} (linked from ${sources})`);
  }

  if (CHECK_EXTERNAL) {
    for (const key of external) {
      const u = key.slice("external:".length);
      const status = await head(u);
      if (typeof status !== "number" || status >= 400) {
        warn(
          `external link ${u} returned ${status} (linked from ${[...targets.get(key)].join(", ")})`,
        );
      }
    }
  }

  // Unknown URLs must still 404 rather than silently render a 200 page.
  const bogus = await fetch(`${BASE}/__link-qa-does-not-exist`, { redirect: "manual" });
  if (bogus.status !== 404) err(`unknown URL returned ${bogus.status}, expected 404`);

  console.log(`Checked ${internal.length} internal links and ${external.length} external links.\n`);
  if (warnings.length) {
    console.log("Warnings:");
    for (const w of warnings) console.log(`  warn  ${w}`);
    console.log("");
  }
  if (errors.length) {
    console.log("Errors:");
    for (const e of errors) console.log(`  ERROR ${e}`);
    console.log(`\n${errors.length} broken link error(s).`);
    process.exit(1);
  }
  console.log(`No broken links. ${warnings.length} warning(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
