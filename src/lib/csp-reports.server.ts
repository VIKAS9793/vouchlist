/**
 * Sink for CSP violation reports.
 *
 * Every report is written three ways: a structured console line (visible in
 * the server logs), a small in-memory ring buffer (cheap reads inside the same
 * worker isolate) and a durable row in `csp_reports` so the dashboard can show
 * violations that happened on a different isolate or before the last deploy.
 * Reports describe the page and the blocked resource only. Nothing
 * user-identifying is stored: no IP address, no cookies, no session.
 */
export type CspViolation = {
  at: string;
  documentUri: string;
  violatedDirective: string;
  effectiveDirective: string;
  blockedUri: string;
  sourceFile: string;
  lineNumber: number | null;
  disposition: string;
};

/** One row of the dashboard: a distinct violation plus how often it fired. */
export type CspViolationGroup = {
  fingerprint: string;
  effectiveDirective: string;
  blockedUri: string;
  documentUri: string;
  sourceFile: string;
  lineNumber: number | null;
  disposition: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
};

const MAX_REPORTS = 200;
const reports: CspViolation[] = [];

// Flood protection now lives in the shared guard (`src/lib/api-guard.ts`).

function str(value: unknown, max = 512): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/** Normalises both the CSP2 (`csp-report`) and Reporting API payload shapes. */
export function normalizeReport(payload: unknown): CspViolation | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload as Record<string, unknown>;
  const legacy = (raw["csp-report"] ?? null) as Record<string, unknown> | null;
  const modern =
    (raw.type === "csp-violation" ? (raw.body as Record<string, unknown>) : null) ?? null;
  const body = legacy ?? modern ?? raw;

  const effective = str(body["effective-directive"] ?? body.effectiveDirective);
  const violated = str(body["violated-directive"] ?? body.violatedDirective) || effective;
  if (!violated && !effective) return null;

  const line = body["line-number"] ?? body.lineNumber;
  return {
    at: new Date().toISOString(),
    documentUri: str(body["document-uri"] ?? body.documentURL),
    violatedDirective: violated,
    effectiveDirective: effective || violated,
    blockedUri: str(body["blocked-uri"] ?? body.blockedURL),
    sourceFile: str(body["source-file"] ?? body.sourceFile),
    lineNumber: typeof line === "number" ? line : null,
    disposition: str(body.disposition) || "report",
  };
}

export function recordReport(violation: CspViolation): void {
  reports.push(violation);
  if (reports.length > MAX_REPORTS) reports.splice(0, reports.length - MAX_REPORTS);
  console.warn(
    `[csp] ${violation.disposition} ${violation.effectiveDirective} blocked ${violation.blockedUri || "(inline)"} on ${violation.documentUri}`,
  );
}

export function recentReports(): CspViolation[] {
  return [...reports];
}

/**
 * Stable identity for "the same violation happening again", so a single
 * misbehaving script shows up as one dashboard row with a count rather than
 * thousands of rows. Deliberately excludes the timestamp.
 */
export function fingerprint(violation: CspViolation): string {
  return [
    violation.disposition,
    violation.effectiveDirective,
    violation.blockedUri,
    stripQuery(violation.documentUri),
    violation.sourceFile,
    violation.lineNumber ?? "",
  ].join("|");
}

function stripQuery(uri: string): string {
  const cut = uri.indexOf("?");
  return cut === -1 ? uri : uri.slice(0, cut);
}

/**
 * Writes the report to the durable store. Never throws: a reporting endpoint
 * that 500s because the database blinked would hide the very violations it
 * exists to surface.
 */
export async function persistReport(violation: CspViolation, userAgent: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("csp_reports").insert({
      document_uri: violation.documentUri,
      violated_directive: violation.violatedDirective,
      effective_directive: violation.effectiveDirective,
      blocked_uri: violation.blockedUri,
      source_file: violation.sourceFile,
      line_number: violation.lineNumber,
      disposition: violation.disposition,
      user_agent: userAgent.slice(0, 256),
      fingerprint: fingerprint(violation),
    });
    if (error) console.error(`[csp] could not store report: ${error.message}`);
  } catch (cause) {
    console.error(`[csp] could not store report: ${(cause as Error)?.message ?? cause}`);
  }
}

/** Grouped view over the durable store, newest activity first. */
export async function reportSummary(sinceHours = 24 * 7): Promise<{
  since: string;
  total: number;
  groups: CspViolationGroup[];
}> {
  const since = new Date(Date.now() - sinceHours * 3_600_000).toISOString();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("csp_reports")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);

  const byPrint = new Map<string, CspViolationGroup>();
  for (const row of data ?? []) {
    const key = row.fingerprint || `${row.effective_directive}|${row.blocked_uri}`;
    const existing = byPrint.get(key);
    if (existing) {
      existing.count += 1;
      if (row.created_at < existing.firstSeen) existing.firstSeen = row.created_at;
      if (row.created_at > existing.lastSeen) existing.lastSeen = row.created_at;
      continue;
    }
    byPrint.set(key, {
      fingerprint: key,
      effectiveDirective: row.effective_directive,
      blockedUri: row.blocked_uri,
      documentUri: row.document_uri,
      sourceFile: row.source_file,
      lineNumber: row.line_number,
      disposition: row.disposition,
      count: 1,
      firstSeen: row.created_at,
      lastSeen: row.created_at,
    });
  }

  const groups = [...byPrint.values()].sort(
    (a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen),
  );
  return { since, total: data?.length ?? 0, groups };
}
