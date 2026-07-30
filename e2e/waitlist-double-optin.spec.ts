import { expect, test } from "@playwright/test";
import { openWaitlistDialog, settleHumanTiming, testEmail } from "./helpers";
import { readWaitlistConfirmState, serviceRoleAvailable } from "./backend";

/**
 * Double opt-in: a signup is stored as a pending lead, and only opening the
 * tokenised confirmation link promotes it to a confirmed lead.
 */
test("a signup stays pending until the confirmation link is opened", async ({ page }, testInfo) => {
  test.skip(!serviceRoleAvailable(), "Backend read key not available in this environment");
  const email = testEmail(testInfo);

  await page.goto("/");
  const dialog = await openWaitlistDialog(page);
  await dialog.getByLabel("Your name").fill("Opt In Neighbour");
  await dialog.getByLabel("Email").fill(email);
  await settleHumanTiming(page);
  await dialog.getByRole("button", { name: /Join the waitlist/i }).click();

  const confirmation = dialog.getByRole("status");
  await expect(confirmation).toContainText(/Check your inbox/i, { timeout: 20_000 });

  // Stored, but not yet a confirmed lead.
  const pending = await readWaitlistConfirmState(email);
  expect(pending?.status).toBe("pending");
  expect(pending?.confirmed_at).toBeNull();
  expect(pending?.confirmation_token).toBeTruthy();

  await page.goto(`/waitlist/confirm?token=${pending!.confirmation_token}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Your email is confirmed/i, {
    timeout: 20_000,
  });

  const confirmed = await readWaitlistConfirmState(email);
  expect(confirmed?.status).toBe("confirmed");
  expect(confirmed?.confirmed_at).not.toBeNull();
  // Single use: the token is cleared once it has been redeemed.
  expect(confirmed?.confirmation_token).toBeNull();
});

test("an unknown confirmation token confirms nobody", async ({ page }) => {
  await page.goto(`/waitlist/confirm?token=${"a".repeat(64)}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/not valid/i, {
    timeout: 20_000,
  });
});
