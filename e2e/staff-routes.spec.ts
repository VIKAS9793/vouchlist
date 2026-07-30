import { expect, test } from "@playwright/test";

/**
 * Staff-only pages must be undiscoverable for everyone else.
 *
 * The gate runs in the browser, so this spec checks what a signed out visitor
 * actually sees: the ordinary not-found screen, none of the page's content,
 * and no sign-in redirect that would confirm the page exists. The HTTP level
 * checks (sitemap, robots.txt, noindex headers, internal links) live in
 * scripts/private-routes-qa.mjs.
 */
const STAFF_ROUTES = ["/insights"];

for (const route of STAFF_ROUTES) {
  test(`${route} looks missing to a signed out visitor`, async ({ page }) => {
    await page.goto(route, { waitUntil: "networkidle" });

    // No bounce to sign in: the URL stays put and the 404 screen renders.
    expect(new URL(page.url()).pathname).toBe(route);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/could not find that page/i);

    const body = (await page.locator("body").innerText()).toLowerCase();
    for (const word of ["cohort", "search console", "signups", "product interest"]) {
      expect(body, `${route} must not show "${word}"`).not.toContain(word);
    }

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/i);
  });
}

test("staff routes are absent from the public link graph and onsite search", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  for (const route of STAFF_ROUTES) {
    await expect(page.locator(`a[href^="${route}"]`)).toHaveCount(0);
  }

  await page.keyboard.press("Control+k");
  const search = page.getByRole("dialog");
  if (await search.isVisible().catch(() => false)) {
    await page.keyboard.type("insights");
    await expect(search.getByRole("option", { name: /insight/i })).toHaveCount(0);
  }
});
