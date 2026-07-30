import type { Cohort } from "@/lib/cohorts";

const number = new Intl.NumberFormat("en-IN");
const percent = new Intl.NumberFormat("en-IN", { style: "percent", maximumFractionDigits: 1 });
const decimal = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

function Delta({
  current,
  previous,
  lowerIsBetter,
}: {
  current: number;
  previous?: number;
  lowerIsBetter?: boolean;
}) {
  if (previous === undefined || previous === 0) return null;
  const change = (current - previous) / previous;
  if (!Number.isFinite(change) || Math.abs(change) < 0.005) return null;
  const better = lowerIsBetter ? change < 0 : change > 0;
  return (
    <span className={better ? "text-primary" : "text-muted-foreground"}>
      {" "}
      {change > 0 ? "+" : ""}
      {percent.format(change)}
    </span>
  );
}

/**
 * One row per week, so search interest and waitlist intent can be read against
 * each other over the same days.
 */
export function CohortTable({ cohorts }: { cohorts: Cohort[] }) {
  if (cohorts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No full week of data yet. Cohorts appear once search or signups start recording.
      </p>
    );
  }

  const partial = cohorts.some((cohort) => cohort.searchPartial);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <caption className="sr-only">
            Weekly cohorts comparing Search Console engagement with waitlist signups
          </caption>
          <thead>
            <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">
                Week
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Impressions
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Clicks
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Click rate
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Avg position
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Signups
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Confirmed
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Confirm rate
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Signups / 1k views
              </th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort, index) => {
              const older = cohorts[index + 1];
              return (
                <tr key={cohort.start} className="border-b border-border/40 last:border-0">
                  <th scope="row" className="py-3 pr-4 font-normal">
                    {cohort.label}
                    {cohort.searchPartial ? (
                      <span className="text-muted-foreground"> *</span>
                    ) : null}
                  </th>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {number.format(Math.round(cohort.impressions))}
                    <Delta current={cohort.impressions} previous={older?.impressions} />
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {number.format(Math.round(cohort.clicks))}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {percent.format(cohort.ctr)}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {cohort.position > 0 ? decimal.format(cohort.position) : "—"}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {number.format(cohort.signups)}
                    <Delta current={cohort.signups} previous={older?.signups} />
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {number.format(cohort.confirmed)}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {cohort.signups > 0 ? percent.format(cohort.confirmRate) : "—"}
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    {cohort.impressions > 0 ? decimal.format(cohort.signupsPer1kImpressions) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Each row covers seven days. Percentages next to impressions and signups compare the week
        with the one below it.
        {partial ? " Weeks marked with * do not have search data for every day yet." : ""}
      </p>
    </div>
  );
}
