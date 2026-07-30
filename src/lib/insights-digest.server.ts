/**
 * Weekly product interest digest.
 *
 * Same two sources as the /insights dashboard, condensed into one email:
 * what people searched for, and how each waitlist segment moved. Every number
 * is a comparison of the last 7 days against the 7 days before that, because a
 * raw count on its own does not tell you whether interest is growing.
 *
 * Server only. Never import this from a component.
 */
import { SITE_ORIGIN } from "./site";
import { isoDay, readSearchWindow, type SearchRow } from "./insights.server";

const OWNER_EMAIL = "vikassahani17@gmail.com";

export type Movement = { key: string; current: number; previous: number; change: number };

export type DigestData = {
  generatedAt: string;
  current: { start: string; end: string };
  previous: { start: string; end: string };
  search:
    | { available: false; message: string }
    | {
        available: true;
        property: string;
        totals: { clicks: Movement; impressions: Movement; ctr: Movement; position: Movement };
        risingQueries: Movement[];
        fallingQueries: Movement[];
        topPages: Movement[];
      };
  waitlist: {
    signups: Movement;
    confirmed: Movement;
    communities: Movement[];
    cities: Movement[];
    roles: Movement[];
  };
};

function movement(key: string, current: number, previous: number): Movement {
  return { key, current, previous, change: current - previous };
}

function biggestMovers(
  current: Map<string, number>,
  previous: Map<string, number>,
  limit: number,
): Movement[] {
  const keys = new Set([...current.keys(), ...previous.keys()]);
  return [...keys]
    .map((key) => movement(key, current.get(key) ?? 0, previous.get(key) ?? 0))
    .filter((row) => row.current > 0 || row.previous > 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || b.current - a.current)
    .slice(0, limit);
}

function rowMap(rows: SearchRow[], pick: (row: SearchRow) => number) {
  return new Map(rows.map((row) => [row.key, pick(row)]));
}

type WaitlistRow = {
  created_at: string;
  status: string | null;
  community: string | null;
  city: string | null;
  role: string | null;
};

function countBy(rows: WaitlistRow[], pick: (row: WaitlistRow) => string | null) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = pick(row)?.trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

/** Builds the whole digest. Search failures degrade to a message, never a throw. */
export async function buildWeeklyDigest(): Promise<DigestData> {
  const current = { start: isoDay(8), end: isoDay(2) };
  const previous = { start: isoDay(15), end: isoDay(9) };

  const [now, before] = await Promise.all([
    readSearchWindow(SITE_ORIGIN, current).catch((error: unknown) => ({
      available: false as const,
      message: error instanceof Error ? error.message : "Search Console is unavailable right now.",
      queries: [] as SearchRow[],
      pages: [] as SearchRow[],
      countries: [] as SearchRow[],
      days: [] as SearchRow[],
    })),
    readSearchWindow(SITE_ORIGIN, previous).catch(() => null),
  ]);

  const search: DigestData["search"] = now.available
    ? {
        available: true,
        property: now.property ?? "",
        totals: {
          clicks: movement("Clicks", now.totals?.clicks ?? 0, before?.totals?.clicks ?? 0),
          impressions: movement(
            "Impressions",
            now.totals?.impressions ?? 0,
            before?.totals?.impressions ?? 0,
          ),
          ctr: movement("Click rate", now.totals?.ctr ?? 0, before?.totals?.ctr ?? 0),
          position: movement(
            "Average position",
            now.totals?.position ?? 0,
            before?.totals?.position ?? 0,
          ),
        },
        risingQueries: biggestMovers(
          rowMap(now.queries, (row) => row.impressions),
          rowMap(before?.queries ?? [], (row) => row.impressions),
          20,
        )
          .filter((row) => row.change > 0)
          .slice(0, 8),
        fallingQueries: biggestMovers(
          rowMap(now.queries, (row) => row.impressions),
          rowMap(before?.queries ?? [], (row) => row.impressions),
          20,
        )
          .filter((row) => row.change < 0)
          .slice(0, 5),
        topPages: biggestMovers(
          rowMap(now.pages, (row) => row.clicks),
          rowMap(before?.pages ?? [], (row) => row.clicks),
          5,
        ),
      }
    : { available: false, message: now.message ?? "Search Console is unavailable right now." };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("waitlist")
    .select("created_at, status, community, city, role")
    .gte("created_at", new Date(Date.now() - 15 * 86_400_000).toISOString())
    .limit(5000);
  if (error) {
    console.error("digest waitlist read failed", error.code, error.message);
    throw new Error("Could not read waitlist signals for the digest");
  }

  const rows = (data ?? []) as WaitlistRow[];
  const at = (row: WaitlistRow) => new Date(row.created_at).getTime();
  const boundary = Date.now() - 7 * 86_400_000;
  const priorBoundary = Date.now() - 14 * 86_400_000;
  const thisWeek = rows.filter((row) => at(row) >= boundary);
  const lastWeek = rows.filter((row) => at(row) >= priorBoundary && at(row) < boundary);

  return {
    generatedAt: new Date().toISOString(),
    current,
    previous,
    search,
    waitlist: {
      signups: movement("Signups", thisWeek.length, lastWeek.length),
      confirmed: movement(
        "Confirmed",
        thisWeek.filter((row) => row.status === "confirmed").length,
        lastWeek.filter((row) => row.status === "confirmed").length,
      ),
      communities: biggestMovers(
        countBy(thisWeek, (row) => row.community),
        countBy(lastWeek, (row) => row.community),
        5,
      ),
      cities: biggestMovers(
        countBy(thisWeek, (row) => row.city),
        countBy(lastWeek, (row) => row.city),
        5,
      ),
      roles: biggestMovers(
        countBy(thisWeek, (row) => row.role),
        countBy(lastWeek, (row) => row.role),
        5,
      ),
    },
  };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );
}

