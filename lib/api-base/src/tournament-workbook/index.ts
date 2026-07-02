export * from "./types";
export * from "./manifest";
export * from "./sport-registry";
export * from "./sheet-definitions";
export * from "./identity-resolver";
export * from "./workbook-parser";
export * from "./workbook-validator";
export * from "./health-score";
export * from "./field-diff";
export * from "./mapping-profiles";
export * from "./ai-suggestions";

/** BidWar Master Workbook (BMW) — official data exchange standard */
export const BMW_MODULE_NAME = "bidwar_master_workbook";

/** @deprecated Use BMW_MODULE_NAME */
export const TMW_MODULE_NAME = BMW_MODULE_NAME;
