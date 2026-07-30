import { expect, test } from "@playwright/test";
import { clickUntilVisible } from "./helpers";

/** The colour theme is a visitor choice: it applies instantly and survives a reload. */
async function openThemeMenu(page: import("@playwright/test").Page) {
  await clickUntilVisible(
    page,
    page.getByRole("button", { name: /Change theme/i }),
    page.getByRole("menuitemradio", { name: "Dark" }),
    "theme menu",
  );
}

const isDark = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"));

test("visitors can switch to dark mode and the choice persists", async ({ page }) => {
  await page.goto("/");
  expect(await isDark(page)).toBe(false);

  await openThemeMenu(page);
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect.poll(() => isDark(page)).toBe(true);

  await page.reload();
  // Applied before paint, so there is no light flash on a return visit.
  await expect.poll(() => isDark(page)).toBe(true);

  await openThemeMenu(page);
  await page.getByRole("menuitemradio", { name: "Light" }).click();
  await expect.poll(() => isDark(page)).toBe(false);
});

test("system preference is followed until the visitor chooses", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("/");
  expect(await isDark(page)).toBe(true);
  await context.close();
});
