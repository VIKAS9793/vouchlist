import { expect, test, type Page } from "@playwright/test";
import { openWaitlistDialog, settleHumanTiming, testEmail } from "./helpers";
import { countWaitlistRows, serviceRoleAvailable } from "./backend";

/**
 * Rate limiting and the remaining spam paths, driven through the real UI.
 * Every blocked attempt must show the matching error and leave the store
 * untouched.
 */

type Fields = { name: string; email: string; community?: string };

/** Fills the dialog like a person would and returns the resulting message. */
async function submit(page: Page, fields: Fields) {
  await page.goto("/");
  const dialog = await openWaitlistDialog(page);
  await dialog.getByLabel("Your name").fill(fields.name);
  await dialog.getByLabel("Email").fill(fields.email);
  if (fields.community) {
    await dialog
      .getByLabel(/community/i)
      .first()
      .fill(fields.community);
  }
  await settleHumanTiming(page);
  await dialog.getByRole("button", { name: /Join the waitlist/i }).click();
  // Success renders a status region; a rejection renders an alert. The form
  // also keeps a permanent sr-only progress region ("Submitting your waitlist
  // request"), so wait for the settled outcome rather than the first match.
  const outcome = dialog
    .getByRole("alert")
    .or(dialog.getByRole("status"))
    .filter({ hasNotText: /Submitting your waitlist request/i })
    .filter({ hasText: /\S/ })
    .first();
  await expect(outcome).toBeVisible({ timeout: 20000 });
  await expect
    .poll(async () => (await outcome.innerText()).trim().length, { timeout: 20000 })
    .toBeGreaterThan(0);
  return (await outcome.innerText()).trim();
}

test("repeated submissions from the same address are rate limited", async ({ page }, testInfo) => {
  test.slow();
  const email = testEmail(testInfo);

  // The email window allows three attempts; the first stores the only row.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const message = await submit(page, { name: "Repeat Visitor", email });
    expect(message).not.toMatch(/Too many signups/i);
  }

  const blocked = await submit(page, { name: "Repeat Visitor", email });
  expect(blocked).toMatch(/Too many signups from here right now/i);
  expect(blocked).not.toMatch(/Welcome to the neighbourhood/i);

  test.skip(!serviceRoleAvailable(), "Backend read key not available in this environment");
  expect(await countWaitlistRows(email)).toBe(1);
});

test("a disposable address is rejected and never stored", async ({ page }, testInfo) => {
  const email = `e2e-${Date.now()}@mailinator.com`;
  const message = await submit(page, { name: "Throwaway Bot", email });
  expect(message).toMatch(/permanent email address/i);

  test.skip(!serviceRoleAvailable(), "Backend read key not available in this environment");
  expect(await countWaitlistRows(email)).toBe(0);
  void testInfo;
});

test("link spam in a text field is rejected and never stored", async ({ page }, testInfo) => {
  const email = testEmail(testInfo);
  const message = await submit(page, {
    name: "Link Bot",
    email,
    community: "https://spam.example/offers",
  });
  expect(message).toMatch(/Links are not allowed/i);

  test.skip(!serviceRoleAvailable(), "Backend read key not available in this environment");
  expect(await countWaitlistRows(email)).toBe(0);
});
