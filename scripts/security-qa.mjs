#!/usr/bin/env node
/**
 * Pre-publish security header validation.
 *
 * Fetches every public route plus a static asset and the 404 path, and checks
 * that each response carries the expected security headers:
 *   - Content-Security-Policy with safe directives (no wildcard default-src,
 *     no unsafe-eval in production output, frame-ancestors locked down)
 *   - Strict-Transport-Security with a long max-age and includeSubDomains
 *   - X-Frame-Options: DENY / SAMEORIGIN
 *   - X-Content-Type-Options: nosniff
 *   - Referrer-Policy, Permissions-Policy, COOP, CORP
 *
 * Usage: node scripts/security-qa.mjs [--base http://localhost:8080]
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

const errors = [];
const warnings = [];
const err = (target, msg) => errors.push({ target, msg });
const warn = (target, msg) => warnings.push({ target, msg });

function discoverRoutes() {
  const files = readdirSync(path.join(ROOT, "src/routes"));
  const routes = [];
  for (const f of files) {
    if (!f.endsWith(".tsx")) continue;
    if (f.startsWith("__") || f.startsWith("-")) continue;
    if (f.includes("$")) continue;
    if (f === "index.tsx") {
      routes.push("/");
      continue;
    }
    const seg = f
      .replace(/\.tsx$/, "")
      .replace(/^_[^.]*\./, "")
      .replace(/\.index$/, "")
      .replace(/\./g, "/");
    if (seg) routes.push("/" + seg);
  }
  return [...new Set(routes)].sort();
}

const REQUIRE_ENFORCE = process.argv.includes("--require-enforce");

const REQUIRED = {
  "reporting-endpoints": /csp-endpoint="[^"]+"/,
  "strict-transport-security": null,
  "x-frame-options": /^(DENY|SAMEORIGIN)$/i,
  "x-content-type-options": /^nosniff$/i,
  "referrer-policy": /^(no-referrer|strict-origin|strict-origin-when-cross-origin|same-origin)$/i,
  "permissions-policy": null,
  "cross-origin-opener-policy": /^(same-origin|same-origin-allow-popups)$/i,
  "cross-origin-resource-policy": /^(same-origin|same-site)$/i,
};

function parseCsp(value) {
  const map = new Map();
  for (const part of value.split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    map.set(tokens[0].toLowerCase(), tokens.slice(1));
  }
  return map;
}

function checkCsp(target, value) {
  const csp = parseCsp(value);

  for (const directive of [
    "default-src",
    "script-src",
    "style-src",
    "img-src",
    "connect-src",
    "frame-ancestors",
    "base-uri",
    "form-action",
    "object-src",
  ]) {
    if (!csp.has(directive)) err(target, `CSP missing "${directive}"`);
  }

  const defaultSrc = csp.get("default-src") ?? [];
  if (defaultSrc.includes("*")) err(target, 'CSP default-src must not be "*"');
  if (!defaultSrc.includes("'self'")) err(target, "CSP default-src should include 'self'");

  const frameAncestors = csp.get("frame-ancestors") ?? [];
  if (!frameAncestors.some((v) => v === "'none'" || v === "'self'")) {
    err(target, "CSP frame-ancestors must be 'none' or 'self' to prevent clickjacking");
  }

  if (!csp.has("report-uri") && !csp.has("report-to")) {
    err(target, "CSP has no report-uri/report-to sink; violations would be invisible");
  }

  const objectSrc = csp.get("object-src") ?? [];
  if (!objectSrc.includes("'none'")) err(target, "CSP object-src should be 'none'");

  const baseUri = csp.get("base-uri") ?? [];
  if (!baseUri.includes("'self'") && !baseUri.includes("'none'")) {
    err(target, "CSP base-uri must be locked to 'self' or 'none'");
  }

  for (const [directive, values] of csp) {
    if (values.includes("'unsafe-eval'")) {
      err(target, `CSP ${directive} allows 'unsafe-eval'; the policy has no dev exception`);
    }
    if (directive === "script-src" && values.includes("'unsafe-inline'")) {
      err(
        target,
        "CSP script-src must not allow 'unsafe-inline'; inline scripts use a per-request nonce",
      );
    }
    if (
      (directive === "style-src" || directive === "style-src-elem") &&
      values.includes("'unsafe-inline'")
    ) {
      err(
        target,
        `CSP ${directive} must not allow 'unsafe-inline'; inline styles use a per-request nonce`,
      );
    }
    if (values.includes("*")) warn(target, `CSP ${directive} contains a wildcard source`);
  }

  const scriptSrc = csp.get("script-src") ?? [];
  const nonce = scriptSrc.find((v) => v.startsWith("'nonce-"));
  if (!nonce) err(target, "CSP script-src is missing a 'nonce-...' source");
  return nonce ? nonce.slice("'nonce-".length, -1) : null;
}

function checkHsts(target, value) {
  const maxAge = /max-age=(\d+)/i.exec(value);
  if (!maxAge) {
    err(target, "HSTS missing max-age");
    return;
  }
  if (Number(maxAge[1]) < 15552000)
    err(target, `HSTS max-age ${maxAge[1]} is below the 180 day minimum`);
  if (!/includesubdomains/i.test(value)) warn(target, "HSTS missing includeSubDomains");
  if (!/preload/i.test(value)) warn(target, "HSTS missing preload");
}

async function checkTarget(target, { expectStatus } = {}) {
  let res;
  try {
    res = await fetch(BASE + target, { redirect: "manual" });
  } catch (e) {
    err(target, `request failed: ${e.message}`);
    return;
  }
  if (expectStatus && res.status !== expectStatus) {
    err(target, `expected HTTP ${expectStatus}, got ${res.status}`);
  }

  for (const [header, pattern] of Object.entries(REQUIRED)) {
    const value = res.headers.get(header);
    if (!value) {
      err(target, `missing ${header}`);
      continue;
    }
    if (pattern && !pattern.test(value.trim())) {
      err(target, `${header} has unexpected value "${value}"`);
    }
  }

  const enforced = res.headers.get("content-security-policy");
  const reportOnly = res.headers.get("content-security-policy-report-only");
  const csp = enforced ?? reportOnly;
  if (!csp) err(target, "missing content-security-policy (or -report-only)");
  if (!enforced && reportOnly) {
    const msg = "CSP is running in report-only mode; it observes violations but blocks nothing";
    if (REQUIRE_ENFORCE) err(target, msg + " (--require-enforce)");
    else warn(target, msg);
  }
  let nonce = null;
  if (csp) nonce = checkCsp(target, csp);

  if (nonce && (res.headers.get("content-type") ?? "").includes("text/html")) {
    if (seenNonces.has(nonce))
      err(target, "CSP nonce was reused across requests; it must be unique per response");
    seenNonces.add(nonce);

    const html = await res.text();
    for (const [, tag, attrs] of html.matchAll(/<(script|style)((?:\s[^>]*)?)>/gi)) {
      if (/\ssrc\s*=/i.test(attrs)) continue; // external scripts are covered by 'self'
      const found = /\snonce\s*=\s*"([^"]*)"/i.exec(attrs);
      if (!found) err(target, `inline <${tag}> element is missing the nonce attribute`);
      else if (found[1] !== nonce) err(target, "inline element nonce does not match the CSP nonce");
    }
  }

  const hsts = res.headers.get("strict-transport-security");
  if (hsts) checkHsts(target, hsts);

  if (res.headers.get("x-powered-by")) warn(target, "x-powered-by header exposes server details");

  console.log(
    `[${errors.some((e) => e.target === target) ? "fail" : "ok  "}] ${target}  ${res.status}`,
  );
}

async function checkReportEndpoint() {
  const target = "/api/public/csp-report";
  const sample = {
    "csp-report": {
      "document-uri": BASE + "/",
      "violated-directive": "script-src",
      "effective-directive": "script-src",
      "blocked-uri": "inline",
      disposition: "report",
    },
  };
  try {
    const ok = await fetch(BASE + target, {
      method: "POST",
      headers: { "content-type": "application/csp-report" },
      body: JSON.stringify(sample),
    });
    if (ok.status !== 204) err(target, `valid CSP report should return 204, got ${ok.status}`);

    const bad = await fetch(BASE + target, {
      method: "POST",
      headers: { "content-type": "application/csp-report" },
      body: "not json",
    });
    if (bad.status !== 400) err(target, `malformed report should return 400, got ${bad.status}`);

    const wrongType = await fetch(BASE + target, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    if (wrongType.status !== 415)
      err(target, `non-JSON content-type should return 415, got ${wrongType.status}`);

    console.log(
      `[${errors.some((e) => e.target === target) ? "fail" : "ok  "}] ${target}  report sink`,
    );
  } catch (e) {
    err(target, `report endpoint unreachable: ${e.message}`);
  }
}

const routes = discoverRoutes();
const seenNonces = new Set();
console.log(`Security header QA against ${BASE}`);
console.log(`Routes: ${routes.join(", ")}\n`);

for (const route of routes) await checkTarget(route);
await checkTarget("/robots.txt");
await checkTarget("/sitemap.xml");
await checkTarget("/this-page-does-not-exist", { expectStatus: 404 });
await checkReportEndpoint();

if (warnings.length) {
  console.log("\nWarnings:");
  for (const w of warnings) console.log(`  warn  ${w.target}: ${w.msg}`);
}
if (errors.length) {
  console.log("\nErrors:");
  for (const e of errors) console.log(`  ERROR ${e.target}: ${e.msg}`);
}
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);
