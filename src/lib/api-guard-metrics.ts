/**
 * Observability for the shared `/api/public/*` guard.
 *
 * Two outputs from one call site, so a refusal can never be counted without
 * being logged or the other way round:
 *
 * - a structured JSON line per decision, for the worker log
 * - in-process counters per endpoint, for the metrics endpoint
 *
 * Callers are identified by a short non-reversible digest of their address, so
 * a log line is enough to spot one source hammering an endpoint without
 * putting a raw IP in the log.
 */

export type GuardOutcome =
  "allowed" | "rate_limited" | "missing" | "malformed" | "invalid" | "replayed";

/** Every outcome, in report order, so a zero still appears in the output. */
export const GUARD_OUTCOMES: GuardOutcome[] = [
  "allowed",
  "rate_limited",
  "missing",
  "malformed",
  "invalid",
  "replayed",
];

export type EndpointMetrics = {
  endpoint: string;
  total: number;
  counts: Record<GuardOutcome, number>;
  /** Distinct caller digests seen since the isolate started, capped. */
  callers: number;
  firstSeen: string;
  lastSeen: string;
  lastRefusalAt: string | null;
};

type Bucket = {
  counts: Record<GuardOutcome, number>;
  callers: Set<string>;
  firstSeen: number;
  lastSeen: number;
  lastRefusalAt: number | null;
};

/** Bounded like the guard's own maps: an isolate must not grow without limit. */
const MAX_ENDPOINTS = 200;
const MAX_CALLERS_PER_ENDPOINT = 1_000;

const endpoints = new Map<string, Bucket>();
let startedAt = Date.now();

function emptyCounts(): Record<GuardOutcome, number> {
  return {
    allowed: 0,
    rate_limited: 0,
    missing: 0,
    malformed: 0,
    invalid: 0,
    replayed: 0,
  };
}

/**
 * Stable short digest of a caller key. FNV-1a is not a security primitive and
 * is not used as one: it only has to group a caller's requests together in the
 * log without writing the address itself.
 */
export function callerDigest(key: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export type GuardEvent = {
  endpoint: string;
  outcome: GuardOutcome;
  method: string;
  /** Digest of the caller key, never the address itself. */
  caller: string;
  /** Whether the endpoint requires a credential at all. */
  gated: boolean;
  /** Where the credential came from, when one was presented. */
  credential?: "header" | "query";
  /** Milliseconds spent inside the guard, including the token comparison. */
  durationMs?: number;
};

/**
 * One line per decision. Refusals are `console.warn` so they stand out in the
 * worker log; allowed requests stay at debug level and can be filtered out.
 */
export function recordGuardEvent(event: GuardEvent, now = Date.now()): void {
  const bucket = endpoints.get(event.endpoint) ?? {
    counts: emptyCounts(),
    callers: new Set<string>(),
    firstSeen: now,
    lastSeen: now,
    lastRefusalAt: null,
  };

  bucket.counts[event.outcome] += 1;
  bucket.lastSeen = now;
  if (event.outcome !== "allowed") bucket.lastRefusalAt = now;
  if (bucket.callers.size < MAX_CALLERS_PER_ENDPOINT) bucket.callers.add(event.caller);

  endpoints.delete(event.endpoint);
  endpoints.set(event.endpoint, bucket);
  // Map keeps insertion order, so the least recently active endpoint is first.
  while (endpoints.size > MAX_ENDPOINTS) {
    const oldest = endpoints.keys().next();
    if (oldest.done) break;
    endpoints.delete(oldest.value);
  }

  const line = JSON.stringify({
    at: new Date(now).toISOString(),
    log: "api-guard",
    ...event,
  });
  if (event.outcome === "allowed") console.debug(line);
  else console.warn(line);
}

/** Snapshot for the metrics endpoint; ordered by traffic, busiest first. */
export function guardMetrics(now = Date.now()): {
  since: string;
  uptimeMs: number;
  totals: Record<GuardOutcome, number> & { total: number };
  endpoints: EndpointMetrics[];
} {
  const totals = { ...emptyCounts(), total: 0 };
  const rows: EndpointMetrics[] = [];

  for (const [endpoint, bucket] of endpoints) {
    let total = 0;
    for (const outcome of GUARD_OUTCOMES) {
      total += bucket.counts[outcome];
      totals[outcome] += bucket.counts[outcome];
    }
    totals.total += total;
    rows.push({
      endpoint,
      total,
      counts: { ...bucket.counts },
      callers: bucket.callers.size,
      firstSeen: new Date(bucket.firstSeen).toISOString(),
      lastSeen: new Date(bucket.lastSeen).toISOString(),
      lastRefusalAt: bucket.lastRefusalAt ? new Date(bucket.lastRefusalAt).toISOString() : null,
    });
  }

  rows.sort((a, b) => b.total - a.total || a.endpoint.localeCompare(b.endpoint));
  return {
    since: new Date(startedAt).toISOString(),
    uptimeMs: now - startedAt,
    totals,
    endpoints: rows,
  };
}

/**
 * Prometheus text exposition, so the counters can be scraped without teaching
 * the collector our JSON shape.
 */
export function guardMetricsPrometheus(now = Date.now()): string {
  const snapshot = guardMetrics(now);
  const lines: string[] = [
    "# HELP api_guard_requests_total Decisions made by the shared /api/public guard.",
    "# TYPE api_guard_requests_total counter",
  ];
  for (const row of snapshot.endpoints) {
    for (const outcome of GUARD_OUTCOMES) {
      lines.push(
        `api_guard_requests_total{endpoint="${row.endpoint}",outcome="${outcome}"} ${row.counts[outcome]}`,
      );
    }
  }
  lines.push(
    "# HELP api_guard_callers Distinct caller digests seen per endpoint since process start.",
    "# TYPE api_guard_callers gauge",
  );
  for (const row of snapshot.endpoints) {
    lines.push(`api_guard_callers{endpoint="${row.endpoint}"} ${row.callers}`);
  }
  return `${lines.join("\n")}\n`;
}

/** Test helper; the counters are process local and never reset in production. */
export function resetGuardMetrics(now = Date.now()): void {
  endpoints.clear();
  startedAt = now;
}
