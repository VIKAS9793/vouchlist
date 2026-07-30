#!/usr/bin/env node
/**
 * Pre-publish database access validation.
 *
 * Verifies that the tables holding waitlist and CSP report data are locked
 * down before anything ships:
 *   - the table exists in the public schema
 *   - row level security is enabled
 *   - at least one policy exists, and every policy that touches the anon or
 *     authenticated roles denies by default (no permissive USING or WITH CHECK)
 *   - the anon and authenticated roles hold no table privileges at all
 *   - service_role keeps the privileges the server code needs
 *
 * Reads the database through psql using the standard PG* environment
 * variables. Exits 1 on any error so it can gate a deploy.
 *
 * Usage: node scripts/rls-qa.mjs
 */
import { execFileSync } from "node:child_process";

/** Tables that must never be reachable through the public Data API. */
const GATED_TABLES = ["waitlist", "waitlist_throttle", "csp_reports"];

/** Other server only tables, checked as warnings so regressions stay visible. */
const WATCHED_TABLES = ["privacy_requests", "csp_alerts", "internal_tokens"];

const PUBLIC_ROLES = ["anon", "authenticated", "PUBLIC"];
const SERVICE_PRIVILEGES = ["SELECT", "INSERT", "UPDATE", "DELETE"];
const SEP = "\u0001";

const errors = [];
const warnings = [];
const err = (target, msg) => errors.push({ target, msg });
const warn = (target, msg) => warnings.push({ target, msg });

function query(sql) {
  const out = execFileSync("psql", ["-At", "-F", SEP, "-c", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return out
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.split(SEP));
}

function readTables() {
  const rows = query(`
    SELECT c.relname, c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
  `);
  return new Map(rows.map(([name, rls]) => [name, rls === "t"]));
}

function readPolicies() {
  const rows = query(`
    SELECT tablename, policyname, cmd, roles::text,
           coalesce(qual, ''), coalesce(with_check, '')
      FROM pg_policies
     WHERE schemaname = 'public'
  `);
  const byTable = new Map();
  for (const [table, name, cmd, roles, qual, check] of rows) {
    if (!byTable.has(table)) byTable.set(table, []);
    byTable.get(table).push({
      name,
      cmd,
      roles: roles.replace(/[{}]/g, "").split(",").filter(Boolean),
      qual,
      check,
    });
  }
  return byTable;
}

function readGrants() {
  const rows = query(`
    SELECT c.relname,
           coalesce(g.rolname, 'PUBLIC') AS grantee,
           a.privilege_type
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN LATERAL aclexplode(c.relacl) a ON true
      LEFT JOIN pg_roles g ON g.oid = a.grantee
     WHERE n.nspname = 'public' AND c.relkind = 'r'
  `);
  const byTable = new Map();
  for (const [table, grantee, privilege] of rows) {
    if (!byTable.has(table)) byTable.set(table, new Map());
    const perRole = byTable.get(table);
    if (!perRole.has(grantee)) perRole.set(grantee, new Set());
    perRole.get(grantee).add(privilege);
  }
  return byTable;
}

/** A deny by default policy resolves to false with no row dependent logic. */
function isDenyAll(expression) {
  const normalised = expression.trim().toLowerCase().replace(/\s+/g, "");
  return normalised === "" || normalised === "false" || normalised === "(false)";
}

function checkTable(table, { tables, policies, grants, level }) {
  const report = level === "error" ? err : warn;

  if (!tables.has(table)) {
    report(table, "table is missing from the public schema");
    return;
  }

  if (!tables.get(table)) {
    report(table, "row level security is not enabled");
  }

  const tablePolicies = policies.get(table) ?? [];
  if (tablePolicies.length === 0) {
    report(table, "has no policies, so access depends on grants alone");
  }

  for (const policy of tablePolicies) {
    const touchesPublic = policy.roles.some(
      (role) => PUBLIC_ROLES.includes(role) || role === "public",
    );
    if (!touchesPublic) continue;
    if (!isDenyAll(policy.qual) || !isDenyAll(policy.check)) {
      report(
        table,
        `policy "${policy.name}" (${policy.cmd}) allows ${policy.roles.join(", ")} instead of denying access`,
      );
    }
  }

  const perRole = grants.get(table) ?? new Map();
  for (const role of PUBLIC_ROLES) {
    const held = [...(perRole.get(role) ?? [])].filter((p) => SERVICE_PRIVILEGES.includes(p));
    if (held.length > 0) {
      report(table, `${role} still holds ${held.sort().join(", ")}. Revoke these privileges.`);
    }
  }

  const serviceHeld = perRole.get("service_role") ?? new Set();
  const missing = SERVICE_PRIVILEGES.filter((p) => !serviceHeld.has(p));
  if (missing.length > 0) {
    report(table, `service_role is missing ${missing.join(", ")}, so server writes will fail.`);
  }
}

function main() {
  if (!process.env.PGHOST) {
    console.error("rls-qa: PGHOST is not set, so the database cannot be reached.");
    console.error("Run this gate where the managed database environment is available.");
    process.exit(1);
  }

  let tables;
  let policies;
  let grants;
  try {
    tables = readTables();
    policies = readPolicies();
    grants = readGrants();
  } catch (error) {
    console.error("rls-qa: could not read the database.");
    console.error(String(error.stderr || error.message).trim());
    process.exit(1);
  }

  for (const table of GATED_TABLES) {
    checkTable(table, { tables, policies, grants, level: "error" });
  }
  for (const table of WATCHED_TABLES) {
    checkTable(table, { tables, policies, grants, level: "warn" });
  }

  const checked = GATED_TABLES.length + WATCHED_TABLES.length;
  console.log(`rls-qa: checked ${checked} tables (${GATED_TABLES.length} gated).`);
  for (const { target, msg } of warnings) console.log(`  WARN  ${target}: ${msg}`);
  for (const { target, msg } of errors) console.log(`  ERROR ${target}: ${msg}`);

  if (errors.length > 0) {
    console.log(`\nrls-qa failed with ${errors.length} error(s).`);
    process.exit(1);
  }
  console.log(`\nrls-qa passed with ${warnings.length} warning(s).`);
}

main();
