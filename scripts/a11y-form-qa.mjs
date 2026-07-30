#!/usr/bin/env node
/**
 * WCAG 2.2 AA audit for the waitlist form, including its error states.
 *
 * The site-wide audit (scripts/a11y-qa.mjs) only ever sees the form at rest.
 * Errors are where forms usually fail accessibility, so this gate walks the
 * form through every state a visitor can reach and checks both the axe rules
 * and the behaviour screen reader and keyboard users depend on:
 *
 *   1. resting state
 *   2. client validation errors (empty required fields, malformed email)
 *   3. a server rejection (spam block), which has no field-level cue
 *   4. the success panel
 *
 * Each state is audited in light and dark themes at desktop and mobile sizes.
 *
 * Usage: node scripts/a11y-form-qa.mjs [--base http://localhost:8080] [--strict]
 * Exits 1 on any ERROR so it can gate publishing.
 */
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const baseArg = process.argv.indexOf("--base");
const BASE = (baseArg > -1 ? process.argv[baseArg + 1] : "http://localhost:8080").replace(
  /\/$/,
  "",
);
const STRICT = process.argv.includes("--strict");

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const FAIL_IMPACTS = STRICT ? ["critical", "serious", "moderate"] : ["critical", "serious"];
/** WCAG 2.2 AA target size (minimum) for pointer inputs. */
const MIN_TARGET = 24;

const errors = [];
const warnings = [];
const notes = [];

const fail = (target, msg) => errors.push({ target, msg });
const warn = (target, msg) => warnings.push({ target, msg });

function summarise(node) {
  const target = Array.isArray(node.target) ? node.target.join(" ") : String(node.target);
  const html = (node.html || "").replace(/\s+/g, " ").slice(0, 120);
  return `${target} :: ${html}`;
}

async function axeAudit(page, scope, label) {
  const results = await new AxeBuilder({ page }).include(scope).withTags(WCAG_TAGS).analyze();
  for (const violation of results.violations) {
    const impact = violation.impact || "minor";
    const detail =
      `${violation.id} (${impact}, ${violation.nodes.length} node(s)): ${violation.help}\n      ` +
      violation.nodes.slice(0, 3).map(summarise).join("\n      ") +
      `\n      ${violation.helpUrl}`;
    if (FAIL_IMPACTS.includes(impact)) fail(label, detail);
    else warn(label, detail);
  }
  for (const item of results.incomplete) {
    // color-contrast is left "incomplete" whenever a node's centre point is
    // clipped out of a scrolling container (the dialog scrolls itself to the
    // first error), so axe cannot sample the backdrop. Rather than hand that
    // to a human, scroll each node into view and measure it for real.
    let unresolved = item.nodes;
    if (item.id === "color-contrast") {
      const { unknown, failing } = await recheckContrast(page, item.nodes);
      for (const node of failing) {
        fail(label, `color-contrast (verified in view): ${summarise(node)}`);
      }
      unresolved = unknown;
    }
    if (unresolved.length === 0) continue;
    const detail =
      `${item.id} needs manual review (${unresolved.length} node(s)): ${item.help}\n      ` +
      unresolved
        .slice(0, 5)
        .map(
          (node) =>
            `${summarise(node)}\n        ${(node.any ?? []).map((c) => c.message).join(" | ")}`,
        )
        .join("\n      ");
    notes.push({ target: label, msg: detail });
  }
  return results.violations.length;
}

/**
 * Re-runs the contrast rule on one node at a time with that node scrolled
 * fully into view. Anything that still cannot be resolved stays a note; a node
 * that resolves to a genuine contrast failure is reported as an error.
 */
async function recheckContrast(page, nodes) {
  const stillUnknown = [];
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
      stillUnknown.push(node);
      continue;
    }
    const retry = await new AxeBuilder({ page })
      .include(String(selector))
      .withRules(["color-contrast"])
      .analyze();
    if (retry.violations.length > 0) failing.push(...retry.violations.flatMap((v) => v.nodes));
    if (retry.incomplete.length > 0) stillUnknown.push(node);
  }
  return { unknown: stillUnknown, failing };
}

/**
 * Structural checks axe cannot make: every control needs a name, and every
 * invalid control must point at an error message that actually exists.
 */
