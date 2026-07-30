#!/usr/bin/env node
/**
 * Image QA gate.
 * - Every raster asset in public/ and src/assets/ must be small enough to paint fast.
 * - Every legacy raster (png/jpg) must ship a modern sibling (.webp and/or .avif).
 * - Every <img> in src/ must declare width + height (no layout shift) and alt text.
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, extname, basename, dirname } from "node:path";

const ROOT = process.cwd();
const MAX_BYTES = 200 * 1024;
const LEGACY = new Set([".png", ".jpg", ".jpeg"]);
const RASTER = new Set([...LEGACY, ".webp", ".avif", ".gif"]);
const errors = [];
const notes = [];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const assetFiles = [...walk(join(ROOT, "public")), ...walk(join(ROOT, "src/assets"))];

for (const file of assetFiles) {
  const ext = extname(file).toLowerCase();
  if (!RASTER.has(ext)) continue;
  const rel = file.slice(ROOT.length + 1);
  const size = statSync(file).size;
  if (size > MAX_BYTES) {
    errors.push(`${rel} is ${(size / 1024).toFixed(0)} KB (budget ${MAX_BYTES / 1024} KB)`);
  }
  if (LEGACY.has(ext)) {
    const stem = join(dirname(file), basename(file, ext));
    const modern = [".webp", ".avif"].filter((m) => {
      try {
        return statSync(stem + m).isFile();
      } catch {
        return false;
      }
    });
    if (modern.length === 0) {
      errors.push(`${rel} has no AVIF/WebP sibling`);
    } else {
      notes.push(`${rel} -> ${modern.join(", ")} (${(size / 1024).toFixed(0)} KB legacy fallback)`);
    }
  }
}

const codeFiles = walk(join(ROOT, "src")).filter((f) => /\.(tsx|jsx|html)$/.test(f));
let imgCount = 0;
let priorityCount = 0;
for (const file of codeFiles) {
  const src = readFileSync(file, "utf8");
  for (const match of src.matchAll(/<img\b[^>]*>/g)) {
    imgCount += 1;
    const tag = match[0];
    const rel = file.slice(ROOT.length + 1);
    if (!/\bwidth=/.test(tag) || !/\bheight=/.test(tag))
      errors.push(`${rel}: <img> missing width/height (causes layout shift)`);
    if (!/\balt=/.test(tag)) errors.push(`${rel}: <img> missing alt text`);
    if (/fetchpriority=["']high/i.test(tag) || /loading=["']eager/.test(tag)) priorityCount += 1;
    if (!/\bloading=/.test(tag) && !/fetchpriority=["']high/i.test(tag))
      errors.push(`${rel}: <img> missing loading hint (loading="lazy" or fetchpriority="high")`);
  }
}

console.log("Image QA");
console.log(
  `  raster assets scanned: ${assetFiles.filter((f) => RASTER.has(extname(f).toLowerCase())).length}`,
);
console.log(`  <img> tags scanned:    ${imgCount}`);
console.log(`  priority (eager) imgs: ${priorityCount} (max 1 — the LCP visual)`);
if (priorityCount > 1)
  errors.push(
    `${priorityCount} images marked priority/eager; only the above-the-fold LCP visual may be`,
  );
for (const n of notes) console.log(`  modern format: ${n}`);

if (errors.length) {
  console.error("\nImage QA failed:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("\nImage QA passed: all raster assets within budget and served in modern formats.");
