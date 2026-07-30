import { expect, test } from "@playwright/test";
import { openWaitlistDialog, testEmail } from "./helpers";
import { readWaitlistRow, serviceRoleAvailable } from "./backend";

/**
 * Spam protection, verified through the real UI: a filled honeypot and an
 * instant submit must both be rejected and must never reach the store.
 */
test("a filled honeypot is rejected and never stored", async ({ page }, testInfo) => {
  const email = testEmail(testInfo);
  await page.goto("/");
  const dialog = await openWaitlistDialog(page);

  await dialog.getByLabel("Your name").fill("Honeypot Bot");
  await dialog.getByLabel("Email").fill(email);

  // Only automation finds this field; it is visually hidden and out of the tab order.
  const honeypot = dialog.locator('input[name="website"]');
  await expect(honeypot).toHaveCount(1);
  await expect(honeypot).not.toBeInViewport();
  await honeypot.fill("https://spam.example", { force: true });

  await page.waitForTimeout(3000); // clear the timing guard so only the honeypot can fail
  await dialog.getByRole("button", { name: /Join the waitlist/i }).click();

  await expect(dialog.getByRole("alert").first()).toBeVisible();
  await expect(dialog.getByText(/Welcome to the neighbourhood/i)).toHaveCount(0);

  test.skip(!serviceRoleAvailable(), "Backend read key not available in this environment");
  expect(await readWaitlistRow(email)).toBeNull();
});

test("an instant submit is rejected and never stored", async ({ page }, testInfo) => {
  const email = testEmail(testInfo);
  await page.goto("/");
  const dialog = await openWaitlistDialog(page);

  // Fill and submit immediately, the way a script would.
  await dialog.getByLabel("Your name").fill("Instant Bot");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByRole("button", { name: /Join the waitlist/i }).click();

  await expect(dialog.getByRole("alert").first()).toBeVisible();
  await expect(dialog.getByText(/Welcome to the neighbourhood/i)).toHaveCount(0);

  test.skip(!serviceRoleAvailable(), "Backend read key not available in this environment");
  expect(await readWaitlistRow(email)).toBeNull();
});
