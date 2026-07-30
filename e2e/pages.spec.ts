import { expect, test } from "@playwright/test";
import { collectClientErrors } from "./helpers";

const pages = [
  { path: "/", heading: /VouchList remembers/i },
  { path: "/features", heading: /.+/ },
  { path: "/how-it-works", heading: /.+/ },
  { path: "/communities", heading: /.+/ },
  { path: "/trust", heading: /.+/ },
  { path: "/faq", heading: /.+/ },
];

for (const item of pages) {
  test(`page ${item.path} loads without client errors`, async ({ page }) => {
    const collector = collectClientErrors(page);

    const response = await page.goto(item.path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `HTTP status for ${item.path}`).toBe(200);

    const h1 = page.locator("h1");
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText(item.heading);

    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    await expect(page).toHaveTitle(/VouchList/i);

    await page.waitForLoadState("networkidle");
    expect(collector.errors, `client errors on ${item.path}`).toEqual([]);
  });
}

test("unknown URL returns a real 404 with recovery links", async ({ page }) => {
  const collector = collectClientErrors(page);
  const response = await page.goto("/this-page-does-not-exist", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("link", { name: /FAQ/i }).first()).toBeVisible();
  expect(collector.errors).toEqual([]);
});
