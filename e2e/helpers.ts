import type { ConsoleMessage, Page, TestInfo } from "@playwright/test";

/**
 * Known-noisy messages that are not app errors.
 */
const IGNORED = [
  /favicon/i,
  /ResizeObserver loop/i,
  /Download the React DevTools/i,
  /\[vite\]/i,
  // The browser logs the document's own non-200 status; the test asserts it directly.
  /Failed to load resource: the server responded with a status of 404/i,
];

export type ErrorCollector = { errors: string[] };

/** Collects console errors and uncaught page exceptions for the life of the page. */
export function collectClientErrors(page: Page): ErrorCollector {
  const collector: ErrorCollector = { errors: [] };

  const push = (text: string) => {
    if (IGNORED.some((pattern) => pattern.test(text))) return;
    collector.errors.push(text);
  };

  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error") push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => push(`pageerror: ${error.message}`));

  return collector;
}

/** Unique address so repeated end-to-end runs never collide with real signups. */
export function testEmail(testInfo: TestInfo) {
  const slug = testInfo.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `e2e+${slug}-${Date.now()}@vouchlist.test`;
}
/** Opens the waitlist dialog, retrying while the page is still hydrating. */
export async function openWaitlistDialog(page: Page) {
  const trigger = page.getByRole("button", { name: /Join the waitlist/i }).first();
  const dialog = page.getByRole("dialog");

  await trigger.waitFor({ state: "visible" });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await trigger.click();
    try {
      await dialog.waitFor({ state: "visible", timeout: 3000 });
      return dialog;
    } catch {
      await page.waitForTimeout(500);
    }
  }
  throw new Error("Waitlist dialog did not open");
}

/**
 * The form rejects submissions that arrive faster than a person can type.
 * Real-user tests wait past that threshold before submitting.
 */
export async function settleHumanTiming(page: Page) {
  await page.waitForTimeout(3000);
}

/**
 * Clicks a control until the expected result appears.
 *
 * A click landing before hydration does nothing, and on a toggle a blind
 * retry can close what the first click opened, so each attempt resets the
 * state with Escape before trying again.
 */
export async function clickUntilVisible(
  page: Page,
  trigger: ReturnType<Page["getByRole"]>,
  expected: ReturnType<Page["getByRole"]>,
  label: string,
) {
  await trigger.first().waitFor({ state: "visible" });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await trigger.first().click();
    try {
      await expected.first().waitFor({ state: "visible", timeout: 2000 });
      return;
    } catch {
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(400);
    }
  }
  throw new Error(`${label} did not appear`);
}
