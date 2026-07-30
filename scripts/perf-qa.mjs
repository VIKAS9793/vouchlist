#!/usr/bin/env node
/**
 * Pre-publish Lighthouse performance gate.
 *
 * Runs Lighthouse against a production build of every public route and enforces
 * the product performance budgets:
 *   - Largest Contentful Paint  < 2.5s
 *   - Lighthouse performance score > 95
 *   - supporting budgets: CLS < 0.1, TBT < 200ms, Speed Index < 3.4s
 *
 * By default the script builds the app (`npm run build`) and serves the real
 * production output with `wrangler dev`, because dev-server numbers are
 * meaningless (unbundled modules, no minification).
 *
 * Usage:
 *   node scripts/perf-qa.mjs                 # build, serve, audit, exit 1 on budget miss
 *   node scripts/perf-qa.mjs --no-build      # reuse an existing dist/ build
 *   node scripts/perf-qa.mjs --base <url>    # audit an already running origin
 *   node scripts/perf-qa.mjs --mobile        # mobile emulation and slow 4G throttling
 *   node scripts/perf-qa.mjs --route /faq    # audit a single route (repeatable)
 *
 * Every run writes a machine readable report to reports/perf/latest-<profile>.json
 * and appends a row to reports/perf/history.jsonl, which
 * `node scripts/perf-dashboard.mjs` renders as a triage dashboard.
 */
import { spawn } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 ? argv[i + 1] : undefined;
};
const multi = (name) =>
  argv.reduce((acc, a, i) => (a === `--${name}` && argv[i + 1] ? [...acc, argv[i + 1]] : acc), []);

const MOBILE = flag("mobile");
const PORT = Number(value("port") ?? 4174);
const EXTERNAL_BASE = value("base")?.replace(/\/$/, "");
const SHOULD_BUILD = !EXTERNAL_BASE && !flag("no-build");

/** Performance budgets. Numeric audits are in milliseconds unless listed as unitless. */
const BUDGETS = {
  score: 95,
  "largest-contentful-paint": 2500,
  "first-contentful-paint": 1800,
  "speed-index": 3400,
  "total-blocking-time": 200,
  "cumulative-layout-shift": 0.1,
};
const UNITLESS = new Set(["cumulative-layout-shift"]);

const errors = [];
const warnings = [];

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

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", cwd: ROOT, ...opts });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`)),
    );
  });
}

async function waitForServer(url, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function killTree(child) {
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    /* already gone */
  }
}

/**
 * The build stamps today's date as the Worker compatibility date, which the
 * locally installed workerd binary can refuse ("newest date supported ...").
 * That is a toolchain mismatch, not a performance regression, so the preview
 * is pinned to a date the local runtime definitely accepts.
 */
function localCompatibilityDate() {
  const configPath = path.join(ROOT, "dist/server/wrangler.json");
  let configured;
  try {
    configured = JSON.parse(readFileSync(configPath, "utf8")).compatibility_date;
  } catch {
    /* fall back to the safe date below */
  }
  const safe = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return configured && configured < safe ? configured : safe;
}

async function startProductionServer() {
  if (SHOULD_BUILD) {
    console.log("Building production bundle...");
    await run("npm", ["run", "build"]);
  }
  if (!existsSync(path.join(ROOT, "dist/server/index.mjs"))) {
    throw new Error("No production build found in dist/. Run without --no-build.");
  }
  const compatDate = localCompatibilityDate();
  console.log(`Starting production preview on port ${PORT} (compatibility date ${compatDate})...`);
  mkdirSync(path.join(ROOT, "reports/perf"), { recursive: true });
  const logPath = path.join(ROOT, "reports/perf/preview-server.log");
  const logFd = openSync(logPath, "w");
  const child = spawn(
    "npx",
    ["wrangler", "dev", "--port", String(PORT), "--local", "--compatibility-date", compatDate],
    {
      cwd: path.join(ROOT, "dist"),
      stdio: ["ignore", logFd, logFd],
      detached: true,
    },
  );
  const base = `http://localhost:${PORT}`;
  const ok = await waitForServer(`${base}/`);
  if (!ok) {
    killTree(child);
    let tail = "";
    try {
      tail = readFileSync(logPath, "utf8").split("\n").slice(-30).join("\n");
    } catch {
      /* no log */
    }
    throw new Error(`Production preview server did not become ready.\n${tail}`);
  }
  return { base, stop: () => killTree(child) };
}

function chromePath() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  const dir = readdirSync(root).find((d) => d.startsWith("chromium-"));
  if (!dir) return undefined;
  const candidate = path.join(root, dir, "chrome-linux", "chrome");
  return existsSync(candidate) ? candidate : undefined;
}

