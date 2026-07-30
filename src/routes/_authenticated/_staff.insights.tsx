import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, BarChart3, LineChart, Mail, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";
import { SearchTrendChart } from "@/components/insights/SearchTrendChart";
import { CohortTable } from "@/components/insights/CohortTable";
import { getProductInsights, previewWeeklyDigest } from "@/lib/insights.functions";
import { MEASUREMENT_ID } from "@/lib/analytics";

export const Route = createFileRoute("/_authenticated/_staff/insights")({
  head: () => ({
    meta: [
      // The title ships in the app shell that everyone receives, so it must
      // give nothing away about what lives here.
      { title: "VouchList" },
      { name: "description", content: "" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: InsightsPage,
});

const WINDOWS = [7, 28, 90];

const number = new Intl.NumberFormat("en-IN");
const percent = new Intl.NumberFormat("en-IN", { style: "percent", maximumFractionDigits: 1 });

function InsightsPage() {
  const [days, setDays] = useState(28);
  const [community, setCommunity] = useState("");
  const [city, setCity] = useState("");
  const [role, setRole] = useState("");
  const fetchInsights = useServerFn(getProductInsights);
  const { data, isPending, isError } = useQuery({
    queryKey: ["product-insights", days, community, city, role],
    queryFn: () => fetchInsights({ data: { days, community, city, role } }),
    staleTime: 5 * 60 * 1000,
  });
  const hasSegment = Boolean(community || city || role);

  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-16">
      <Reveal>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Product interest</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          What people search for before they find VouchList, and how many of them ask to join.
          Search data comes from Google Search Console and lags by about two days.
        </p>

        <div
          className="mt-8 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Time range"
        >
          {WINDOWS.map((window) => (
            <Button
              key={window}
              type="button"
              variant={window === days ? "default" : "outline"}
              className="min-h-11 rounded-xl"
              aria-pressed={window === days}
              onClick={() => setDays(window)}
            >
              Last {window} days
            </Button>
          ))}
        </div>
      </Reveal>

      {data?.ok ? (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="text-sm font-semibold">Compare groups</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Narrow the waitlist numbers to one community, city or role. Search demand is site wide
            and does not change with these filters.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <FilterSelect
              id="filter-community"
              label="Community"
              value={community}
              onChange={setCommunity}
              options={data.waitlist.options.communities}
              allLabel="All communities"
            />
            <FilterSelect
              id="filter-city"
              label="City"
              value={city}
              onChange={setCity}
              options={data.waitlist.options.cities}
              allLabel="All cities"
            />
            <FilterSelect
              id="filter-role"
              label="Role"
              value={role}
              onChange={setRole}
              options={data.waitlist.options.roles}
              allLabel="All roles"
            />
          </div>
          {hasSegment ? (
            <Button
              type="button"
              variant="outline"
              className="mt-4 min-h-11 rounded-xl"
              onClick={() => {
                setCommunity("");
                setCity("");
                setRole("");
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}

      <div aria-live="polite" className="mt-10 space-y-10">
        {isPending ? <p className="text-sm text-muted-foreground">Loading signals...</p> : null}
        {isError ? (
          <p className="text-sm text-destructive">Could not load signals. Please try again.</p>
        ) : null}

        {data && !data.ok ? (
          <p className="text-sm text-muted-foreground">
            This view is limited to the VouchList owner account.
          </p>
        ) : null}

        {data?.ok ? (
          <>
            <Panel icon={<Search aria-hidden="true" className="size-4" />} title="Search demand">
              {data.search.available ? (
                <>
                  <StatGrid
                    stats={[
                      {
                        label: "Impressions",
                        value: number.format(Math.round(data.search.totals!.impressions)),
                      },
                      {
                        label: "Clicks",
                        value: number.format(Math.round(data.search.totals!.clicks)),
                      },
                      { label: "Click rate", value: percent.format(data.search.totals!.ctr) },
                      { label: "Average position", value: data.search.totals!.position.toFixed(1) },
                    ]}
                  />
                  <div className="mt-8 grid gap-8 md:grid-cols-2">
                    <RankedList
                      heading="Top searches"
                      empty="No search queries recorded yet."
                      rows={data.search.queries.map((row) => ({
                        key: row.key,
                        primary: number.format(Math.round(row.impressions)),
                        secondary: `${number.format(Math.round(row.clicks))} clicks`,
                      }))}
                    />
                    <RankedList
                      heading="Pages people land on"
                      empty="No landing pages recorded yet."
                      rows={data.search.pages.map((row) => ({
                        key: row.key.replace(/^https?:\/\/[^/]+/, "") || "/",
                        primary: number.format(Math.round(row.impressions)),
                        secondary: `${number.format(Math.round(row.clicks))} clicks`,
                      }))}
                    />
                  </div>
                  <p className="mt-6 text-xs text-muted-foreground">
                    Property: {data.search.property}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{data.search.message}</p>
              )}
            </Panel>

            <Panel
              icon={<LineChart aria-hidden="true" className="size-4" />}
              title="Search trends over time"
            >
              {data.search.available ? (
                <SearchTrendChart rows={data.search.days} days={days} />
              ) : (
                <p className="text-sm text-muted-foreground">{data.search.message}</p>
              )}
            </Panel>

            <Panel icon={<Users aria-hidden="true" className="size-4" />} title="Waitlist intent">
              <p className="mb-6 text-sm text-muted-foreground">
                {hasSegment
                  ? `Showing ${number.format(data.waitlist.total)} of ${number.format(data.waitlist.overall.total)} signups for ${[community, city, role].filter(Boolean).join(", ")}.`
                  : "Showing every signup on record."}
              </p>
              <StatGrid
                stats={[
                  { label: "Total signups", value: number.format(data.waitlist.total) },
                  { label: "Confirmed", value: number.format(data.waitlist.confirmed) },
                  { label: "Confirm rate", value: percent.format(data.waitlist.confirmRate) },
                  {
                    label: `Last ${days} days`,
                    value: number.format(days <= 7 ? data.waitlist.last7 : data.waitlist.last30),
                  },
                ]}
              />
              {hasSegment ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Everyone: {number.format(data.waitlist.overall.total)} signups,{" "}
                  {percent.format(data.waitlist.overall.confirmRate)} confirm rate. This group is{" "}
                  {percent.format(
                    data.waitlist.overall.total > 0
                      ? data.waitlist.total / data.waitlist.overall.total
                      : 0,
                  )}{" "}
                  of the list.
                </p>
              ) : null}
              <div className="mt-8 grid gap-8 md:grid-cols-3">
                <RankedList
                  heading="Communities"
                  empty="No community named yet."
                  rows={data.waitlist.topCommunities.map((row) => ({
                    key: row.key,
                    primary: number.format(row.count),
                  }))}
                />
                <RankedList
                  heading="Cities"
                  empty="No city named yet."
                  rows={data.waitlist.topCities.map((row) => ({
                    key: row.key,
                    primary: number.format(row.count),
                  }))}
                />
                <RankedList
                  heading="Roles"
                  empty="No role named yet."
                  rows={data.waitlist.topRoles.map((row) => ({
                    key: row.key,
                    primary: number.format(row.count),
                  }))}
                />
              </div>
            </Panel>

            <Panel
              icon={<Users aria-hidden="true" className="size-4" />}
              title="Weekly cohorts: search against signups"
            >
              <p className="mb-6 text-sm text-muted-foreground">
                Every row is one week, so you can see whether weeks with more search interest also
                brought more signups and better confirm rates.
              </p>
              <CohortTable cohorts={data.cohorts} />
            </Panel>

            <Panel
              icon={<BarChart3 aria-hidden="true" className="size-4" />}
              title="Behaviour in Google Analytics"
            >
              <p className="text-sm leading-relaxed text-muted-foreground">
                Page views, the onboarding tour funnel and the waitlist conversion event are sent to
                Google Analytics{MEASUREMENT_ID ? ` (${MEASUREMENT_ID})` : ""}. Google does not
                expose that reporting data to this site, so open the Analytics dashboard to read it.
              </p>
              <a
                className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4"
                href="https://analytics.google.com/"
                target="_blank"
                rel="noreferrer noopener"
              >
                Open Google Analytics
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
            </Panel>

            <WeeklyDigestPanel />
          </>
        ) : null}
      </div>

      <Link to="/account" className="mt-12 inline-block text-sm underline underline-offset-4">
        Back to your account
      </Link>
    </section>
  );
}

function Panel({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-6">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
        {icon}
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/**
 * The same summary that goes out by email every Monday morning, rendered on
 * demand so it can be checked without waiting a week.
 */
function WeeklyDigestPanel() {
  const [open, setOpen] = useState(false);
  const preview = useServerFn(previewWeeklyDigest);
  const { data, isFetching, isError } = useQuery({
    queryKey: ["weekly-digest-preview"],
    queryFn: () => preview({}),
    enabled: open,
    staleTime: 15 * 60 * 1000,
  });

  return (
    <Panel icon={<Mail aria-hidden="true" className="size-4" />} title="Weekly email digest">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Every Monday at 9 am India time you get an email with the top search trends and the biggest
        changes by community, city and role. Each number compares the last seven days with the seven
        days before, so you see movement rather than a running total.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-4 min-h-11 rounded-xl"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide this week's digest" : "Preview this week's digest"}
      </Button>
      {open ? (
        <div className="mt-6" aria-live="polite">
          {isFetching ? (
            <p className="text-sm text-muted-foreground">Building the digest.</p>
          ) : null}
          {isError ? (
            <p className="text-sm text-muted-foreground">
              The digest could not be built right now.
            </p>
          ) : null}
          {data && data.ok ? (
            <iframe
              title="Weekly digest preview"
              srcDoc={data.html}
              sandbox=""
              className="h-[32rem] w-full rounded-xl border border-border/60 bg-white"
            />
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

function StatGrid({ stats }: { stats: Array<{ label: string; value: string }> }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl border border-border/60 bg-background p-4">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</dt>
          <dd className="mt-2 font-display text-2xl font-semibold">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function RankedList({
  heading,
  rows,
  empty,
}: {
  heading: string;
  empty: string;
  rows: Array<{ key: string; primary: string; secondary?: string }>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{heading}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.key} className="flex items-baseline justify-between gap-4">
              <span className="min-w-0 flex-1 truncate" title={row.key}>
                {row.key}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {row.primary}
                {row.secondary ? ` · ${row.secondary}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
