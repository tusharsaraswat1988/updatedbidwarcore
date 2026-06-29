export * from "./types.ts";
export * from "./manifest.ts";
export * from "./sport-registry.ts";
export * from "./sheet-definitions.ts";
export * from "./identity-resolver.ts";
export * from "./workbook-parser.ts";
export * from "./workbook-validator.ts";
export * from "./health-score.ts";
export * from "./field-diff.ts";
export * from "./mapping-profiles.ts";
export * from "./ai-suggestions.ts";

/** BidWar Master Workbook (BMW) — official data exchange standard */
export const BMW_MODULE_NAME = "bidwar_master_workbook";

/** @deprecated Use BMW_MODULE_NAME */
export const TMW_MODULE_NAME = BMW_MODULE_NAME;
