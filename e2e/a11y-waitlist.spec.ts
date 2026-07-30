import { expect, test, type Locator, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { openWaitlistDialog, settleHumanTiming, testEmail } from "./helpers";

/**
 * Accessibility regression tests for the waitlist form.
 *
 * The publish gate (scripts/a11y-form-qa.mjs) sweeps the form broadly across
 * themes and viewports. These tests pin the states that are easy to break in a
 * later refactor and hard to notice by eye: idle, in flight, a rate limited
 * reply, a spam block and client validation errors. Each one is scanned with
 * axe on the WCAG 2.2 AA rule set and asserted for the announcement and focus
 * behaviour screen reader and keyboard users depend on.
 */

// Reveal and spinner animations otherwise leave elements mid-fade, which axe
// reads as a contrast failure.
test.use({ reducedMotion: "reduce" });

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SCOPE = "[data-a11y-state]";

/** Runs axe over the form only and fails on critical or serious violations. */
async function scan(page: Page, form: Locator, state: string) {
  await form.evaluate((el, value) => el.setAttribute("data-a11y-state", value), state);
  const results = await new AxeBuilder({ page }).include(SCOPE).withTags(WCAG_TAGS).analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  const detail = blocking
    .map((v) => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map((n) => n.html).join(" | ")}`)
    .join("\n");
  expect(detail, `axe violations in the "${state}" state`).toBe("");
}

/** Every visible control needs a name, and describedby must resolve. */
async function assertFieldWiring(form: Locator, { expectInvalid }: { expectInvalid: boolean }) {
  const fields = await form.evaluate((root) =>
    [...root.querySelectorAll("input, select, textarea")]
      .filter(
        (el) => !el.closest("[aria-hidden='true']") && (el as HTMLInputElement).type !== "hidden",
      )
      .map((el) => {
        const id = el.id;
        const label = id ? root.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
        const described = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
        const box = el.getBoundingClientRect();
        return {
          id,
          name: (label?.textContent || el.getAttribute("aria-label") || "").trim(),
          invalid: el.getAttribute("aria-invalid") === "true",
          described,
          dangling: described.filter((ref) => !document.getElementById(ref)),
          height: Math.round(box.height),
          width: Math.round(box.width),
        };
      }),
  );

  expect(fields.length).toBeGreaterThan(0);
  for (const field of fields) {
    expect(field.name, `control #${field.id} has no accessible name`).not.toBe("");
    expect(field.dangling, `#${field.id} describes itself with missing elements`).toEqual([]);
    // WCAG 2.2 AA target size (minimum).
    expect(field.height, `#${field.id} is below the 24px target size`).toBeGreaterThanOrEqual(24);
    expect(field.width, `#${field.id} is below the 24px target size`).toBeGreaterThanOrEqual(24);
    if (field.invalid) {
      expect(field.described.length, `#${field.id} is invalid with no error text`).toBeGreaterThan(
        0,
      );
    }
  }

  const invalid = fields.filter((f) => f.invalid).length;
  if (expectInvalid) expect(invalid, "expected an aria-invalid control").toBeGreaterThan(0);
  else expect(invalid, "controls marked invalid before any submit").toBe(0);
}

/** A rejection must be announced in text, not signalled by colour alone. */
async function assertAnnouncedError(form: Locator, pattern: RegExp) {
  const alert = form.getByRole("alert").filter({ hasText: pattern }).first();
  await expect(alert).toBeVisible();
  expect((await alert.innerText()).trim().length).toBeGreaterThan(10);

  const colourOnly = await form.evaluate((root) =>
    [...root.querySelectorAll(".text-destructive")].every((el) => !(el.textContent || "").trim()),
  );
  expect(colourOnly, "errors are conveyed by colour alone (WCAG 1.4.1)").toBe(false);
}

/**
 * The waitlist section mounts lazily and hydrates after it scrolls into view,
 * which can wipe a value typed a moment too early. Re-fill until it sticks.
 */
async function fill(form: Locator, label: string, value: string) {
  const field = form.getByLabel(label, { exact: false }).first();
  await expect(async () => {
    await field.fill(value);
    await expect(field).toHaveValue(value, { timeout: 1000 });
  }).toPass({ timeout: 15000 });
}

async function submit(form: Locator) {
  await form.getByRole("button", { name: /Join the waitlist/i }).click();
}