const DESKTOP_CONFIG = {
  extends: "lighthouse:default",
  settings: {
    onlyCategories: ["performance"],
    formFactor: "desktop",
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
  },
};

const MOBILE_CONFIG = {
  extends: "lighthouse:default",
  settings: { onlyCategories: ["performance"], formFactor: "mobile" },
};

function fmt(id, v) {
  return UNITLESS.has(id) ? v.toFixed(3) : `${Math.round(v)}ms`;
}

async function auditRoute(chrome, base, route) {
  const url = base + route;
  const result = await lighthouse(
    url,
    { port: chrome.port, output: "json", logLevel: "error" },
    MOBILE ? MOBILE_CONFIG : DESKTOP_CONFIG,
  );
  const lhr = result?.lhr;
  if (!lhr) {
    errors.push({ route, msg: "Lighthouse returned no result" });
    return null;
  }
  if (lhr.runtimeError) {
    errors.push({ route, msg: `Lighthouse runtime error: ${lhr.runtimeError.message}` });
    return null;
  }

  const score = Math.round((lhr.categories.performance.score ?? 0) * 100);
  if (score <= BUDGETS.score) {
    errors.push({
      route,
      msg: `performance score ${score} is not above the budget of ${BUDGETS.score}`,
    });
  }

  const metrics = {};
  for (const [id, budget] of Object.entries(BUDGETS)) {
    if (id === "score") continue;
    const audit = lhr.audits[id];
    if (!audit || typeof audit.numericValue !== "number") {
      warnings.push({ route, msg: `metric ${id} was not reported` });
      continue;
    }
    metrics[id] = audit.numericValue;
    if (audit.numericValue >= budget) {
      errors.push({
        route,
        msg: `${id} ${fmt(id, audit.numericValue)} exceeds the budget of ${fmt(id, budget)}`,
      });
    }
  }
  return { score, metrics };
}

const REPORT_DIR = path.join(ROOT, "reports/perf");

/** Persist the run so the dashboard can visualise scores, LCP and trends. */
function writeReport(results) {
  const profile = MOBILE ? "mobile" : "desktop";
  const report = {
    generatedAt: new Date().toISOString(),
    profile,
    budgets: BUDGETS,
    routes: results,
    errors,
    warnings,
    passed: errors.length === 0,
  };
  try {
    mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(
      path.join(REPORT_DIR, `latest-${profile}.json`),
      JSON.stringify(report, null, 2) + "\n",
    );
    appendFileSync(path.join(REPORT_DIR, "history.jsonl"), JSON.stringify(report) + "\n");
    console.log(`\nReport written to reports/perf/latest-${profile}.json`);
  } catch (e) {
    warnings.push({ route: "-", msg: `could not write perf report: ${e.message}` });
  }
}

async function main() {
  const routes = multi("route").length ? multi("route") : discoverRoutes();
  const results = [];
  let server = null;
  let base = EXTERNAL_BASE;
  if (!base) {
    server = await startProductionServer();
    base = server.base;
  }

  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    chromePath: chromePath(),
  });

  console.log(
    `\nLighthouse performance QA (${MOBILE ? "mobile" : "desktop"}) against ${base}\n` +
      `Budgets: score > ${BUDGETS.score}, LCP < ${BUDGETS["largest-contentful-paint"]}ms, ` +
      `TBT < ${BUDGETS["total-blocking-time"]}ms, CLS < ${BUDGETS["cumulative-layout-shift"]}\n`,
  );

  try {
    for (const route of routes) {
      const res = await auditRoute(chrome, base, route);
      if (!res) {
        console.log(`  ${route.padEnd(16)} FAILED TO AUDIT`);
        results.push({ route, score: null, metrics: {} });
        continue;
      }
      const m = res.metrics;
      results.push({ route, score: res.score, metrics: m });
      console.log(
        `  ${route.padEnd(16)} score ${String(res.score).padStart(3)}  ` +
          `LCP ${fmt("largest-contentful-paint", m["largest-contentful-paint"] ?? 0).padStart(7)}  ` +
          `FCP ${fmt("first-contentful-paint", m["first-contentful-paint"] ?? 0).padStart(7)}  ` +
          `TBT ${fmt("total-blocking-time", m["total-blocking-time"] ?? 0).padStart(7)}  ` +
          `CLS ${fmt("cumulative-layout-shift", m["cumulative-layout-shift"] ?? 0)}`,
      );
    }
  } finally {
    await chrome.kill();
    server?.stop();
  }

  writeReport(results);
  console.log("");
  for (const w of warnings) console.log(`warn  ${w.route}: ${w.msg}`);
  for (const e of errors) console.log(`ERROR ${e.route}: ${e.msg}`);
  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