function whole(value: number) {
  return Math.round(value).toLocaleString("en-IN");
}

function delta(change: number, kind: "count" | "rate" | "position" = "count") {
  if (kind === "rate") {
    const points = change * 100;
    if (Math.abs(points) < 0.05) return "no change";
    return `${points > 0 ? "up" : "down"} ${Math.abs(points).toFixed(1)} points`;
  }
  if (kind === "position") {
    if (Math.abs(change) < 0.05) return "no change";
    // A lower position number is a better ranking, so the wording flips.
    return `${change < 0 ? "better by" : "worse by"} ${Math.abs(change).toFixed(1)}`;
  }
  if (change === 0) return "no change";
  return `${change > 0 ? "up" : "down"} ${whole(Math.abs(change))}`;
}

function moverLine(row: Movement) {
  return `${escapeHtml(row.key)}: ${whole(row.current)} this week (${delta(row.change)})`;
}

function listBlock(title: string, rows: Movement[], emptyText: string) {
  const items = rows.length
    ? rows.map((row) => `<li style="${li}">${moverLine(row)}</li>`).join("")
    : `<li style="${li}">${escapeHtml(emptyText)}</li>`;
  return `<h3 style="${h3}">${escapeHtml(title)}</h3><ul style="${ul}">${items}</ul>`;
}

const body =
  "margin:0;padding:24px 0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;";
const container = "max-width:560px;margin:0 auto;padding:0 24px;";
const h1 = "font-size:22px;line-height:1.3;margin:0 0 4px;";
const h2 = "font-size:17px;margin:28px 0 8px;";
const h3 = "font-size:14px;margin:18px 0 6px;color:#444444;";
const p = "font-size:14px;line-height:1.6;margin:0 0 10px;color:#333333;";
const ul = "margin:0;padding-left:18px;";
const li = "font-size:14px;line-height:1.7;color:#333333;";

