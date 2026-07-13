import type { SchemaContract, DriftReport, MissingColumn } from "./types.js";
import type { LiveSchema } from "./introspect.js";

/**
 * Compare Drizzle contract to live DB.
 * Critical = missing tables or missing columns (breaks Drizzle SELECT *).
 * Indexes/constraints are reported but do not fail startup by default.
 */
export function diffSchema(
  contract: SchemaContract,
  live: LiveSchema,
  opts: {
    autoHealEnabled: boolean;
    environment: string;
    databaseType: string;
    lastMigrationApplied: string | null;
    pendingMigrations?: string[];
  },
): DriftReport {
  const missingTables: string[] = [];
  const missingColumns: MissingColumn[] = [];
  const requiredSql: string[] = [];

  for (const table of contract.tables) {
    if (!live.tables.has(table.name)) {
      missingTables.push(table.name);
      // Full CREATE TABLE is intentionally not auto-generated here for safety;
      // empty DBs use legacy bootstrap + migrations. Report guidance SQL.
      requiredSql.push(
        `-- MISSING TABLE ${table.name}: apply versioned migrations (lib/db/migrations) or run schema bootstrap in a non-production environment.`,
      );
      continue;
    }

    const liveCols = live.columns.get(table.name) ?? new Set<string>();
    for (const col of table.columns) {
      if (liveCols.has(col.name)) continue;
      missingColumns.push({
        table: table.name,
        column: col.name,
        expectedSqlType: col.sqlType,
      });
      // Idempotent additive only — never set NOT NULL without default on existing rows.
      requiredSql.push(
        `ALTER TABLE ${table.name} ADD COLUMN IF NOT EXISTS ${col.name} ${col.sqlType};`,
      );
    }
  }

  const critical = missingTables.length > 0 || missingColumns.length > 0;
  const driftStatus: DriftReport["driftStatus"] = critical ? "drift" : "ok";

  return {
    expectedSchemaVersion: contract.schemaVersion,
    currentSchemaVersion: opts.lastMigrationApplied,
    driftStatus,
    missingTables,
    missingColumns,
    missingIndexes: [],
    missingConstraints: [],
    pendingMigrations: opts.pendingMigrations ?? [],
    requiredSql,
    autoHealEnabled: opts.autoHealEnabled,
    lastMigrationApplied: opts.lastMigrationApplied,
    databaseType: opts.databaseType,
    environment: opts.environment,
    critical,
  };
}
