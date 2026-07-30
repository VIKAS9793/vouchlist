/**
 * Spike detection for CSP violations.
 *
 * The dashboard answers "what is happening"; this answers "is something
 * happening *now* that was not happening before". A violation only alerts when
 * it is both busy in the recent window and clearly busier than its own quiet
 * baseline, so a steadily noisy third-party script does not page anyone every
 * fifteen minutes, while a brand new one does.
 *
 * Every alert is written to `csp_alerts` first and only then delivered, so a
 * failing webhook loses the notification, never the evidence.
 */
export type CspAlert = {
  fingerprint: string;
  effectiveDirective: string;
  blockedUri: string;
  documentUri: string;
  windowCount: number;
  baselineCount: number;
  severity: "warning" | "critical";
  reason: string;
};

export type AlertRun = {
  checkedAt: string;
  windowMinutes: number;
  baselineHours: number;
  windowTotal: number;
  alerts: CspAlert[];
  delivered: number;
  channel: "webhook" | "log";
};

/** Recent activity window; matches the recommended cron cadence. */
const WINDOW_MINUTES = 15;
/** Quiet period the window is judged against. */
const BASELINE_HOURS = 24;
/** Below this a "spike" is just noise from a single visitor. */
const MIN_WINDOW_COUNT = 10;
/** How many times the per-window baseline rate a burst must exceed. */
const SPIKE_MULTIPLIER = 4;
/** A burst this large is worth waking someone for regardless of history. */
const CRITICAL_WINDOW_COUNT = 100;
/** Do not repeat the same alert more often than this. */
const COOLDOWN_MINUTES = 60;

type Row = {
  fingerprint: string;
  effective_directive: string;
  blocked_uri: string;
  document_uri: string;
  created_at: string;
};

function keyOf(row: Row): string {
  return row.fingerprint || `${row.effective_directive}|${row.blocked_uri}`;
}

export async function evaluateSpikes(now = new Date()): Promise<AlertRun> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60_000);
  const baselineStart = new Date(now.getTime() - BASELINE_HOURS * 3_600_000);

  const { data, error } = await supabaseAdmin
    .from("csp_reports")
    .select("fingerprint, effective_directive, blocked_uri, document_uri, created_at")
    .gte("created_at", baselineStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(20_000);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Row[];
  const windowCounts = new Map<string, { count: number; row: Row }>();
  const baselineCounts = new Map<string, number>();

  for (const row of rows) {
    const key = keyOf(row);
    if (row.created_at >= windowStart.toISOString()) {
      const entry = windowCounts.get(key);
      if (entry) entry.count += 1;
      else windowCounts.set(key, { count: 1, row });
    } else {
      baselineCounts.set(key, (baselineCounts.get(key) ?? 0) + 1);
    }
  }

  // Baseline is expressed as an expected count per window so the two numbers
  // are directly comparable.
  const windowsInBaseline = (BASELINE_HOURS * 60 - WINDOW_MINUTES) / WINDOW_MINUTES;

  const alerts: CspAlert[] = [];
  for (const [key, { count, row }] of windowCounts) {
    if (count < MIN_WINDOW_COUNT) continue;
    const baselineTotal = baselineCounts.get(key) ?? 0;
    const expected = baselineTotal / windowsInBaseline;
    const isNew = baselineTotal === 0;
    const isSpike = count >= Math.max(MIN_WINDOW_COUNT, expected * SPIKE_MULTIPLIER);
    if (!isNew && !isSpike) continue;

    alerts.push({
      fingerprint: key,
      effectiveDirective: row.effective_directive,
      blockedUri: row.blocked_uri,
      documentUri: row.document_uri,
      windowCount: count,
      baselineCount: baselineTotal,
      severity: count >= CRITICAL_WINDOW_COUNT ? "critical" : "warning",
      reason: isNew
        ? `new violation, unseen in the previous ${BASELINE_HOURS}h`
        : `${count} in ${WINDOW_MINUTES}m against ~${expected.toFixed(1)} expected`,
    });
  }

  alerts.sort((a, b) => b.windowCount - a.windowCount);

  const fresh = await withoutCooldown(alerts, now);
  const channel: "webhook" | "log" = process.env.CSP_ALERT_WEBHOOK_URL ? "webhook" : "log";
  let delivered = 0;
  for (const alert of fresh) {
    const sent = await deliver(alert);
    if (sent) delivered += 1;
    await record(alert, sent, channel);
  }

  return {
    checkedAt: now.toISOString(),
    windowMinutes: WINDOW_MINUTES,
    baselineHours: BASELINE_HOURS,
    windowTotal: [...windowCounts.values()].reduce((sum, e) => sum + e.count, 0),
    alerts: fresh,
    delivered,
    channel,
  };
}

/** Drops alerts already raised for the same violation inside the cooldown. */
async function withoutCooldown(alerts: CspAlert[], now: Date): Promise<CspAlert[]> {
  if (alerts.length === 0) return alerts;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(now.getTime() - COOLDOWN_MINUTES * 60_000).toISOString();
  const { data } = await supabaseAdmin
    .from("csp_alerts")
    .select("fingerprint")
    .gte("created_at", since);
  const recent = new Set((data ?? []).map((r) => r.fingerprint));
  return alerts.filter((a) => !recent.has(a.fingerprint));
}

async function record(alert: CspAlert, notified: boolean, channel: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("csp_alerts").insert({
      fingerprint: alert.fingerprint,
      effective_directive: alert.effectiveDirective,
      blocked_uri: alert.blockedUri,
      document_uri: alert.documentUri,
      window_count: alert.windowCount,
      baseline_count: alert.baselineCount,
      severity: alert.severity,
      notified,
      channel,
    });
    if (error) console.error(`[csp-alert] could not store alert: ${error.message}`);
  } catch (cause) {
    console.error(`[csp-alert] could not store alert: ${(cause as Error)?.message ?? cause}`);
  }
}

function summarise(alert: CspAlert): string {
  return `[csp-alert] ${alert.severity.toUpperCase()} ${alert.effectiveDirective} blocked ${
    alert.blockedUri || "(inline)"
  } on ${alert.documentUri || "(unknown page)"} - ${alert.reason}`;
}

/**
 * Always logs; additionally posts to a webhook when one is configured. Slack
 * and Teams both accept a plain `{ text }` body, as do most generic sinks.
 */
async function deliver(alert: CspAlert): Promise<boolean> {
  const line = summarise(alert);
  if (alert.severity === "critical") console.error(line);
  else console.warn(line);

  const url = process.env.CSP_ALERT_WEBHOOK_URL;
  if (!url) return false;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: line,
        severity: alert.severity,
        fingerprint: alert.fingerprint,
        windowCount: alert.windowCount,
        baselineCount: alert.baselineCount,
      }),
    });
    if (!response.ok) {
      console.error(
        `[csp-alert] webhook rejected the alert [${response.status}]: ${await response.text()}`,
      );
      return false;
    }
    return true;
  } catch (cause) {
    console.error(`[csp-alert] webhook unreachable: ${(cause as Error)?.message ?? cause}`);
    return false;
  }
}

/** Recent alert history, newest first, for the dashboard. */
export async function recentAlerts(limit = 50) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("csp_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