/** Plain, readable HTML. No external CSS, no images, no tracking. */
export function renderDigestHtml(digest: DigestData): string {
  const search = digest.search;
  const searchBlock = search.available
    ? `
      <p style="${p}">Property: ${escapeHtml(search.property)}</p>
      <ul style="${ul}">
        <li style="${li}">Impressions: ${whole(search.totals.impressions.current)} (${delta(search.totals.impressions.change)})</li>
        <li style="${li}">Clicks: ${whole(search.totals.clicks.current)} (${delta(search.totals.clicks.change)})</li>
        <li style="${li}">Click rate: ${(search.totals.ctr.current * 100).toFixed(1)}% (${delta(search.totals.ctr.change, "rate")})</li>
        <li style="${li}">Average position: ${search.totals.position.current.toFixed(1)} (${delta(search.totals.position.change, "position")})</li>
      </ul>
      ${listBlock("Searches growing fastest", search.risingQueries, "No search terms grew this week.")}
      ${listBlock("Searches slowing down", search.fallingQueries, "Nothing dropped this week.")}
      ${listBlock("Pages by clicks", search.topPages, "No pages received clicks yet.")}`
    : `<p style="${p}">${escapeHtml(search.message)}</p>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>VouchList weekly interest digest</title></head>
<body style="${body}">
  <div style="${container}">
    <h1 style="${h1}">VouchList weekly digest</h1>
    <p style="${p}">${escapeHtml(digest.current.start)} to ${escapeHtml(digest.current.end)}, compared with ${escapeHtml(digest.previous.start)} to ${escapeHtml(digest.previous.end)}.</p>

    <h2 style="${h2}">Search demand</h2>
    ${searchBlock}

    <h2 style="${h2}">Waitlist intent</h2>
    <ul style="${ul}">
      <li style="${li}">Signups: ${whole(digest.waitlist.signups.current)} (${delta(digest.waitlist.signups.change)})</li>
      <li style="${li}">Confirmed: ${whole(digest.waitlist.confirmed.current)} (${delta(digest.waitlist.confirmed.change)})</li>
    </ul>
    ${listBlock("Biggest changes by community", digest.waitlist.communities, "No community changed this week.")}
    ${listBlock("Biggest changes by city", digest.waitlist.cities, "No city changed this week.")}
    ${listBlock("Biggest changes by role", digest.waitlist.roles, "No role changed this week.")}

    <p style="${p}"><a href="${SITE_ORIGIN}/insights">Open the full dashboard</a></p>
  </div>
</body></html>`;
}

export function renderDigestText(digest: DigestData): string {
  const lines: string[] = [
    "VouchList weekly digest",
    `${digest.current.start} to ${digest.current.end} vs ${digest.previous.start} to ${digest.previous.end}`,
    "",
    "Search demand",
  ];
  if (digest.search.available) {
    const t = digest.search.totals;
    lines.push(
      `Impressions: ${whole(t.impressions.current)} (${delta(t.impressions.change)})`,
      `Clicks: ${whole(t.clicks.current)} (${delta(t.clicks.change)})`,
      `Click rate: ${(t.ctr.current * 100).toFixed(1)}% (${delta(t.ctr.change, "rate")})`,
      `Average position: ${t.position.current.toFixed(1)} (${delta(t.position.change, "position")})`,
      "",
      "Searches growing fastest:",
      ...(digest.search.risingQueries.length
        ? digest.search.risingQueries.map(
            (row) => `- ${row.key}: ${whole(row.current)} (${delta(row.change)})`,
          )
        : ["- none"]),
    );
  } else {
    lines.push(digest.search.message);
  }
  lines.push(
    "",
    "Waitlist intent",
    `Signups: ${whole(digest.waitlist.signups.current)} (${delta(digest.waitlist.signups.change)})`,
    `Confirmed: ${whole(digest.waitlist.confirmed.current)} (${delta(digest.waitlist.confirmed.change)})`,
    "",
    "Biggest segment changes:",
    ...[...digest.waitlist.communities, ...digest.waitlist.cities, ...digest.waitlist.roles].map(
      (row) => `- ${row.key}: ${whole(row.current)} (${delta(row.change)})`,
    ),
    "",
    `${SITE_ORIGIN}/insights`,
  );
  return lines.join("\n");
}

export type DigestSend = { sent: boolean; reason?: "not_configured" | "failed"; to: string };

/**
 * Sends the digest to the owner. Until a sender domain is configured this
 * reports `not_configured` rather than failing the scheduled run.
 */
export async function sendWeeklyDigest(to = OWNER_EMAIL): Promise<DigestSend> {
  const digest = await buildWeeklyDigest();
  const apiKey = process.env.LOVABLE_API_KEY;
  const senderDomain = process.env.SENDER_DOMAIN;

  if (!apiKey || !senderDomain) {
    console.warn("weekly insights digest skipped: no sender domain configured");
    return { sent: false, reason: "not_configured", to };
  }

  try {
    const response = await fetch("https://api.lovable.dev/email/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: `VouchList insights <hello@${senderDomain}>`,
        to,
        subject: `VouchList weekly digest: ${digest.current.start} to ${digest.current.end}`,
        html: renderDigestHtml(digest),
        text: renderDigestText(digest),
      }),
    });
    if (!response.ok) {
      console.error("weekly digest rejected", response.status, await response.text());
      return { sent: false, reason: "failed", to };
    }
    return { sent: true, to };
  } catch (error) {
    console.error("weekly digest send failed", error);
    return { sent: false, reason: "failed", to };
  }
}
