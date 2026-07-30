#!/usr/bin/env node
/**
 * Secret hygiene gate.
 *
 * 1. Verifies .gitignore covers every category of local-only, cache and
 *    credential-bearing file we never want in git history.
 * 2. Scans tracked source files for hardcoded credentials (private keys,
 *    service-role JWTs, provider tokens).
 *
 * Exits non-zero on any finding so it can gate publishing.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.cwd();
const ignorePath = join(ROOT, ".gitignore");

/** Patterns that MUST be present in .gitignore (substring match). */
const REQUIRED_IGNORES = [
  "node_modules",
  "dist",
  ".output",
  ".wrangler",
  ".dev.vars",
  ".env.local",
  "*.pem",
  "*.key",
  "service-account",
  ".DS_Store",
  "test-results",
  "coverage",
  "*.tsbuildinfo",
];

/** Content patterns that indicate a leaked credential. */
const SECRET_PATTERNS = [
  [/-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/, "private key block"],
  [/\bsb_secret_[A-Za-z0-9_-]{10,}/, "Supabase secret key"],
  [/\bservice_role\b[^\n]{0,40}(eyJ[A-Za-z0-9_-]{20,})/, "Supabase service-role JWT"],
  [/\bsk_(live|test)_[A-Za-z0-9]{16,}/, "Stripe secret key"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, "GitHub token"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key id"],
  [/\bAIza[0-9A-Za-z_-]{30,}/, "Google API key"],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/, "Slack token"],
];

const SCAN_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".sql",
  ".html",
  ".css",
  ".yml",
  ".yaml",
  ".toml",
  ".txt",
]);

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".output",
  ".wrangler",
  ".tanstack",
  ".vinxi",
  "test-results",
  "playwright-report",
  "coverage",
  ".workspace",
  ".lovable",
  "public",
]);

const SKIP_FILES = new Set(["bun.lock", "package-lock.json", "scripts/secrets-qa.mjs"]);

const errors = [];
const warnings = [];

// --- 1. .gitignore coverage -------------------------------------------------
if (!existsSync(ignorePath)) {
  errors.push(".gitignore is missing at the repository root.");
} else {
  const ignore = readFileSync(ignorePath, "utf8");
  const lines = ignore
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const missing = REQUIRED_IGNORES.filter(
    (rule) => !lines.some((line) => line === rule || line.includes(rule)),
  );
  for (const rule of missing) {
    errors.push(`.gitignore does not cover "${rule}".`);
  }
}

// --- 2. credential scan -----------------------------------------------------
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const rel = relative(ROOT, full);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full);
      continue;
    }
    if (SKIP_FILES.has(rel)) continue;
    if (!SCAN_EXT.has(extname(entry))) continue;
    if (st.size > 1_500_000) continue;

    const content = readFileSync(full, "utf8");
    for (const [pattern, label] of SECRET_PATTERNS) {
      const match = content.match(pattern);
      if (!match) continue;
      const line = content.slice(0, match.index).split("\n").length;
      errors.push(`${rel}:${line} looks like a hardcoded ${label}.`);
    }
  }
}
walk(ROOT);

// --- 3. env file sanity -----------------------------------------------------
const envPath = join(ROOT, ".env");
if (existsSync(envPath)) {
  const keys = readFileSync(envPath, "utf8")
    .split("\n")
    .map((l) => l.split("=")[0].trim())
    .filter((k) => k && !k.startsWith("#"));
  const risky = keys.filter((k) => /SERVICE_ROLE|SECRET|PRIVATE|PASSWORD|_TOKEN$/i.test(k));
  for (const key of risky) {
    errors.push(
      `.env contains "${key}", which must never be committed. Store it with the secrets tooling instead.`,
    );
  }
  const nonPublic = keys.filter((k) => !/^VITE_/.test(k) && !/PUBLISHABLE|URL|PROJECT_ID/i.test(k));
  for (const key of nonPublic) {
    warnings.push(`.env key "${key}" is not obviously publishable. Confirm it is safe to commit.`);
  }
}

// --- report -----------------------------------------------------------------
for (const w of warnings) console.warn(`warning  ${w}`);
if (errors.length) {
  console.error("\nSecret hygiene gate failed:");
  for (const e of errors) console.error(`  error  ${e}`);
  console.error(`\n${errors.length} issue(s) found.`);
  process.exit(1);
}
console.log(`Secret hygiene gate passed (${warnings.length} warning(s)).`);
