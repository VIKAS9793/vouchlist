import { expect, test, type Page } from "@playwright/test";
import { clickUntilVisible } from "./helpers";

type Recorded = { name: string; params: Record<string, unknown> };

async function events(page: Page): Promise<Recorded[]> {
  return page.evaluate(
    () => (window as never as { __analyticsEvents?: Recorded[] }).__analyticsEvents ?? [],
  );
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start the tour" })).toBeVisible();
  expect(errors).toEqual([]);
});

/** Starts the tour, tolerating clicks that land before hydration. */
async function startTour(page: Page, heading: RegExp) {
  await clickUntilVisible(
    page,
    page.getByRole("button", { name: "Start the tour" }),
    page.getByRole("dialog", { name: heading }),
    "tour dialog",
  );
}

test("completing the tour reports start, every step and completion", async ({ page }) => {
  await startTour(page, /The problem we start from/i);
  const dialog = page.getByRole("dialog", { name: /The problem we start from/i });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Finish tour" }).click();

  const recorded = await events(page);
  const names = recorded.map((event) => event.name);
  expect(names.filter((name) => name === "onboarding_tour_start")).toHaveLength(1);
  expect(names.filter((name) => name === "onboarding_step_complete")).toHaveLength(4);
  expect(names).toContain("onboarding_tour_complete");
  expect(names).not.toContain("onboarding_tour_skip");

  const start = recorded.find((event) => event.name === "onboarding_tour_start")!;
  expect(start.params.tour_name).toBe("homepage_onboarding");
  expect(start.params.tour_total_steps).toBe(4);
  expect(start.params.tour_id).toEqual(expect.any(String));

  // Every event in the run shares the tour id, so the funnel joins cleanly.
  const tourId = start.params.tour_id;
  for (const event of recorded.filter((e) => e.name.startsWith("onboarding_"))) {
    expect(event.params.tour_id).toBe(tourId);
  }

  const steps = recorded.filter((event) => event.name === "onboarding_step_complete");
  expect(steps.map((event) => event.params.step_id)).toEqual([
    "problem",
    "how-it-works",
    "trust-architecture",
    "waitlist",
  ]);
  expect(steps.map((event) => event.params.step_number)).toEqual([1, 2, 3, 4]);
});

test("skipping mid tour reports the skip with the steps finished so far", async ({ page }) => {
  await startTour(page, /The problem we start from/i);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();

  const recorded = await events(page);
  const skip = recorded.find((event) => event.name === "onboarding_tour_skip");
  expect(skip).toBeTruthy();
  expect(skip!.params.steps_completed).toBe(1);
  expect(skip!.params.step_id).toBe("how-it-works");
  expect(recorded.filter((event) => event.name === "onboarding_step_complete")).toHaveLength(1);
  expect(recorded.map((event) => event.name)).not.toContain("onboarding_tour_complete");
  await expect(page.getByRole("dialog", { name: /How VouchList works/i })).toHaveCount(0);
});
