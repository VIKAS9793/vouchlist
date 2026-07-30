/**
 * Single source of truth for the published security workflow.
 *
 * The /security page, the /.well-known/security.txt response and any future
 * internal runbook read from here, so the promises we publish cannot drift
 * from the process we describe.
 */
export type ResponseTarget = {
  severity: string;
  example: string;
  acknowledge: string;
  assess: string;
  remediate: string;
};

export const responseTargets: ResponseTarget[] = [
  {
    severity: "Critical",
    example: "Community data readable or writable by someone outside the group",
    acknowledge: "Within 1 business day",
    assess: "Within 2 business days",
    remediate: "Mitigation within 3 business days, fix within 7",
  },
  {
    severity: "High",
    example:
      "Authentication or authorisation bypass, or a way to alter another community's entries",
    acknowledge: "Within 2 business days",
    assess: "Within 4 business days",
    remediate: "Fix within 14 business days",
  },
  {
    severity: "Medium",
    example:
      "Missing rate limit, injection with limited impact, or a fixable data exposure in logs",
    acknowledge: "Within 3 business days",
    assess: "Within 7 business days",
    remediate: "Fix within 30 business days",
  },
  {
    severity: "Low",
    example: "Hardening gaps, verbose errors, or configuration issues with no direct data impact",
    acknowledge: "Within 5 business days",
    assess: "Within 10 business days",
    remediate: "Scheduled into a normal release",
  },
];

export type IncidentStage = { name: string; timing: string; detail: string };

export const incidentStages: IncidentStage[] = [
  {
    name: "Acknowledge",
    timing: "1 to 5 business days, by severity",
    detail:
      "You get a reply from a person confirming we have the report, with a reference you can quote in later emails.",
  },
  {
    name: "Triage",
    timing: "Same day as the acknowledgement",
    detail:
      "We reproduce the issue, decide the severity from the table above and tell you which level we assigned and why.",
  },
  {
    name: "Contain",
    timing: "Immediately for critical and high issues",
    detail:
      "If community data is at risk we cut the exposure first, for example by disabling the affected path or tightening database access, before we work on the permanent fix.",
  },
  {
    name: "Remediate",
    timing: "Per the target table",
    detail:
      "We ship the fix through the normal quality gates, which include automated security header, dependency, secret and access control checks, so the patch cannot regress the rest of the site.",
  },
  {
    name: "Notify",
    timing: "Within 72 hours of confirming an impact",
    detail:
      "If any community data was accessed or exposed, we tell the affected group admins what happened, what was involved and what we changed. If no data was affected, we say that too.",
  },
  {
    name: "Review",
    timing: "Within 10 business days of the fix",
    detail:
      "We write a short internal review covering the root cause and the check we added to catch that class of issue earlier, then share the summary with the reporter.",
  },
];

export const reportChecklist: string[] = [
  "The URL, page or endpoint affected, and the date and time you tested.",
  "Clear steps to reproduce, ideally numbered, with any request or payload you used.",
  "What an attacker could do with the issue, in your own words.",
  "Screenshots, a short recording or log excerpts, with any personal data blanked out.",
  "How you would like to be credited if we publish a fix note.",
];

export const inScope: string[] = [
  "This website and every public route on it.",
  "The waitlist form and the server functions behind it.",
  "The database access rules that protect waitlist and community data.",
  "Security headers, content security policy and session handling.",
  "The VouchList WhatsApp assistant and the recommendation entries it stores.",
];

export const outOfScope: string[] = [
  "Denial of service, load testing and traffic flooding.",
  "Reports produced only by an automated scanner with no demonstrated impact.",
  "Missing best practice headers with no exploitable consequence.",
  "Social engineering, phishing or physical attacks against people.",
  "Vulnerabilities in WhatsApp itself, which belong to Meta's disclosure programme.",
];
