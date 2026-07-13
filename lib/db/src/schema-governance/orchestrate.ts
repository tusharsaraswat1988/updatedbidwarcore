import type pg from "pg";
import { buildSchemaContractFromDrizzle } from "./contract.js";
import { diffSchema } from "./diff.js";
import { applyIdempotentHeal } from "./heal.js";
import { introspectLiveSchema, readMigrationLedger } from "./introspect.js";
import type { DriftReport, SchemaGovernanceOptions } from "./types.js";
import type { DbQueryable } from "./timeouts.js";
import {
  assertEnvironmentDatabaseIsolation,
  classifyDatabaseRole,
  gateAutoHealForDatabase,
} from "./database-identity.js";
import { resolveDatabaseUrl } from "../database-url.js";

/**
 * Staging Render services run NODE_ENV=production (same as prod).
 * Detect staging via BIDWAR_ENV / hostname — never NODE_ENV alone.
 */
function looksLikeStagingHost(): boolean {
  const combined = `${process.env.APP_DOMAIN ?? ""} ${process.env.APP_URL ?? ""}`.toLowerCase();
  return combined.includes("staging") || combined.includes("bidwar-staging");
}

/**
 * Desired auto-heal from env flags only (before production-DB hard gate).
 * Local + staging: on. Production: off.
 */
export function resolveAutoHealEnabled(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  const flag = process.env.SCHEMA_AUTO_HEAL?.trim().toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  if (flag === "false" || flag === "0" || flag === "no") return false;

  const env = resolveEnvironment().toLowerCase();
  if (env === "production") return false;
  if (
    env === "staging" ||
    env === "development" ||
    env === "dev" ||
    env === "local" ||
    env === "test"
  ) {
    return true;
  }
  // Unknown env: heal only outside NODE_ENV=production
  return process.env.NODE_ENV !== "production";
}

/**
 * Effective auto-heal after production Neon hard gate.
 * Never returns true when DATABASE_URL matches production.
 */
export function resolveEffectiveAutoHeal(
  explicit?: boolean,
  databaseUrl: string = resolveDatabaseUrl(),
): boolean {
  return gateAutoHealForDatabase(resolveAutoHealEnabled(explicit), databaseUrl);
}

export function resolveEnvironment(): string {
  const bidwarEnv = process.env.BIDWAR_ENV?.trim();
  if (bidwarEnv) return bidwarEnv;

  if (looksLikeStagingHost()) return "staging";

  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.NODE_ENV === "test") return "test";
  return "development";
}

function defaultLog(msg: string, extra?: Record<string, unknown>): void {
  if (extra) console.info(msg, extra);
  else console.info(msg);
}

export function formatDriftReportForConsole(report: DriftReport): string {
  const lines: string[] = [
    "======== SCHEMA DRIFT REPORT ========",
    `environment: ${report.environment}`,
    `autoHealEnabled: ${report.autoHealEnabled}`,
    `expectedSchemaVersion: ${report.expectedSchemaVersion}`,
    `currentSchemaVersion: ${report.currentSchemaVersion ?? "(none)"}`,
    `lastMigrationApplied: ${report.lastMigrationApplied ?? "(none)"}`,
    `driftStatus: ${report.driftStatus}`,
    `critical: ${report.critical}`,
    `missingTables (${report.missingTables.length}): ${report.missingTables.join(", ") || "(none)"}`,
    `missingColumns (${report.missingColumns.length}):`,
  ];
  for (const c of report.missingColumns) {
    lines.push(`  - ${c.table}.${c.column} (${c.expectedSqlType})`);
  }
  lines.push("requiredSql (apply via versioned migrations, then redeploy):");
  for (const sql of report.requiredSql) lines.push(`  ${sql}`);
  lines.push("=====================================");
  return lines.join("\n");
}

