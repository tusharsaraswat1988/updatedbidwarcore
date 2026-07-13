import type pg from "pg";
import { buildSchemaContractFromDrizzle } from "./contract.js";
import { diffSchema } from "./diff.js";
import { applyIdempotentHeal } from "./heal.js";
import { introspectLiveSchema, readMigrationLedger } from "./introspect.js";
import type { DriftReport, SchemaGovernanceOptions } from "./types.js";

/**
 * Staging Render services run NODE_ENV=production (same as prod).
 * Without this heuristic, validate-only mode skips boot DDL and refuses to
 * start on additive drift (e.g. tournaments.city) — process never binds PORT.
 */
function looksLikeStagingHost(): boolean {
  const combined = `${process.env.APP_DOMAIN ?? ""} ${process.env.APP_URL ?? ""}`.toLowerCase();
  return combined.includes("staging") || combined.includes("bidwar-staging");
}

export function resolveAutoHealEnabled(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  const flag = process.env.SCHEMA_AUTO_HEAL?.trim().toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  if (flag === "false" || flag === "0" || flag === "no") return false;

  const env = resolveEnvironment().toLowerCase();
  // Heal on staging/local/dev/test even when NODE_ENV=production (Render staging).
  if (
    env === "staging" ||
    env === "development" ||
    env === "dev" ||
    env === "local" ||
    env === "test"
  ) {
    return true;
  }
  // True production (or unknown + NODE_ENV=production): validate-only
  return process.env.NODE_ENV !== "production";
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
  lines.push("requiredSql:");
  for (const sql of report.requiredSql) lines.push(`  ${sql}`);
  lines.push("=====================================");
  return lines.join("\n");
}

/**
 * Validate live DB against Drizzle SSOT. Optionally heal (non-prod).
 * Throws if critical drift remains after the allowed action.
 */
export async function runSchemaGovernance(
  pool: pg.Pool,
  options: Partial<SchemaGovernanceOptions> = {},
): Promise<DriftReport> {
  const log = options.log ?? defaultLog;
  const autoHeal = resolveAutoHealEnabled(options.autoHeal);
  const environment = options.environment ?? resolveEnvironment();
  const databaseType = options.databaseType ?? "postgresql";

  const contract = buildSchemaContractFromDrizzle();
  const live = await introspectLiveSchema(pool);
  const ledger = await readMigrationLedger(pool);

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
    });
    return report;
  }

  console.error(formatDriftReportForConsole(report));

  if (!autoHeal) {
    throw new Error(
      `Schema drift detected in ${environment}. Refusing to start. Apply the requiredSql above via versioned migrations, then redeploy.`,
    );
  }

  log("[schema-governance] auto-heal enabled — applying idempotent additive SQL");
  const { applied, failed } = await applyIdempotentHeal(pool, report, log);
  log("[schema-governance] heal summary", { applied: applied.length, failed: failed.length });

  if (failed.length) {
    throw new Error(
      `Schema auto-heal incomplete (${failed.length} failures). See logs. Refusing to start.`,
    );
  }

  const liveAfter = await introspectLiveSchema(pool);
  report = diffSchema(contract, liveAfter, {
    autoHealEnabled: autoHeal,
    environment,
    databaseType,
    lastMigrationApplied: ledger.lastMigrationApplied,
  });

  if (report.critical) {
    console.error(formatDriftReportForConsole(report));
    throw new Error(
      "Schema drift remains after auto-heal (likely missing tables — apply versioned migrations). Refusing to start.",
    );
  }

  log("[schema-governance] schema OK after heal", {
    expectedSchemaVersion: report.expectedSchemaVersion,
  });
  return report;
}

/** Build a health payload without mutating. */
export async function getSchemaHealthReport(
  pool: pg.Pool,
  options: Partial<SchemaGovernanceOptions> = {},
): Promise<DriftReport> {
  const autoHeal = resolveAutoHealEnabled(options.autoHeal);
  const environment = options.environment ?? resolveEnvironment();
  const databaseType = options.databaseType ?? "postgresql";
  const contract = buildSchemaContractFromDrizzle();
  const live = await introspectLiveSchema(pool);
  const ledger = await readMigrationLedger(pool);
  return diffSchema(contract, live, {
    autoHealEnabled: autoHeal,
    environment,
    databaseType,
    lastMigrationApplied: ledger.lastMigrationApplied,
  });
}
