/**
 * Schema governance — Drizzle is the only design SSOT.
 * Production: validate-only (fail closed on critical drift).
 * Dev/staging: optional idempotent auto-heal (never DROP/RENAME).
 */

export type SchemaColumnExpectation = {
  name: string;
  /** Simplified PG type for ADD COLUMN IF NOT EXISTS */
  sqlType: string;
  notNull: boolean;
  hasDefault: boolean;
};

export type SchemaTableExpectation = {
  name: string;
  columns: SchemaColumnExpectation[];
};

export type SchemaContract = {
  schemaVersion: string;
  generatedAt: string;
  tables: SchemaTableExpectation[];
};

export type MissingColumn = {
  table: string;
  column: string;
  expectedSqlType: string;
};

export type DriftReport = {
  expectedSchemaVersion: string;
  currentSchemaVersion: string | null;
  driftStatus: "ok" | "drift" | "unknown";
  missingTables: string[];
  missingColumns: MissingColumn[];
  missingIndexes: string[];
  missingConstraints: string[];
  pendingMigrations: string[];
  requiredSql: string[];
  autoHealEnabled: boolean;
  lastMigrationApplied: string | null;
  databaseType: string;
  environment: string;
  critical: boolean;
};

export type SchemaGovernanceOptions = {
  autoHeal: boolean;
  environment: string;
  databaseType?: string;
  /** When true, log via console; callers may pass a logger. */
  log?: (msg: string, extra?: Record<string, unknown>) => void;
};
