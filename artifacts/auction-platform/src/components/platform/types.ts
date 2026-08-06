/** Shared presentation types for platform chrome. Validation content comes from product views. */

export type PlatformValidationIssue = {
  severity: "ERROR" | "WARNING" | "INFO";
  code: string;
  message: string;
};
