#!/usr/bin/env node
/**
 * Pre-publish dependency vulnerability scan.
 *
 * Reads bun.lock, resolves every installed package@version, and queries the
 * npm public advisory database (the same data source npm audit / Snyk OSS use)
 * in batches. Fails the build on advisories at or above the configured
 * threshold so supply-chain issues are caught alongside the header QA.
 *
 * Usage:
 *   node scripts/deps-qa.mjs [--level high] [--json]
 *
 * Allowlist: scripts/deps-allowlist.json
 *   { "advisories": ["GHSA-xxxx-...": reason ], "packages": { "name": "reason" } }
 *
 * Exits 1 when any blocking advisory is found.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENDPOINT = "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk";
const ORDER = ["low", "moderate", "high", "critical"];

const argv = process.argv.slice(2);
const levelArg = argv.indexOf("--level");
const LEVEL = levelArg > -1 ? argv[levelArg + 1] : "high";
const AS_JSON = argv.includes("--json");
if (!ORDER.includes(LEVEL)) {
  console.error(`Unknown --level "${LEVEL}". Use one of: ${ORDER.join(", ")}`);
  process.exit(2);
}

function loadAllowlist() {
  const file = path.join(ROOT, "scripts/deps-allowlist.json");
  if (!existsSync(file)) return { advisories: {}, packages: {} };
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    return { advisories: raw.advisories ?? {}, packages: raw.packages ?? {} };
  } catch (e) {
    console.error(`Could not parse deps-allowlist.json: ${e.message}`);
    process.exit(2);
  }
}

function readLockfile() {
  const file = path.join(ROOT, "bun.lock");
  if (!existsSync(file)) {
    console.error("bun.lock not found. Run `bun install --save-text-lockfile` first.");
    process.exit(2);
  }
  // bun.lock is JSONC: strip comments and trailing commas.
  const text = readFileSync(file, "utf8")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(text);
}

/** name -> Set(versions) for every resolved package in the lockfile. */
function collectPackages(lock) {
  const map = new Map();
  for (const entry of Object.values(lock.packages ?? {})) {
    const spec = Array.isArray(entry) ? entry[0] : null;
    if (typeof spec !== "string") continue;
    const at = spec.lastIndexOf("@");
    if (at <= 0) continue;
    const name = spec.slice(0, at);
    const version = spec.slice(at + 1);
    if (!/^\d+\.\d+\.\d+/.test(version)) continue; // skip workspace/link/git specs
    if (!map.has(name)) map.set(name, new Set());
    map.get(name).add(version);
  }
  return map;
}

async function queryBatch(batch) {
  const body = {};
  for (const [name, versions] of batch) body[name] = [...versions];
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`advisory request failed (status ${res.status})`);
  return res.json();
}

async function main() {
  const allow = loadAllowlist();
  const packages = collectPackages(readLockfile());
  const entries = [...packages.entries()];
  const BATCH = 200;
  const findings = [];

  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    let result;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        result = await queryBatch(slice);
        break;
      } catch (e) {
        if (attempt === 3) {
          console.error(`Dependency scan could not reach the advisory database: ${e.message}`);
          process.exit(2);
        }
        await new Promise((r) => setTimeout(r, attempt * 750));
      }
    }
    for (const [name, advisories] of Object.entries(result)) {
      for (const a of advisories) {
        findings.push({
          package: name,
          installed: [...packages.get(name)].join(", "),
          severity: a.severity,
          title: a.title,
          vulnerable: a.vulnerable_versions,
          url: a.url,
          id: a.url?.split("/").pop() ?? String(a.id),
        });
      }
    }
  }

  const threshold = ORDER.indexOf(LEVEL);
  const blocking = [];
  const ignored = [];
  for (const f of findings) {
    const reason = allow.advisories[f.id] ?? allow.packages[f.package];
    if (reason) {
      ignored.push({ ...f, reason });
      continue;
    }
    if (ORDER.indexOf(f.severity) >= threshold) blocking.push(f);
  }

  if (AS_JSON) {
    console.log(JSON.stringify({ scanned: packages.size, findings, blocking, ignored }, null, 2));
  } else {
    console.log(`Dependency scan: ${packages.size} packages checked (fail level: ${LEVEL})\n`);
    const shown = findings.filter((f) => !allow.advisories[f.id] && !allow.packages[f.package]);
    for (const f of shown.sort((a, b) => ORDER.indexOf(b.severity) - ORDER.indexOf(a.severity))) {
      const tag = ORDER.indexOf(f.severity) >= threshold ? "ERROR" : "warn ";
      console.log(`${tag} [${f.severity}] ${f.package}@${f.installed} - ${f.title}`);
      console.log(`      vulnerable: ${f.vulnerable}  ${f.url}`);
    }
    for (const f of ignored) {
      console.log(`allow [${f.severity}] ${f.package} - ${f.title} (${f.reason})`);
    }
    console.log(
      `\n${blocking.length} blocking, ${shown.length - blocking.length} below threshold, ${ignored.length} allowlisted`,
    );
  }

  if (blocking.length) {
    console.error(`\nDependency QA failed: ${blocking.length} advisory(ies) at ${LEVEL} or above.`);
    console.error(
      "Fix by upgrading the package in package.json and re-running `bun install --save-text-lockfile`.",
    );
    process.exit(1);
  }
  console.log("Dependency QA passed.");
}

main();