/**
 * Validate live DB against Drizzle SSOT. Optionally heal (dev/staging only).
 * Throws if critical drift remains after the allowed action.
 * Always prints the migration/drift report before refusing to start.
 */
export async function runSchemaGovernance(
  db: DbQueryable,
  options: Partial<SchemaGovernanceOptions> = {},
): Promise<DriftReport> {
  const log = options.log ?? defaultLog;
  const environment = options.environment ?? resolveEnvironment();
  const databaseUrl = options.databaseUrl ?? resolveDatabaseUrl();
  assertEnvironmentDatabaseIsolation(environment, databaseUrl);
  const autoHeal = resolveEffectiveAutoHeal(options.autoHeal, databaseUrl);
  const databaseType = options.databaseType ?? "postgresql";

  const contract = buildSchemaContractFromDrizzle();
  const live = await introspectLiveSchema(db);
  const ledger = await readMigrationLedger(db);

  let report = diffSchema(contract, live, {
    autoHealEnabled: autoHeal,
    environment,
    databaseType,
    lastMigrationApplied: ledger.lastMigrationApplied,
  });

  if (!report.critical) {
    log("[schema-governance] schema OK", {
      expectedSchemaVersion: report.expectedSchemaVersion,
      environment,
      autoHealEnabled: autoHeal,
      databaseRole: classifyDatabaseRole(databaseUrl),
    });
    return report;
  }

  console.error(formatDriftReportForConsole(report));

  if (!autoHeal) {
    throw new Error(
      `Schema drift detected in ${environment}. Refusing to start HTTP server. ` +
        `Apply the requiredSql from the SCHEMA DRIFT REPORT above via versioned migrations (lib/db/migrations), then redeploy.`,
    );
  }

  // Final hard stop before any mutation — production Neon must never be healed.
  if (!gateAutoHealForDatabase(true, databaseUrl)) {
    throw new Error(
      `Schema auto-heal blocked: DATABASE_URL matches production Neon. Refusing to mutate. Apply versioned migrations instead.`,
    );
  }

  log("[schema-governance] auto-heal enabled — applying idempotent additive SQL");
  const { applied, failed } = await applyIdempotentHeal(db, report, log);
  log("[schema-governance] heal summary", { applied: applied.length, failed: failed.length });

  if (failed.length) {
    console.error(formatDriftReportForConsole(report));
    throw new Error(
      `Schema auto-heal incomplete (${failed.length} failures). See SCHEMA DRIFT REPORT and heal logs. Refusing to start HTTP server.`,
    );
  }

  const liveAfter = await introspectLiveSchema(db);
  report = diffSchema(contract, liveAfter, {
    autoHealEnabled: autoHeal,
    environment,
    databaseType,
    lastMigrationApplied: ledger.lastMigrationApplied,
  });

  if (report.critical) {
    console.error(formatDriftReportForConsole(report));
    throw new Error(
      "Schema drift remains after auto-heal (likely missing tables — apply versioned migrations). Refusing to start HTTP server.",
    );
  }

  log("[schema-governance] schema OK after heal", {
    expectedSchemaVersion: report.expectedSchemaVersion,
  });
  return report;
}

/** Build a health payload without mutating. */
export async function getSchemaHealthReport(
  db: DbQueryable,
  options: Partial<SchemaGovernanceOptions> = {},
): Promise<DriftReport> {
  const environment = options.environment ?? resolveEnvironment();
  const databaseUrl = options.databaseUrl ?? resolveDatabaseUrl();
  const autoHeal = resolveEffectiveAutoHeal(options.autoHeal, databaseUrl);
  const databaseType = options.databaseType ?? "postgresql";
  const contract = buildSchemaContractFromDrizzle();
  const live = await introspectLiveSchema(db);
  const ledger = await readMigrationLedger(db);
  return diffSchema(contract, live, {
    autoHealEnabled: autoHeal,
    environment,
    databaseType,
    lastMigrationApplied: ledger.lastMigrationApplied,
  });
}
