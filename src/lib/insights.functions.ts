import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SITE_ORIGIN } from "./site";
import type { SearchConsoleSignals, WaitlistSignals, WaitlistSegment } from "./insights.server";
import { buildCohorts, type Cohort } from "./cohorts";

export type InsightsInput = {
  days?: number;
  property?: string;
  community?: string;
  city?: string;
  role?: string;
};

export type InsightsResult =
  | { ok: false; reason: "forbidden" }
  | {
      ok: true;
      days: number;
      properties: string[];
      search: SearchConsoleSignals | { available: false; message: string };
      waitlist: WaitlistSignals;
      /** Whole weeks in the window, newest first, with search and waitlist side by side. */
      cohorts: Cohort[];
    };

const ALLOWED_WINDOWS = [7, 28, 90];

export const getProductInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: InsightsInput) => input ?? {})
  .handler(async ({ data, context }): Promise<InsightsResult> => {
    const { isOwnerEmail, listCoveringProperties, readSearchConsole, readWaitlistSignals } =
      await import("./insights.server");

    const email = (context.claims as { email?: unknown }).email;
    if (!isOwnerEmail(email)) return { ok: false, reason: "forbidden" };

    const days = ALLOWED_WINDOWS.includes(Number(data.days)) ? Number(data.days) : 28;
    const property = typeof data.property === "string" ? data.property.slice(0, 300) : undefined;
    const clean = (value: unknown) =>
      typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : undefined;
    const segment: WaitlistSegment = {
      community: clean(data.community),
      city: clean(data.city),
      role: clean(data.role),
    };

    const [properties, search, waitlist] = await Promise.all([
      listCoveringProperties(SITE_ORIGIN).catch(() => [] as string[]),
      readSearchConsole(SITE_ORIGIN, days, property).catch((error: unknown) => ({
        available: false as const,
        message:
          error instanceof Error ? error.message : "Search Console is unavailable right now.",
        queries: [],
        pages: [],
        countries: [],
        days: [],
      })),
      readWaitlistSignals(days, segment),
    ]);

    const cohorts = buildCohorts(
      "days" in search && Array.isArray(search.days) ? search.days : [],
      waitlist.byDay,
      days,
    );

    return { ok: true, days, properties, search, waitlist, cohorts };
  });

export type DigestPreview = { ok: false; reason: "forbidden" } | { ok: true; html: string };

/** Renders this week's digest for the owner, without sending anything. */
export const previewWeeklyDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DigestPreview> => {
    const { isOwnerEmail } = await import("./insights.server");
    const email = (context.claims as { email?: unknown }).email;
    if (!isOwnerEmail(email)) return { ok: false, reason: "forbidden" };

    const { buildWeeklyDigest, renderDigestHtml } = await import("./insights-digest.server");
    return { ok: true, html: renderDigestHtml(await buildWeeklyDigest()) };
  });
