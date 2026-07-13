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
  resolveEnvironment,
  formatDriftReportForConsole,
} from "./orchestrate.js";
