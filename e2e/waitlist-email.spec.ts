import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { collectClientErrors, openWaitlistDialog, settleHumanTiming, testEmail } from "./helpers";

/**
 * Confirmation flow for a waitlist signup.
 *
 * Two things must hold after a real submission through the UI:
 *  1. the visitor sees the exact confirmation messaging, and
 *  2. a confirmation email is dispatched to the address they typed.
 *
 * The email assertion needs the project's managed email sending to be
 * configured (a verified sender domain plus the send helper in the codebase).
 * Until that exists the email half is skipped rather than silently passing, so
 * this test starts enforcing delivery the moment sending is switched on.
 */
const SEND_HELPER = "src/lib/email-templates/send-email.ts";
const emailSendingConfigured = () =>
  existsSync(SEND_HELPER) && Boolean(process.env.LOVABLE_API_KEY);

type EmailLogEvent = { event_type?: string; recipient?: string; status?: string };

/** Reads recent managed-email delivery events for one recipient. */
async function findSentEmail(recipient: string) {
  const res = await fetch(
    `https://api.lovable.dev/v1/emails/logs?recipient=${encodeURIComponent(recipient)}&limit=20`,
    { headers: { authorization: `Bearer ${process.env.LOVABLE_API_KEY}` } },
  );
  if (!res.ok) throw new Error(`Email log read failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { events?: EmailLogEvent[] } | EmailLogEvent[];
  const events = Array.isArray(body) ? body : (body.events ?? []);
  return events.find(
    (event) =>
      event.recipient?.toLowerCase() === recipient.toLowerCase() &&
      (event.event_type === "sent" || event.event_type === "rejected"),
  );
}

test("waitlist signup shows the correct confirmation messaging", async ({ page }, testInfo) => {
  const collector = collectClientErrors(page);
  const email = testEmail(testInfo);

  await page.goto("/");
  const dialog = await openWaitlistDialog(page);

  await dialog.getByLabel("Your name").fill("Confirmation Flow Check");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Community or society").fill("Automated QA Society");
  await dialog.getByLabel("City").fill("Mumbai");
  await dialog.getByLabel("I am a").selectOption("Resident");

  const submission = page.waitForResponse(
    (res) => res.url().includes("/_serverFn/") && res.request().method() === "POST",
    { timeout: 20_000 },
  );

  await settleHumanTiming(page);
  await dialog.getByRole("button", { name: /Join the waitlist/i }).click();

  const response = await submission;
  expect(response.status(), `submission failed: ${await response.text().catch(() => "")}`).toBe(
    200,
  );

  // Confirmation messaging, asserted as a live region so screen readers get it too.
  const confirmation = dialog.getByRole("status");
  await expect(confirmation).toBeVisible({ timeout: 20_000 });
  await expect(confirmation).toContainText("Welcome to the neighbourhood.");
  await expect(confirmation).toContainText(
    /Check your inbox|We'll reach out when your city opens up|You are already on the list/i,
  );
  // The form itself is replaced by the confirmation, so nothing can be resubmitted.
  await expect(dialog.getByRole("button", { name: /Join the waitlist/i })).toHaveCount(0);
  expect(collector.errors).toEqual([]);
});

test("waitlist signup dispatches a confirmation email to the address given", async ({
  page,
}, testInfo) => {
  test.skip(
    !emailSendingConfigured(),
    "Managed email sending is not configured for this project yet",
  );

  const email = testEmail(testInfo);
  await page.goto("/");
  const dialog = await openWaitlistDialog(page);
  await dialog.getByLabel("Your name").fill("Confirmation Email Check");
  await dialog.getByLabel("Email").fill(email);
  await settleHumanTiming(page);
  await dialog.getByRole("button", { name: /Join the waitlist/i }).click();
  await expect(dialog.getByRole("status")).toContainText("Welcome to the neighbourhood.", {
    timeout: 20_000,
  });

  // Delivery is asynchronous; poll the managed email log for this recipient.
  let event: EmailLogEvent | undefined;
  for (let attempt = 0; attempt < 10 && !event; attempt += 1) {
    event = await findSentEmail(email);
    if (!event) await page.waitForTimeout(3000);
  }

  expect(event, `no confirmation email dispatched to ${email}`).toBeTruthy();
  expect(event!.event_type, `email was rejected: ${event!.status ?? "unknown reason"}`).toBe(
    "sent",
  );
});
