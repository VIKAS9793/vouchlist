import { expect, test } from "@playwright/test";
import { openWaitlistDialog, settleHumanTiming, testEmail } from "./helpers";
import { serviceRoleAvailable } from "./backend";

/**
 * Submitting the same address twice must never create a second waitlist row.
 * The backend answers the repeat signup as "already on the list" and the UI
 * says so, instead of showing a duplicate error.
 */
async function submit(page: import("@playwright/test").Page, email: string, name: string) {
  await page.goto("/");
  const dialog = await openWaitlistDialog(page);
  await dialog.getByLabel("Your name").fill(name);
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("City").fill("Mumbai");

  const call = page.waitForResponse(
    (res) => res.url().includes("/_serverFn/") && res.request().method() === "POST",
    { timeout: 20_000 },
  );
  await settleHumanTiming(page);
  await dialog.getByRole("button", { name: /Join the waitlist/i }).click();
  const response = await call;
  expect(response.status(), `submission failed: ${await response.text().catch(() => "")}`).toBe(
    200,
  );
  return dialog;
}

/** Counts stored rows for an address; visitors cannot read the table. */
async function countRows(email: string) {
  const base = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const endpoint = new URL("/rest/v1/waitlist", base);
  endpoint.searchParams.set("select", "id");
  endpoint.searchParams.set("email", `eq.${email.toLowerCase()}`);
  const headers: Record<string, string> = { apikey: key, accept: "application/json" };
  if (key.split(".").length === 3) headers.authorization = `Bearer ${key}`;
  const res = await fetch(endpoint, { headers });
  if (!res.ok) throw new Error(`Backend read failed (${res.status}): ${await res.text()}`);
  return ((await res.json()) as unknown[]).length;
}

test("submitting the same email twice does not create a second waitlist entry", async ({
  page,
}, testInfo) => {
  const email = testEmail(testInfo);

  const first = await submit(page, email, "Duplicate Check One");
  await expect(first.getByRole("status")).toContainText("Welcome to the neighbourhood.", {
    timeout: 20_000,
  });
  await expect(first.getByRole("status")).toContainText(/Check your inbox/i);

  // Same address again, including a different capitalisation, must be treated
  // as the same person.
  const second = await submit(page, email.toUpperCase(), "Duplicate Check Two");
  const confirmation = second.getByRole("status");
  await expect(confirmation).toContainText("Welcome to the neighbourhood.", { timeout: 20_000 });
  await expect(confirmation).toContainText(/already on the list/i);
  await expect(second.getByRole("alert")).toHaveCount(0);

  test.skip(!serviceRoleAvailable(), "Backend read key not available in this environment");
  expect(await countRows(email), "duplicate email created a second row").toBe(1);
});
