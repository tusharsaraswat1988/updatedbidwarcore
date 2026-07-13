export type {
  SchemaContract,
  SchemaColumnExpectation,
  SchemaTableExpectation,
  DriftReport,
  MissingColumn,
  SchemaGovernanceOptions,
} from "./types.js";
export { buildSchemaContractFromDrizzle } from "./contract.js";
export { introspectLiveSchema, readMigrationLedger } from "./introspect.js";
export { diffSchema } from "./diff.js";
export { applyIdempotentHeal } from "./heal.js";
export {
  runSchemaGovernance,
  getSchemaHealthReport,
  resolveAutoHealEnabled,
  resolveEffectiveAutoHeal,
  resolveEnvironment,
  formatDriftReportForConsole,
} from "./orchestrate.js";
export {
  resolveSchemaBootTimeoutMs,
  withTimeout,
  DEFAULT_SCHEMA_BOOT_TIMEOUT_MS,
  DEFAULT_SCHEMA_STATEMENT_TIMEOUT_MS,
  DEFAULT_SCHEMA_LOCK_TIMEOUT_MS,
} from "./timeouts.js";
export type { DbQueryable } from "./timeouts.js";
export {
  assertEnvironmentDatabaseIsolation,
  classifyDatabaseRole,
  gateAutoHealForDatabase,
  isProductionDatabaseUrl,
  isStagingDatabaseUrl,
  parseDatabaseHostname,
  DEFAULT_PRODUCTION_DB_HOST_MARKERS,
  DEFAULT_STAGING_DB_HOST_MARKERS,
} from "./database-identity.js";
export type { DatabaseRole } from "./database-identity.js";
