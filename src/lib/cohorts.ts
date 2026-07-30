/**
 * Weekly cohorts.
 *
 * Puts the two halves of the funnel on the same calendar: what search did in a
 * week, and what the waitlist did in that same week. Pure functions on data
 * that both the server and the dashboard can use.
 */
export type DailyPoint = { key: string; clicks: number; impressions: number; position: number };
export type DailySignups = { key: string; count: number; confirmed: number };

export type Cohort = {
  /** ISO date of the first day in the week. */
  start: string;
  /** ISO date of the last day in the week. */
  end: string;
  label: string;
  impressions: number;
  clicks: number;
  ctr: number;
  /** Impression weighted average position. 0 when there were no impressions. */
  position: number;
  signups: number;
  confirmed: number;
  confirmRate: number;
  /** Signups per 1,000 impressions: how much search interest turned into intent. */
  signupsPer1kImpressions: number;
  /** True when search has not reported every day in this week yet. */
  searchPartial: boolean;
};

function toTime(day: string) {
  return Date.parse(`${day}T00:00:00Z`);
}

function isoDayFrom(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

const DAY = 86_400_000;

function shortDate(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * Splits the window into whole weeks, newest first, and fills each week with
 * both sources. Weeks with nothing at all in them are dropped so the view does
 * not open with a run of empty rows.
 */
export function buildCohorts(
  searchDays: DailyPoint[],
  signupDays: DailySignups[],
  windowDays: number,
): Cohort[] {
  const days = [...searchDays.map((row) => row.key), ...signupDays.map((row) => row.key)].filter(
    Boolean,
  );
  if (days.length === 0) return [];

  const searchByDay = new Map(searchDays.map((row) => [row.key, row]));
  const signupsByDay = new Map(signupDays.map((row) => [row.key, row]));
  const latest = Math.max(...days.map(toTime));
  const weeks = Math.max(1, Math.min(13, Math.floor(windowDays / 7)));

  const cohorts: Cohort[] = [];
  for (let index = 0; index < weeks; index += 1) {
    const endTime = latest - index * 7 * DAY;
    const startTime = endTime - 6 * DAY;

    let impressions = 0;
    let clicks = 0;
    let weightedPosition = 0;
    let signups = 0;
    let confirmed = 0;
    let searchDaysSeen = 0;

    for (let offset = 0; offset < 7; offset += 1) {
      const day = isoDayFrom(startTime + offset * DAY);
      const search = searchByDay.get(day);
      if (search) {
        searchDaysSeen += 1;
        impressions += search.impressions;
        clicks += search.clicks;
        weightedPosition += search.position * search.impressions;
      }
      const signup = signupsByDay.get(day);
      if (signup) {
        signups += signup.count;
        confirmed += signup.confirmed;
      }
    }

    if (impressions === 0 && clicks === 0 && signups === 0) continue;

    const start = isoDayFrom(startTime);
    const end = isoDayFrom(endTime);
    cohorts.push({
      start,
      end,
      label: `${shortDate(start)} to ${shortDate(end)}`,
      impressions,
      clicks,
      ctr: impressions > 0 ? clicks / impressions : 0,
      position: impressions > 0 ? weightedPosition / impressions : 0,
      signups,
      confirmed,
      confirmRate: signups > 0 ? confirmed / signups : 0,
      signupsPer1kImpressions: impressions > 0 ? (signups / impressions) * 1000 : 0,
      searchPartial: searchDaysSeen > 0 && searchDaysSeen < 7,
    });
  }

  return cohorts;
}
