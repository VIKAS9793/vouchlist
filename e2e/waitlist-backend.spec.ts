import { expect, test } from "@playwright/test";
import { collectClientErrors, openWaitlistDialog, settleHumanTiming, testEmail } from "./helpers";
import { readWaitlistRow, serviceRoleAvailable } from "./backend";

/**
 * End-to-end persistence check: a real submission through the UI must return a
 * success response from the backend and land as a row in the waitlist store
 * with exactly the values that were typed.
 */
test("waitlist submission returns success and is stored in the backend", async ({
  page,
}, testInfo) => {
  const collector = collectClientErrors(page);
  const email = testEmail(testInfo);
  const submitted = {
    name: "Backend Persistence Check",
    email,
    community: "Automated QA Society",
    city: "Mumbai",
    role: "Resident",
  };

  await page.goto("/");
  const dialog = await openWaitlistDialog(page);

  await dialog.getByLabel("Your name").fill(submitted.name);
  await dialog.getByLabel("Email").fill(submitted.email);
  await dialog.getByLabel("Community or society").fill(submitted.community);
  await dialog.getByLabel("City").fill(submitted.city);
  await dialog.getByLabel("I am a").selectOption(submitted.role);

  // Capture the actual backend call, not just the UI confirmation. Visitors
  // cannot write to the store directly; the submission goes through the
  // spam-protected server function.
  const insertResponse = page.waitForResponse(
    (res) => res.url().includes("/_serverFn/") && res.request().method() === "POST",
    { timeout: 20_000 },
  );

  await settleHumanTiming(page);
  await dialog.getByRole("button", { name: /Join the waitlist/i }).click();

  const response = await insertResponse;
  expect(response.status(), `insert failed: ${await response.text().catch(() => "")}`).toBe(200);

  await expect(dialog.getByText(/Welcome to the neighbourhood/i)).toBeVisible({ timeout: 20_000 });
  expect(collector.errors).toEqual([]);

  // Verify the stored row itself, so a silently ignored write cannot pass.
  test.skip(!serviceRoleAvailable(), "Backend read key not available in this environment");
  const row = await readWaitlistRow(email);
  expect(row, `no waitlist row stored for ${email}`).toBeTruthy();
  expect(row).toMatchObject({
    name: submitted.name,
    email: submitted.email.toLowerCase(),
    community: submitted.community,
    city: submitted.city,
    role: submitted.role,
  });
  expect(typeof row!.id).toBe("string");
  expect(new Date(row!.created_at).getTime()).toBeGreaterThan(Date.now() - 10 * 60_000);
});

test("waitlist rejects an invalid email at the backend boundary", async ({ page }) => {
  await page.goto("/");
  const dialog = await openWaitlistDialog(page);

  await dialog.getByLabel("Your name").fill("Invalid Email Check");
  await dialog.getByLabel("Email").fill("not-an-email");
  await dialog.getByRole("button", { name: /Join the waitlist/i }).click();

  await expect(dialog.getByRole("alert").first()).toBeVisible();
  await expect(dialog.getByText(/Welcome to the neighbourhood/i)).toHaveCount(0);

  test.skip(!serviceRoleAvailable(), "Backend read key not available in this environment");
  expect(await readWaitlistRow("not-an-email")).toBeNull();
});
