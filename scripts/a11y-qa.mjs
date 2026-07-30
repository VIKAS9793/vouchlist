#!/usr/bin/env node
/**
 * Pre-publish WCAG 2.2 AA accessibility audit.
 *
 * Renders every public route in headless Chromium (desktop and mobile
 * viewports), plus the 404 page and the open waitlist dialog, and runs
 * axe-core restricted to WCAG 2.0/2.1/2.2 level A and AA rules.
 *
 * Violations with impact "critical" or "serious" fail the run; "moderate" and
 * "minor" are reported as warnings. Incomplete checks are listed for review.
 *
 * Usage: node scripts/a11y-qa.mjs [--base http://localhost:8080] [--strict]
 *   --strict also fails on moderate violations.
 * Exits 1 when any ERROR is found so it can gate publishing.
 */
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseArg = process.argv.indexOf("--base");
const BASE = (baseArg > -1 ? process.argv[baseArg + 1] : "http://localhost:8080").replace(
  /\/$/,
  "",
);
const STRICT = process.argv.includes("--strict");

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const FAIL_IMPACTS = STRICT ? ["critical", "serious", "moderate"] : ["critical", "serious"];

const errors = [];
const warnings = [];
const notes = [];

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

function summarise(node) {
  const target = Array.isArray(node.target) ? node.target.join(" ") : String(node.target);
  const html = (node.html || "").replace(/\s+/g, " ").slice(0, 120);
  return `${target} :: ${html}`;
}

/**
 * Scroll-triggered reveal animations start elements at low opacity, which axe
 * reads as a contrast failure. Walk the page so every section has settled
 * before the audit runs.
 */
async function settleAnimations(page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.75);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
  await page.waitForTimeout(600);
}

async function audit(page, label) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  for (const violation of results.violations) {
    const impact = violation.impact || "minor";
    const nodes = violation.nodes;
    const detail =
      `${violation.id} (${impact}, ${nodes.length} node${nodes.length === 1 ? "" : "s"}): ${violation.help}\n      ` +
      nodes.slice(0, 3).map(summarise).join("\n      ") +
      `\n      ${violation.helpUrl}`;
    if (FAIL_IMPACTS.includes(impact)) errors.push({ target: label, msg: detail });
    else warnings.push({ target: label, msg: detail });
  }

  for (const item of results.incomplete) {
    let nodes = item.nodes;
    if (item.id === "color-contrast") {
      const { unknown, failing } = await recheckContrast(page, nodes);
      for (const node of failing) {
        errors.push({
          target: label,
          msg: `color-contrast (verified in view): ${summarise(node)}`,
        });
      }
      nodes = unknown;
    }
    if (nodes.length === 0) continue;
    notes.push({
      target: label,
      msg:
        `${item.id} needs manual review (${nodes.length} node${nodes.length === 1 ? "" : "s"}): ${item.help}\n      ` +
        nodes
          .slice(0, 3)
          .map(
            (node) =>
              `${summarise(node)}\n        ${(node.any ?? []).map((c) => c.message).join(" | ")}`,
          )
          .join("\n      "),
    });
  }

  return results.violations.length;
}

/**
 * Axe cannot sample a backdrop when an element's centre point is scrolled or
 * clipped out of view, so it defers the contrast rule instead of judging it.
 * Scroll each such node fully into view and measure it for real: passing nodes
 * are resolved, failing nodes become errors, only unmeasurable ones stay notes.
 */
async function recheckContrast(page, nodes) {
  const unknown = [];
  const failing = [];
  for (const node of nodes) {
    const selector = Array.isArray(node.target)
      ? node.target[node.target.length - 1]
      : String(node.target);
    const locator = page.locator(String(selector)).first();
    try {
      await locator.scrollIntoViewIfNeeded({ timeout: 2000 });
      await page.waitForTimeout(60);
    } catch {
      unknown.push(node);
      continue;
    }
    const retry = await new AxeBuilder({ page })
      .include(String(selector))
      .withRules(["color-contrast"])
      .analyze();
    if (retry.violations.length > 0) failing.push(...retry.violations.flatMap((v) => v.nodes));
    else if (retry.incomplete.length > 0) unknown.push(node);
  }
  return { unknown, failing };
}

async function openWaitlistDialog(page) {
  const trigger = page.getByRole("button", { name: /Join the waitlist/i }).first();
  const dialog = page.getByRole("dialog");
  await trigger.waitFor({ state: "visible", timeout: 15000 });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await trigger.click();
    try {
      await dialog.waitFor({ state: "visible", timeout: 3000 });
      return true;
    } catch {
      await page.waitForTimeout(500);
    }
  }
  return false;
}

async function main() {
  const routes = discoverRoutes();
  const browser = await chromium.launch();

  const viewports = [
    { name: "desktop", width: 1280, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ];

  let checks = 0;

  // Both colour themes are user-selectable, so both must pass contrast.
  const themes = ["light", "dark"];

  for (const viewport of viewports) {
    for (const theme of themes) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: "reduce",
        colorScheme: theme,
      });
      // Seed the stored preference so the pre-paint script applies the theme.
      await context.addInitScript((value) => {
        try {
          window.localStorage.setItem("vouchlist-theme", value);
        } catch {}
      }, theme);
      const page = await context.newPage();

      for (const route of [...routes, "/this-page-does-not-exist"]) {
        const label = `${route} [${viewport.name}, ${theme}]`;
        const response = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
        if (!response) {
          errors.push({ target: label, msg: "no response from the server" });
          continue;
        }
        await page.waitForLoadState("networkidle").catch(() => {});
        await settleAnimations(page);
        const count = await audit(page, label);
        checks += 1;
        console.log(`  ${count === 0 ? "ok  " : "FAIL"} ${label}`);
      }

      const dialogLabel = `/ waitlist dialog [${viewport.name}, ${theme}]`;
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      if (await openWaitlistDialog(page)) {
        await page.waitForTimeout(600);
        const count = await audit(page, dialogLabel);
        checks += 1;
        console.log(`  ${count === 0 ? "ok  " : "FAIL"} ${dialogLabel}`);
      } else {
        errors.push({
          target: dialogLabel,
          msg: "waitlist dialog did not open, could not audit it",
        });
      }

      await context.close();
    }
  }

  await browser.close();

  const print = (list, tag) => {
    for (const item of list) console.log(`${tag} ${item.target}\n    ${item.msg}`);
  };

  console.log(
    `\nAccessibility audit: WCAG 2.0/2.1/2.2 level A and AA, ${checks} page states checked.\n`,
  );
  if (notes.length) {
    print(notes, "note ");
    console.log("");
  }
  if (warnings.length) {
    print(warnings, "warn ");
    console.log("");
  }
  if (errors.length) {
    print(errors, "ERROR");
    console.log("");
  }

  console.log(
    `${errors.length} error(s), ${warnings.length} warning(s), ${notes.length} manual review item(s).`,
  );
  if (errors.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
