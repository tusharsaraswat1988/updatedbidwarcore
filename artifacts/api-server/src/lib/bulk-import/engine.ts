/**
 * Generic bulk import engine — reusable across auction data, teams, sponsors, etc.
 */

import type { ParsedImportRow, ImportRowIssue } from "@workspace/api-base/auction-data";

export type BulkImportModuleType = "bidwar_master_workbook" | "tournament_workbook" | "auction_data" | "teams" | "sponsors" | "categories";

export interface BulkImportPreview {
  valid: boolean;
  rows: ParsedImportRow[];
  issues: ImportRowIssue[];
  summary: {
    playersFound: number;
    rowsToUpdate: number;
    rowsSkipped: number;
    errors: number;
    warnings: number;
    changedFields: string[];
  };
}

export interface FieldChangeRecord {
  playerId: number;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  entityType: string;
  entityId: string;
}

export interface CommitResult {
  updatedRows: number;
  failedRows: number;
  changes: FieldChangeRecord[];
}

export interface BulkImportCommitAdapter {
  moduleType: BulkImportModuleType;
  loadCurrentValues(rows: ParsedImportRow[]): Promise<Map<string, string | null>>;
  applyChanges(
    rows: ParsedImportRow[],
    currentValues: Map<string, string | null>,
  ): Promise<CommitResult>;
}

/** Composite key: entityType:entityId:fieldName */
export function changeKey(entityType: string, entityId: string, fieldName: string): string {
  return `${entityType}:${entityId}:${fieldName}`;
}

export function serializeValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}
