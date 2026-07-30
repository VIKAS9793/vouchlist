import { expect, test } from "@playwright/test";
import { collectClientErrors, openWaitlistDialog, settleHumanTiming, testEmail } from "./helpers";

test("header navigation reaches every primary section", async ({ page }) => {
  const collector = collectClientErrors(page);
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Primary" });
  for (const [label, path] of [
    ["Features", "/features"],
    ["How it works", "/how-it-works"],
    ["Communities", "/communities"],
    ["Trust", "/trust"],
    ["FAQ", "/faq"],
  ] as const) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator("h1")).toHaveCount(1);
  }

  expect(collector.errors).toEqual([]);
});

test('hero "See how it works" anchor scrolls to the section', async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /See how it works/i }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await expect(page.locator("#how-it-works")).toBeVisible();
});

test("waitlist dialog validates required fields before submitting", async ({ page }) => {
  await page.goto("/");
  const dialog = await openWaitlistDialog(page);
  await dialog.getByRole("button", { name: /Join the waitlist/i }).click();

  await expect(dialog.getByRole("alert").first()).toBeVisible();
  await expect(dialog.getByText(/Welcome to the neighbourhood/i)).toHaveCount(0);
});

test("waitlist CTA submits end to end and confirms", async ({ page }, testInfo) => {
  const collector = collectClientErrors(page);
  await page.goto("/");
  const dialog = await openWaitlistDialog(page);

  await dialog.getByLabel("Your name").fill("Playwright Smoke");
  await dialog.getByLabel("Email").fill(testEmail(testInfo));
  await dialog.getByLabel("Community or society").fill("Automated QA Society");
  await dialog.getByLabel("City").fill("Mumbai");
  await dialog.getByLabel("I am a").selectOption("Resident");
  await settleHumanTiming(page);

  await dialog.getByRole("button", { name: /Join the waitlist/i }).click();

  await expect(dialog.getByText(/Welcome to the neighbourhood/i)).toBeVisible({ timeout: 20_000 });
  expect(collector.errors).toEqual([]);
});