async function checkFieldWiring(form, label, { expectInvalid }) {
  const report = await form.evaluate((root, min) => {
    const controls = [...root.querySelectorAll("input, select, textarea")].filter((el) => {
      const hidden = el.closest("[aria-hidden='true']");
      return !hidden && el.type !== "hidden";
    });
    return controls.map((el) => {
      const id = el.id;
      const label = id ? root.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      const described = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
      const box = el.getBoundingClientRect();
      return {
        id,
        tag: el.tagName.toLowerCase(),
        name: (label?.textContent || el.getAttribute("aria-label") || "").trim(),
        invalid: el.getAttribute("aria-invalid") === "true",
        required: el.required || el.getAttribute("aria-required") === "true",
        described,
        missingDescribed: described.filter((ref) => !document.getElementById(ref)),
        small: box.height > 0 && (box.height < min || box.width < min),
        height: Math.round(box.height),
      };
    });
  }, MIN_TARGET);

  if (!report.length) fail(label, "no form controls found, the form did not render");

  for (const field of report) {
    if (!field.name)
      fail(
        label,
        `${field.tag}#${field.id || "(no id)"} has no accessible name (label or aria-label)`,
      );
    if (field.missingDescribed.length)
      fail(
        label,
        `${field.tag}#${field.id} points aria-describedby at missing element(s): ${field.missingDescribed.join(", ")}`,
      );
    if (field.small)
      fail(
        label,
        `${field.tag}#${field.id} is ${field.height}px tall, below the ${MIN_TARGET}px target size`,
      );
    if (field.invalid && !field.described.length)
      fail(
        label,
        `${field.tag}#${field.id} is marked invalid but has no aria-describedby error text`,
      );
  }

  const invalidCount = report.filter((f) => f.invalid).length;
  if (expectInvalid && invalidCount === 0)
    fail(label, "expected at least one control marked aria-invalid after a failed submit");
  if (!expectInvalid && invalidCount > 0)
    fail(label, `${invalidCount} control(s) marked aria-invalid before any submit`);
}

/** Error text must be announced, not just coloured red. */
async function checkErrorAnnouncement(form, label, { expectFocusInsideForm = true } = {}) {
  const info = await form.evaluate((root) => {
    const alerts = [...root.querySelectorAll("[role='alert'], [aria-live='assertive']")];
    return {
      count: alerts.length,
      texts: alerts.map((el) => (el.textContent || "").trim()).filter(Boolean),
      colourOnly: [...root.querySelectorAll(".text-destructive")].every(
        (el) => !(el.textContent || "").trim(),
      ),
    };
  });
  if (info.count === 0)
    fail(label, "error state renders no role=alert region, screen readers announce nothing");
  if (info.texts.length === 0)
    fail(label, "error region is empty, there is no message to announce");
  if (info.colourOnly) fail(label, "errors appear to be conveyed by colour alone (WCAG 1.4.1)");

  const focus = await form.page().evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    return { tag: el.tagName.toLowerCase(), id: el.id, role: el.getAttribute("role") };
  });
  if (!focus)
    fail(label, "focus was left on <body> after a failed submit, keyboard users lose their place");
  else if (expectFocusInsideForm) {
    const inside = await form.evaluate((root) => root.contains(document.activeElement));
    if (!inside)
      fail(label, `focus moved outside the form after a failed submit (${focus.tag}#${focus.id})`);
  }
  return info;
}

/** Every interactive control must show a visible focus ring (WCAG 2.4.11/2.4.7). */
async function checkFocusVisible(form, label) {
  const missing = await form.evaluate((root) => {
    const out = [];
    const controls = [...root.querySelectorAll("input, select, button")].filter(
      (el) => !el.closest("[aria-hidden='true']") && el.offsetParent !== null,
    );
    for (const el of controls) {
      const cls = el.className && typeof el.className === "string" ? el.className : "";
      if (!/focus-visible:|focus:/.test(cls))
        out.push(`${el.tagName.toLowerCase()}#${el.id || "(no id)"}`);
    }
    return out;
  });
  if (missing.length) warn(label, `no focus-visible styling found on: ${missing.join(", ")}`);
}

/**
 * Reveal animations fade sections in, and a half-faded element reads as a
 * contrast failure. Wait until the form and its wrappers are fully opaque.
 */
async function settleReveal(form) {
  await form.evaluate(async (root) => {
    const opaque = () => {
      let el = root;
      while (el && el !== document.body) {
        if (Number(getComputedStyle(el).opacity) < 0.99) return false;
        el = el.parentElement;
      }
      return true;
    };
    for (let i = 0; i < 40 && !opaque(); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });
}

async function fillField(form, name, value) {
  await form.getByLabel(name, { exact: false }).first().fill(value);
}

async function submit(form) {
  await form.getByRole("button", { name: /Join the waitlist/i }).click();
}

async function openDialog(page) {
  const trigger = page.getByRole("button", { name: /Join the waitlist/i }).first();
  const dialog = page.getByRole("dialog");
  await trigger.waitFor({ state: "visible", timeout: 15000 });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await trigger.click();
    try {
      await dialog.waitFor({ state: "visible", timeout: 3000 });
      return dialog;
    } catch {
      await page.waitForTimeout(500);
    }
  }
  return null;
}

