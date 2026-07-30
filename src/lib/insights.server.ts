/**
 * Product interest signals.
 *
 * Two sources, one shape:
 *  - Google Search Console (through the Lovable connector gateway) tells us
 *    what people search for before they ever reach the site.
 *  - The waitlist table tells us who acted on that interest.
 *
 * Server only. Never import this from a component.
 */

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

/** People allowed to read product analytics. One shared staff list. */
export { isOwnerEmail } from "./staff.server";

export type SearchRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchConsoleSignals = {
  available: boolean;
  message?: string;
  property?: string;
  range?: { start: string; end: string };
  totals?: { clicks: number; impressions: number; ctr: number; position: number };
  queries: SearchRow[];
  pages: SearchRow[];
  countries: SearchRow[];
  days: SearchRow[];
};

function gatewayHeaders() {
  const lovableApiKey = process.env.LOVABLE_API_KEY;
  const connectionApiKey = process.env.GOOGLE_SEARCH_CONSOLE_API_KEY;
  if (!lovableApiKey || !connectionApiKey) return null;
  return {
    Authorization: `Bearer ${lovableApiKey}`,
    "X-Connection-Api-Key": connectionApiKey,
  } satisfies Record<string, string>;
}

function coversTarget(siteUrl: string, target: URL) {
  if (siteUrl.startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length).toLowerCase();
    const host = target.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }
  try {
    return target.href.startsWith(new URL(siteUrl).href);
  } catch {
    return false;
  }
}

