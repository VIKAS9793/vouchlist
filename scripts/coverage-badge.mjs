#!/usr/bin/env node
/**
 * Renders `.github/badges/coverage.svg` from the Vitest coverage summary so the
 * README can show a real number without depending on a third party service.
 * Run `npm run test:coverage` first: it writes coverage/coverage-summary.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const summaryPath = resolve("coverage/coverage-summary.json");
const badgePath = resolve(".github/badges/coverage.svg");

let pct = 0;
try {
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  pct = Math.round(summary.total.lines.pct * 10) / 10;
} catch {
  console.error(
    "coverage-badge: coverage/coverage-summary.json not found. Run `npm run test:coverage` first.",
  );
  process.exit(1);
}

const colour = pct >= 90 ? "#3fb950" : pct >= 75 ? "#93c47d" : pct >= 60 ? "#d29922" : "#f85149";
const label = "coverage";
const value = `${pct}%`;
const labelWidth = 62;
const valueWidth = 8 * value.length + 20;
const total = labelWidth + valueWidth;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${total}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${colour}"/>
    <rect width="${total}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,Geneva,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${value}</text>
  </g>
</svg>
`;

mkdirSync(dirname(badgePath), { recursive: true });
writeFileSync(badgePath, svg);
console.log(`coverage-badge: wrote ${badgePath} (${value})`);
