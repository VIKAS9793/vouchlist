import { expect, test } from "@playwright/test";
import { openWaitlistDialog, settleHumanTiming, testEmail } from "./helpers";
import { countWaitlistRows, readPrivacyRequest, serviceRoleAvailable } from "./backend";

/**
 * Account free GDPR workflow: anyone can ask for a copy of their waitlist
 * details or have them deleted, proven by a one time emailed link.
 */
async function joinWaitlist(page: import("@playwright/test").Page, email: string) {
  await page.goto("/");
  const dialog = await openWaitlistDialog(page);
  await dialog.getByLabel("Your name").fill("Privacy Neighbour");
  await dialog.getByLabel("Email").fill(email);
  await settleHumanTiming(page);
  await dialog.getByRole("button", { name: /Join the waitlist/i }).click();
  await expect(dialog.getByRole("status")).toContainText(/Check your inbox/i, { timeout: 20_000 });
}

async function startRequest(
  page: import("@playwright/test").Page,
  email: string,
  kind: "export" | "delete",
) {
  await page.goto("/privacy/request", { waitUntil: "networkidle" });
  if (kind === "delete") await page.getByRole("radio", { name: /Delete my details/i }).check();
  await page.getByLabel("Your email address").fill(email);
  await page.getByRole("button", { name: /Send me the link/i }).click();
  await expect(page.getByRole("heading", { name: /Check your inbox/i })).toBeVisible({
    timeout: 20_000,
  });
}

test("a verified request returns a copy of the stored details", async ({ page }, testInfo) => {
  test.skip(!serviceRoleAvailable(), "Backend read key not available in this environment");
  const email = testEmail(testInfo);

  await joinWaitlist(page, email);
  await startRequest(page, email, "export");

  const request = await readPrivacyRequest(email);
  expect(request?.kind).toBe("export");
  expect(request?.status).toBe("pending");
  expect(request?.token).toBeTruthy();

  await page.goto(`/privacy/verify?token=${request!.token}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/everything we hold/i, {
    timeout: 20_000,
  });
  await expect(page.getByText(email, { exact: false })).toBeVisible();

  // Single use: the token is cleared once redeemed, and the entry still exists.
  const used = await readPrivacyRequest(email);
  expect(used?.status).toBe("completed");
  expect(used?.token).toBeNull();
  expect(await countWaitlistRows(email)).toBe(1);
});

test("a verified deletion removes the waitlist entry", async ({ page }, testInfo) => {
  test.skip(!serviceRoleAvailable(), "Backend read key not available in this environment");
  const email = testEmail(testInfo);

  await joinWaitlist(page, email);
  await startRequest(page, email, "delete");

  const request = await readPrivacyRequest(email);
  expect(request?.kind).toBe("delete");

  await page.goto(`/privacy/verify?token=${request!.token}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/details are deleted/i, {
    timeout: 20_000,
  });
  expect(await countWaitlistRows(email)).toBe(0);
});

test("an unknown token reveals nothing", async ({ page }) => {
  await page.goto(`/privacy/verify?token=${"b".repeat(64)}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/not valid/i, {
    timeout: 20_000,
  });
});
