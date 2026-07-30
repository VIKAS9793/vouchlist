import { expect, test, type Page } from "@playwright/test";

/** Opens the search dialog, retrying until the page has hydrated. */
async function openSearch(page: Page) {
  const trigger = page
    .getByRole("button", { name: "Search VouchList" })
    .locator("visible=true")
    .first();
  const input = page.getByPlaceholder("Search recommendations");
  await expect(async () => {
    await trigger.click();
    await expect(input).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  return input;
}

test.describe("site search", () => {
  test("finds a page from a misspelled query and navigates to it", async ({ page }) => {
    await page.goto("/");
    const input = await openSearch(page);
    await input.fill("privcy");

    const first = page.locator("[cmdk-item]").first();
    await expect(first).toContainText(/privacy/i);

    await first.click();
    await expect(page).toHaveURL(/\/trust/);
  });

  test("tolerates typos in vendor style queries", async ({ page }) => {
    await page.goto("/");
    const input = await openSearch(page);
    await input.fill("plumbr");
    await expect(page.locator("[cmdk-item]").first()).toContainText(/plain language search/i);
  });

  test("shows a helpful empty state for nonsense queries", async ({ page }) => {
    await page.goto("/");
    const input = await openSearch(page);
    await input.fill("zzzzqqqxxyy");
    await expect(page.getByText("No matches.")).toBeVisible();
  });
});