/** Verified properties that cover the given site, newest API state each call. */
export async function listCoveringProperties(targetUrl: string): Promise<string[]> {
  const headers = gatewayHeaders();
  if (!headers) return [];
  const response = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Search Console site list failed [${response.status}]: ${body}`);
    throw new Error(`Could not list Search Console properties [${response.status}]`);
  }
  const { siteEntry = [] } = (await response.json()) as {
    siteEntry?: Array<{ siteUrl: string; permissionLevel?: string }>;
  };
  const target = new URL(targetUrl);
  return siteEntry
    .filter(
      (entry) =>
        entry.permissionLevel !== "siteUnverifiedUser" && coversTarget(entry.siteUrl, target),
    )
    .map((entry) => entry.siteUrl);
}

export function isoDay(offsetDays: number) {
  const d = new Date(Date.now() - offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function queryDimension(
  property: string,
  headers: Record<string, string>,
  dimension: string,
  range: { start: string; end: string },
  rowLimit: number,
): Promise<SearchRow[]> {
  const response = await fetch(
    `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: range.start,
        endDate: range.end,
        dimensions: [dimension],
        rowLimit,
      }),
    },
  );
  if (response.status === 403) {
    throw new Error("The connected Google account cannot read this Search Console property");
  }
  if (!response.ok) {
    const body = await response.text();
    console.error(`Search Console ${dimension} query failed [${response.status}]: ${body}`);
    throw new Error(`Search Console query failed [${response.status}]`);
  }
  const { rows = [] } = (await response.json()) as {
    rows?: Array<{
      keys?: string[];
      clicks?: number;
      impressions?: number;
      ctr?: number;
      position?: number;
    }>;
  };
  return rows.map((row) => ({
    key: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

/** Pulls the last `days` of search demand for the chosen (or resolved) property. */
export async function readSearchConsole(
  targetUrl: string,
  days: number,
  selectedProperty?: string,
): Promise<SearchConsoleSignals> {
  // Search Console data lags by two to three days, so the window ends earlier
  // than today rather than showing a run of empty trailing days.
  return readSearchWindow(targetUrl, { start: isoDay(days + 2), end: isoDay(2) }, selectedProperty);
}

/** Same read as above, for an explicit date range. Used by period comparisons. */
export async function readSearchWindow(
  targetUrl: string,
  range: { start: string; end: string },
  selectedProperty?: string,
): Promise<SearchConsoleSignals> {
  const empty = { queries: [], pages: [], countries: [], days: [] };
  const headers = gatewayHeaders();
  if (!headers) {
    return { available: false, message: "Search Console is not connected yet.", ...empty };
  }

  const properties = await listCoveringProperties(targetUrl);
  if (properties.length === 0) {
    return {
      available: false,
      message: "No verified Search Console property covers this site yet.",
      ...empty,
    };
  }
  const property =
    selectedProperty && properties.includes(selectedProperty) ? selectedProperty : properties[0];

  const [queries, pages, countries, daily] = await Promise.all([
    queryDimension(property, headers, "query", range, 25),
    queryDimension(property, headers, "page", range, 15),
    queryDimension(property, headers, "country", range, 10),
    queryDimension(property, headers, "date", range, 90),
  ]);

  const clicks = daily.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = daily.reduce((sum, row) => sum + row.impressions, 0);
  const position =
    impressions > 0
      ? daily.reduce((sum, row) => sum + row.position * row.impressions, 0) / impressions
      : 0;

  return {
    available: true,
    property,
    range,
    totals: { clicks, impressions, ctr: impressions > 0 ? clicks / impressions : 0, position },
    queries,
    pages,
    countries,
    days: daily,
  };
}

export type WaitlistSignals = {
  total: number;
  confirmed: number;
  pending: number;
  confirmRate: number;
  last7: number;
  last30: number;
  byDay: Array<{ key: string; count: number; confirmed: number }>;
  topCommunities: Array<{ key: string; count: number }>;
  topCities: Array<{ key: string; count: number }>;
  topRoles: Array<{ key: string; count: number }>;
  /** Counts for every signup, ignoring the current segment. Used as the comparison baseline. */
  overall: { total: number; confirmed: number; confirmRate: number };
  /** Every value on record for each field, so the filters can be built without a second read. */
  options: { communities: string[]; cities: string[]; roles: string[] };
  segment: WaitlistSegment;
};

export type WaitlistSegment = { community?: string; city?: string; role?: string };

type WaitlistRow = {
  created_at: string;
  status: string | null;
  community: string | null;
  city: string | null;
  role: string | null;
};

function tally(rows: WaitlistRow[], pick: (row: WaitlistRow) => string | null, limit: number) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = pick(row)?.trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

function optionsFor(rows: WaitlistRow[], pick: (row: WaitlistRow) => string | null) {
  const values = new Set<string>();
  for (const row of rows) {
    const value = pick(row)?.trim();
    if (value) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

function matchesSegment(row: WaitlistRow, segment: WaitlistSegment) {
  const same = (value: string | null, wanted?: string) =>
    !wanted || (value ?? "").trim().toLowerCase() === wanted.trim().toLowerCase();
  return (
    same(row.community, segment.community) &&
    same(row.city, segment.city) &&
    same(row.role, segment.role)
  );
}

/** Demand that turned into intent: signups, confirmations, and where they are. */
export async function readWaitlistSignals(
  days: number,
  segment: WaitlistSegment = {},
): Promise<WaitlistSignals> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("waitlist")
    .select("created_at, status, community, city, role")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    console.error("waitlist signals read failed", error.code, error.message);
    throw new Error("Could not read waitlist signals");
  }

  const allRows = (data ?? []) as WaitlistRow[];
  const rows = allRows.filter((row) => matchesSegment(row, segment));
  const now = Date.now();
  const since = (d: number) => now - d * 86_400_000;
  const at = (row: WaitlistRow) => new Date(row.created_at).getTime();

  const confirmed = rows.filter((row) => row.status === "confirmed").length;
  const overallConfirmed = allRows.filter((row) => row.status === "confirmed").length;
  const byDayCounts = new Map<string, { count: number; confirmed: number }>();
  for (let offset = days - 1; offset >= 0; offset -= 1)
    byDayCounts.set(isoDay(offset), { count: 0, confirmed: 0 });
  for (const row of rows) {
    const day = new Date(row.created_at).toISOString().slice(0, 10);
    const bucket = byDayCounts.get(day);
    if (!bucket) continue;
    bucket.count += 1;
    if (row.status === "confirmed") bucket.confirmed += 1;
  }

  return {
    total: rows.length,
    confirmed,
    pending: rows.length - confirmed,
    confirmRate: rows.length > 0 ? confirmed / rows.length : 0,
    last7: rows.filter((row) => at(row) >= since(7)).length,
    last30: rows.filter((row) => at(row) >= since(30)).length,
    byDay: [...byDayCounts.entries()].map(([key, bucket]) => ({ key, ...bucket })),
    topCommunities: tally(rows, (row) => row.community, 8),
    topCities: tally(rows, (row) => row.city, 8),
    topRoles: tally(rows, (row) => row.role, 8),
    overall: {
      total: allRows.length,
      confirmed: overallConfirmed,
      confirmRate: allRows.length > 0 ? overallConfirmed / allRows.length : 0,
    },
    options: {
      communities: optionsFor(allRows, (row) => row.community),
      cities: optionsFor(allRows, (row) => row.city),
      roles: optionsFor(allRows, (row) => row.role),
    },
    segment,
  };
}