/** Walks one rendered form through every state and audits each of them. */
async function auditFormStates(page, form, prefix) {
  let checks = 0;
  const scope = await form.evaluate((el) => {
    el.setAttribute("data-a11y-scope", "waitlist");
    return true;
  });
  const include = "[data-a11y-scope='waitlist']";
  if (!scope) return checks;

  // 1. Resting state.
  await settleReveal(form);
  let label = `${prefix} :: resting`;
  await axeAudit(page, include, label);
  await checkFieldWiring(form, label, { expectInvalid: false });
  await checkFocusVisible(form, label);
  checks += 1;
  console.log(`  ok   ${label}`);

  // 2. Empty submit: required fields must report themselves.
  label = `${prefix} :: empty required fields`;
  await submit(form);
  await page.waitForTimeout(300);
  await axeAudit(page, include, label);
  await checkFieldWiring(form, label, { expectInvalid: true });
  await checkErrorAnnouncement(form, label);
  checks += 1;
  console.log(`  ok   ${label}`);

  // 3. Malformed email: a single field error, with focus landing on it.
  label = `${prefix} :: invalid email`;
  await fillField(form, "Your name", "Test Neighbour");
  await fillField(form, "Email", "not-an-email");
  await submit(form);
  await page.waitForTimeout(300);
  await axeAudit(page, include, label);
  await checkFieldWiring(form, label, { expectInvalid: true });
  await checkErrorAnnouncement(form, label);
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("type"));
  if (focused !== "email")
    fail(label, `focus should move to the invalid email field, it went to "${focused}"`);
  checks += 1;
  console.log(`  ok   ${label}`);

  // 4. Server rejection: links in the name are treated as spam, so the reply
  //    is a form-level message with no field to attach it to.
  label = `${prefix} :: server rejection`;
  await fillField(form, "Your name", "Visit http://spam.example.com now");
  await fillField(form, "Email", `a11y+${Date.now()}@vouchlist.test`);
  await submit(form);
  await form.getByRole("alert").first().waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(300);
  await axeAudit(page, include, label);
  const announced = await checkErrorAnnouncement(form, label);
  if (announced.texts.every((t) => t.length < 10))
    fail(label, "server rejection message is too short to explain what went wrong");
  checks += 1;
  console.log(`  ok   ${label}`);

  return checks;
}

/** The success panel replaces the form, so it is audited on its own. */
async function auditSuccessState(page, root, prefix) {
  const label = `${prefix} :: success`;
  await fillField(root, "Your name", "Test Neighbour");
  await fillField(root, "Email", `a11y+ok-${Date.now()}@vouchlist.test`);
  // The server rejects submissions that arrive faster than a person could type.
  await page.waitForTimeout(4000);
  await submit(root);
  const status = page
    .getByRole("status")
    .filter({ hasText: /Welcome to the neighbourhood/i })
    .first();
  try {
    await status.waitFor({ state: "visible", timeout: 20000 });
  } catch {
    fail(label, "the success panel never appeared after a valid submission");
    return 0;
  }
  await status.evaluate((el) => el.setAttribute("data-a11y-scope", "waitlist-done"));
  await axeAudit(page, "[data-a11y-scope='waitlist-done']", label);
  const live = await status.evaluate((el) => el.getAttribute("aria-live"));
  if (!live)
    fail(label, "the success panel is not a live region, the confirmation is never announced");
  console.log(`  ok   ${label}`);
  return 1;
}

async function main() {
  const browser = await chromium.launch();
  const viewports = [
    { name: "desktop", width: 1280, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ];
  let checks = 0;

  for (const viewport of viewports) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: "reduce",
        colorScheme: theme,
      });
      await context.addInitScript((value) => {
        try {
          window.localStorage.setItem("vouchlist-theme", value);
        } catch {}
      }, theme);
      const page = await context.newPage();
      const suffix = `[${viewport.name}, ${theme}]`;

      // Inline form on the home page.
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      const inline = page
        .locator("form")
        .filter({ hasText: /Join the waitlist/i })
        .first();
      await inline.waitFor({ state: "visible", timeout: 15000 });
      await inline.scrollIntoViewIfNeeded();
      checks += await auditFormStates(page, inline, `inline form ${suffix}`);

      // Dialog form: same component, different container and focus rules.
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      const dialog = await openDialog(page);
      if (!dialog) {
        fail(`dialog form ${suffix}`, "the waitlist dialog did not open, it could not be audited");
      } else {
        const dialogForm = dialog.locator("form").first();
        checks += await auditFormStates(page, dialogForm, `dialog form ${suffix}`);
      }

      // Success path, on a fresh page so nothing is left over.
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      const fresh = page
        .locator("form")
        .filter({ hasText: /Join the waitlist/i })
        .first();
      await fresh.waitFor({ state: "visible", timeout: 15000 });
      await fresh.scrollIntoViewIfNeeded();
      checks += await auditSuccessState(page, fresh, `inline form ${suffix}`);

      await context.close();
    }
  }

  await browser.close();

  const print = (list, tag) => {
    for (const item of list) console.log(`${tag} ${item.target}\n    ${item.msg}`);
  };
  console.log(
    `\nWaitlist form accessibility: WCAG 2.0/2.1/2.2 level A and AA, ${checks} form states checked.\n`,
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