/** Opens the home page and returns the inline waitlist form, fully revealed. */
async function inlineForm(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => {});
  const form = page
    .locator("form")
    .filter({ hasText: /Join the waitlist/i })
    .first();
  await form.waitFor({ state: "visible" });
  await form.scrollIntoViewIfNeeded();
  // Reveal animations fade sections in; a half-faded element reads as a
  // contrast failure, so wait until the form and its wrappers are opaque.
  await form.evaluate(async (root) => {
    const opaque = () => {
      let el: HTMLElement | null = root as HTMLElement;
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
  // The submit button relabels itself while the request is in flight, so pin a
  // stable handle instead of matching on the button text.
  await form.evaluate((el) => el.setAttribute("data-test-form", "waitlist"));
  return page.locator("[data-test-form='waitlist']");
}

test("idle form is accessible and reports no premature errors", async ({ page }) => {
  const form = await inlineForm(page);
  await scan(page, form, "idle");
  await assertFieldWiring(form, { expectInvalid: false });
  await expect(form).toHaveAttribute("aria-busy", "false");
});

test("validation errors are announced and take focus", async ({ page }) => {
  const form = await inlineForm(page);

  // Empty required fields.
  await submit(form);
  await scan(page, form, "empty-required");
  await assertFieldWiring(form, { expectInvalid: true });
  await expect(form.getByRole("alert").first()).toBeVisible();

  // A malformed address: focus must land on the field that failed.
  await fill(form, "Your name", "Test Neighbour");
  await fill(form, "Email", "not-an-email");
  await submit(form);
  await scan(page, form, "invalid-email");
  await assertFieldWiring(form, { expectInvalid: true });
  expect(await page.evaluate(() => document.activeElement?.getAttribute("type"))).toBe("email");
});

test("the submitting state stays accessible while the request is in flight", async ({
  page,
}, testInfo) => {
  // Hold the server response open so the busy state can be audited.
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/_serverFn/**", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await held;
    return route.continue();
  });

  const form = await inlineForm(page);
  await fill(form, "Your name", "Test Neighbour");
  await fill(form, "Email", testEmail(testInfo));
  await settleHumanTiming(page);
  await submit(form);

  await expect(form).toHaveAttribute("aria-busy", "true");
  // The progress message lives in a polite live region, not in the label only.
  const progress = form
    .getByRole("status")
    .filter({ hasText: /Submitting your waitlist request/i })
    .first();
  await expect(progress).toHaveAttribute("aria-live", "polite");
  // The button keeps an accessible name while it is busy, so a screen reader
  // user is never left on an unnamed disabled control.
  const button = form.getByRole("button", { name: /Joining/i });
  await expect(button).toBeDisabled();
  await scan(page, form, "submitting");

  release();
  await expect(
    page.getByRole("status").filter({ hasText: /Welcome to the neighbourhood/i }),
  ).toBeVisible();
});

test("a spam block is announced without a field-level cue", async ({ page }, testInfo) => {
  await page.goto("/");
  const dialog = await openWaitlistDialog(page);
  const form = dialog.locator("form").first();

  // Links in a text field are treated as spam, so the reply is form level.
  await fill(form, "Your name", "Link Bot");
  await fill(form, "Email", testEmail(testInfo));
  await form
    .getByLabel(/community/i)
    .first()
    .fill("https://spam.example/offers");
  await settleHumanTiming(page);
  await submit(form);

  await assertAnnouncedError(form, /Links are not allowed/i);
  await scan(page, form, "spam-blocked");
  // Focus lands on the message; nothing else points the user at it.
  const focusedText = await page.evaluate(() => document.activeElement?.textContent ?? "");
  expect(focusedText).toMatch(/Links are not allowed/i);
});

test("a rate limited reply is announced and keeps the form usable", async ({ page }, testInfo) => {
  test.slow();
  const email = testEmail(testInfo);
  let form = await inlineForm(page);

  // The window allows three attempts per address; the fourth is refused.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await fill(form, "Your name", "Repeat Visitor");
    await fill(form, "Email", email);
    await settleHumanTiming(page);
    await submit(form);
    await expect(page.getByRole("alert").or(page.getByRole("status")).first()).toBeVisible();
    if (attempt < 3) form = await inlineForm(page);
  }

  await assertAnnouncedError(form, /Too many signups/i);
  await scan(page, form, "rate-limited");
  await assertFieldWiring(form, { expectInvalid: false });
  // A refusal is not a validation failure: the fields stay editable.
  await expect(form.getByLabel("Email", { exact: false }).first()).toBeEditable();
  const focusedText = await page.evaluate(() => document.activeElement?.textContent ?? "");
  expect(focusedText).toMatch(/Too many signups/i);
});
