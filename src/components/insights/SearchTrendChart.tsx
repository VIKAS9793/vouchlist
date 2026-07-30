import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";

/** Mirrors the daily Search Console row, kept local so no server module reaches the client. */
export type TrendRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type MetricKey = "impressions" | "clicks" | "ctr" | "position";

const METRICS: Array<{
  key: MetricKey;
  label: string;
  /** Lower is better for average position, so the arrow has to flip. */
  lowerIsBetter?: boolean;
  format: (value: number) => string;
}> = [
  {
    key: "impressions",
    label: "Impressions",
    format: (v) => Math.round(v).toLocaleString("en-IN"),
  },
  { key: "clicks", label: "Clicks", format: (v) => Math.round(v).toLocaleString("en-IN") },
  { key: "ctr", label: "Click rate", format: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "position", label: "Average position", lowerIsBetter: true, format: (v) => v.toFixed(1) },
];

function shortDay(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function SearchTrendChart({ rows, days }: { rows: TrendRow[]; days: number }) {
  const [metricKey, setMetricKey] = useState<MetricKey>("impressions");
  const metric = METRICS.find((entry) => entry.key === metricKey) ?? METRICS[0];

  const series = useMemo(
    () =>
      [...rows]
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((row) => ({
          day: row.key,
          label: shortDay(row.key),
          impressions: row.impressions,
          clicks: row.clicks,
          ctr: row.ctr,
          position: row.position,
        })),
    [rows],
  );

  const trend = useMemo(() => {
    if (series.length < 4) return null;
    const values = series.map((point) => point[metric.key]);
    const half = Math.floor(values.length / 2);
    const earlier = average(values.slice(0, half));
    const later = average(values.slice(half));
    if (earlier === 0) return null;
    const change = (later - earlier) / earlier;
    const improving = metric.lowerIsBetter ? change < 0 : change > 0;
    return { change, improving, earlier, later };
  }, [series, metric]);

  if (series.length === 0) {
    return <p className="text-sm text-muted-foreground">No daily search data yet.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Chart metric">
        {METRICS.map((entry) => (
          <Button
            key={entry.key}
            type="button"
            size="sm"
            variant={entry.key === metricKey ? "default" : "outline"}
            className="min-h-11 rounded-xl"
            aria-pressed={entry.key === metricKey}
            onClick={() => setMetricKey(entry.key)}
          >
            {entry.label}
          </Button>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
        {metric.label} over the last {days} days.{" "}
        {trend
          ? `${metric.label} ${trend.improving ? "improved" : "slipped"} by ${Math.abs(trend.change * 100).toFixed(0)} percent between the first and second half of this window (${metric.format(trend.earlier)} to ${metric.format(trend.later)}).`
          : "Not enough days yet to read a trend."}
      </p>

      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="insightsTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={56}
              reversed={metric.lowerIsBetter}
              tickFormatter={(value: number) => metric.format(value)}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "0.75rem",
                fontSize: "0.875rem",
                color: "var(--color-foreground)",
              }}
              labelFormatter={(label: string) => label}
              formatter={(value: number) =>
                [metric.format(value), metric.label] as [string, string]
              }
            />
            <Area
              type="monotone"
              dataKey={metric.key}
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#insightsTrendFill)"
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
              name={metric.label}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm underline underline-offset-4">
          Read the daily numbers as a table
        </summary>
        <div className="mt-3 max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Daily {metric.label.toLowerCase()} for the last {days} days
            </caption>
            <thead>
              <tr>
                <th scope="col" className="py-1 pr-4 font-semibold">
                  Day
                </th>
                <th scope="col" className="py-1 font-semibold">
                  {metric.label}
                </th>
              </tr>
            </thead>
            <tbody>
              {series.map((point) => (
                <tr key={point.day} className="border-t border-border/60">
                  <td className="py-1 pr-4">{point.label}</td>
                  <td className="py-1">{metric.format(point[metric.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
