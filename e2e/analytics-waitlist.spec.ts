import { expect, test } from "@playwright/test";
import { collectClientErrors, openWaitlistDialog, settleHumanTiming, testEmail } from "./helpers";

type TrackedEvent = { name: string; params: Record<string, unknown> };

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Conversion tracking, end to end: the browser submits, the backend confirms
 * with its own event id, and the analytics event fires carrying exactly the
 * metadata that was submitted (and no raw email address).
 */
test("waitlist submission fires the analytics conversion with submitted metadata", async ({
  page,
}, testInfo) => {
  const collector = collectClientErrors(page);
  const email = testEmail(testInfo);
  const submitted = {
    name: "Analytics Conversion Check",
    email,
    community: "Automated QA Society",
    city: "Mumbai",
    role: "Resident",
  };

  // gtag.js is a third party; stub it so the test never depends on the network
  // while still asserting the exact hit the browser would have sent.
  const hits: string[] = [];
  await page.route("https://www.googletagmanager.com/**", async (route) => {
    hits.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  });

  await page.goto("/");
  const dialog = await openWaitlistDialog(page);

  await dialog.getByLabel("Your name").fill(submitted.name);
  await dialog.getByLabel("Email").fill(submitted.email);
  await dialog.getByLabel("Community or society").fill(submitted.community);
  await dialog.getByLabel("City").fill(submitted.city);
  await dialog.getByLabel("I am a").selectOption(submitted.role);

  const serverCall = page.waitForResponse(
    (res) => res.url().includes("/_serverFn/") && res.request().method() === "POST",
    { timeout: 20_000 },
  );

  await settleHumanTiming(page);
  await dialog.getByRole("button", { name: /Join the waitlist/i }).click();

  expect((await serverCall).status()).toBe(200);
  await expect(dialog.getByText(/Welcome to the neighbourhood/i)).toBeVisible({ timeout: 20_000 });

  // The conversion event, as handed to gtag.
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.__analyticsEvents ?? [])).some(
          (event: TrackedEvent) => event.name === "waitlist_signup",
        ),
      { timeout: 10_000 },
    )
    .toBe(true);

  const events: TrackedEvent[] = await page.evaluate(() => window.__analyticsEvents ?? []);
  const conversion = events.find((event) => event.name === "waitlist_signup")!;

  expect(conversion.params).toMatchObject({
    method: "waitlist_form",
    form_location: "waitlist_dialog",
    is_duplicate: false,
    lead_city: submitted.city,
    lead_role: submitted.role,
    has_community: true,
    lead_id: await sha256Hex(submitted.email.toLowerCase()),
  });

  // The id is minted by the backend, so a client-only fake cannot satisfy this.
  expect(String(conversion.params.event_id)).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
  expect(conversion.params.transaction_id).toBe(conversion.params.event_id);

  // A new signup also counts as a GA4 lead.
  expect(events.some((event) => event.name === "generate_lead")).toBe(true);

  // Privacy: the raw address must never reach analytics.
  expect(JSON.stringify(events)).not.toContain(submitted.email);

  // The event actually reached the GA queue with the measurement property.
  const queued = await page.evaluate(() =>
    (window.dataLayer ?? []).map((entry) =>
      JSON.stringify(Array.from(entry as ArrayLike<unknown>)),
    ),
  );
  expect(queued.some((entry) => entry.includes("waitlist_signup"))).toBe(true);

  expect(collector.errors).toEqual([]);
});
