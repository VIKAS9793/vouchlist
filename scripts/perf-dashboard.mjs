#!/usr/bin/env node
/**
 * Renders the Lighthouse QA dashboard from reports written by scripts/perf-qa.mjs.
 *
 * Usage:
 *   node scripts/perf-dashboard.mjs            # build dashboard from existing reports
 *   node scripts/perf-dashboard.mjs --run      # run the perf gate first, then render
 *   node scripts/perf-dashboard.mjs --open     # print the file:// url to open
 *
 * Output: reports/perf/dashboard.html (self-contained, no network requests).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "reports/perf");
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);

if (flag("run")) {
  const args = ["scripts/perf-qa.mjs", ...argv.filter((a) => a !== "--run" && a !== "--open")];
  const res = spawnSync("node", args, { stdio: "inherit", cwd: ROOT });
  if (res.error) throw res.error;
}

const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);
const profiles = ["desktop", "mobile"]
  .map((p) => readJson(path.join(DIR, `latest-${p}.json`)))
  .filter(Boolean);

if (!profiles.length) {
  console.error(
    "No performance reports found. Run `npm run qa:perf` (or `npm run qa:perf:dashboard`) first.",
  );
  process.exit(1);
}

const historyPath = path.join(DIR, "history.jsonl");
const history = existsSync(historyPath)
  ? readFileSync(historyPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  : [];

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const ms = (v) => (v == null ? "n/a" : `${(v / 1000).toFixed(2)}s`);
const pct = (v, max) => Math.max(2, Math.min(100, (v / max) * 100));

function statusOf(score, budget) {
  if (score == null) return "fail";
  if (score > budget + 2) return "pass";
  if (score > budget) return "warn";
  return "fail";
}
function metricStatus(v, budget) {
  if (v == null) return "fail";
  if (v < budget * 0.75) return "pass";
  if (v < budget) return "warn";
  return "fail";
}

function sparkline(routeName, profile) {
  const points = history
    .filter((h) => h.profile === profile)
    .slice(-20)
    .map((h) => h.routes.find((r) => r.route === routeName)?.metrics?.["largest-contentful-paint"])
    .filter((v) => typeof v === "number");
  if (points.length < 2) return "";
  const max = Math.max(...points, 1);
  const w = 90;
  const h = 22;
  const d = points
    .map((v, i) => `${(i / (points.length - 1)) * w},${h - (v / max) * (h - 2) - 1}`)
    .join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="LCP trend over the last ${points.length} runs"><polyline points="${d}" /></svg>`;
}

function routeRow(r, budgets, profile) {
  const lcp = r.metrics?.["largest-contentful-paint"];
  const scoreState = statusOf(r.score, budgets.score);
  const lcpState = metricStatus(lcp, budgets["largest-contentful-paint"]);
  const cells = [
    ["FCP", r.metrics?.["first-contentful-paint"], budgets["first-contentful-paint"], ms],
    [
      "TBT",
      r.metrics?.["total-blocking-time"],
      budgets["total-blocking-time"],
      (v) => (v == null ? "n/a" : `${Math.round(v)}ms`),
    ],
    ["SI", r.metrics?.["speed-index"], budgets["speed-index"], ms],
    [
      "CLS",
      r.metrics?.["cumulative-layout-shift"],
      budgets["cumulative-layout-shift"],
      (v) => (v == null ? "n/a" : v.toFixed(3)),
    ],
  ]
    .map(
      ([label, v, budget, f]) =>
        `<span class="chip ${metricStatus(v, budget)}"><b>${label}</b> ${esc(f(v))}</span>`,
    )
    .join("");

  return `<tr>
  <th scope="row"><code>${esc(r.route)}</code></th>
  <td class="scorecell">
    <div class="dial ${scoreState}" style="--v:${r.score ?? 0}"><span>${r.score ?? "!"}</span></div>
  </td>
  <td class="barcell">
    <div class="bar ${lcpState}"><i style="width:${pct(lcp ?? budgets["largest-contentful-paint"], budgets["largest-contentful-paint"])}%"></i></div>
    <div class="barlabel"><strong>${esc(ms(lcp))}</strong> <span>budget ${ms(budgets["largest-contentful-paint"])}</span></div>
  </td>
  <td class="sparkcell">${sparkline(r.route, profile)}</td>
  <td class="chips">${cells}</td>
</tr>`;
}

function panel(report) {
  const rows = [...report.routes]
    .sort(
      (a, b) =>
        (b.metrics?.["largest-contentful-paint"] ?? Infinity) -
        (a.metrics?.["largest-contentful-paint"] ?? Infinity),
    )
    .map((r) => routeRow(r, report.budgets, report.profile))
    .join("\n");
  const scores = report.routes.map((r) => r.score).filter((s) => typeof s === "number");
  const lcps = report.routes
    .map((r) => r.metrics?.["largest-contentful-paint"])
    .filter((v) => typeof v === "number");
  const worst = Math.min(...(scores.length ? scores : [0]));
  const slowest = Math.max(...(lcps.length ? lcps : [0]));
  return `<section class="panel">
  <header class="panelhead">
    <h2>${esc(report.profile)} profile</h2>
    <p class="verdict ${report.passed ? "pass" : "fail"}">${report.passed ? "All budgets met" : `${report.errors.length} budget failure(s)`}</p>
    <p class="meta">${report.routes.length} routes &middot; lowest score ${worst} &middot; slowest LCP ${ms(slowest)} &middot; ${esc(new Date(report.generatedAt).toUTCString())}</p>
  </header>
  <table>
    <thead><tr><th scope="col">Route</th><th scope="col">Score</th><th scope="col">LCP vs budget</th><th scope="col">Trend</th><th scope="col">Supporting metrics</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${
    report.errors.length
      ? `<ul class="issues">${report.errors.map((e) => `<li><code>${esc(e.route)}</code> ${esc(e.msg)}</li>`).join("")}</ul>`
      : ""
  }
</section>`;
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>VouchList performance QA dashboard</title>
<style>
:root{color-scheme:light dark;--bg:#0d1117;--card:#151b23;--line:#232c38;--fg:#e6edf3;--muted:#8b98a8;--pass:#2ecc8f;--warn:#f0b429;--fail:#ff6b6b}
*{box-sizing:border-box}
body{margin:0;padding:2.5rem 1.5rem 4rem;background:var(--bg);color:var(--fg);font:15px/1.5 ui-sans-serif,system-ui,"Segoe UI",sans-serif}
main{max-width:1080px;margin:0 auto}
h1{font-size:1.6rem;margin:0 0 .25rem}
.sub{color:var(--muted);margin:0 0 2rem}
.panel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1.25rem 1.25rem 1.5rem;margin-bottom:2rem}
.panelhead h2{margin:0;font-size:1.1rem;text-transform:capitalize}
.verdict{margin:.35rem 0 0;font-weight:600}
.verdict.pass{color:var(--pass)}.verdict.fail{color:var(--fail)}
.meta{color:var(--muted);margin:.15rem 0 1rem;font-size:.85rem}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:.6rem .5rem;border-top:1px solid var(--line);vertical-align:middle}
thead th{border-top:0;color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.04em}
code{font:13px ui-monospace,SFMono-Regular,Menlo,monospace}
.dial{--v:0;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(currentColor calc(var(--v)*1%),var(--line) 0)}
.dial span{width:36px;height:36px;border-radius:50%;background:var(--card);display:grid;place-items:center;color:var(--fg);font-weight:600;font-size:.85rem}
.pass{color:var(--pass)}.warn{color:var(--warn)}.fail{color:var(--fail)}
.barcell{min-width:210px}
.bar{height:9px;border-radius:99px;background:var(--line);overflow:hidden}
.bar i{display:block;height:100%;background:currentColor;border-radius:99px}
.barlabel{font-size:.78rem;color:var(--muted);margin-top:.3rem}
.barlabel strong{color:var(--fg)}
.spark{width:90px;height:22px;fill:none;stroke:var(--muted);stroke-width:1.5}
.chips{display:flex;flex-wrap:wrap;gap:.3rem}
.chip{border:1px solid var(--line);border-radius:99px;padding:.1rem .5rem;font-size:.72rem;color:var(--muted)}
.chip b{color:currentColor}
.issues{margin:1rem 0 0;padding-left:1.1rem;color:var(--fail);font-size:.85rem}
footer{color:var(--muted);font-size:.8rem}
</style>
</head>
<body>
<main>
  <h1>Performance QA dashboard</h1>
  <p class="sub">Lighthouse score and Largest Contentful Paint per public route, measured against the production build. Green is comfortably inside budget, amber is close to it, red is a failure.</p>
  ${profiles.map(panel).join("\n")}
  <footer>Generated ${esc(new Date().toUTCString())} from reports/perf. Refresh with <code>npm run qa:perf:dashboard</code>.</footer>
</main>
</body>
</html>
`;

mkdirSync(DIR, { recursive: true });
const out = path.join(DIR, "dashboard.html");
writeFileSync(out, html);
console.log(`Dashboard written to ${path.relative(ROOT, out)}`);
if (flag("open")) console.log(`file://${out}`);
