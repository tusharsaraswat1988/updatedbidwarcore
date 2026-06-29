import type { ParsedWorkbook, WorkbookSheetData, WorkbookSourceType } from "./types.ts";
import {
  BMW_SHEETS,
  INSTRUCTIONS_SHEET,
  isHiddenSheet,
} from "./sheet-definitions.ts";
import {
  BMW_VERSION,
  BMW_MANIFEST_SHEET,
  parseManifestFromRows,
  validateManifestOrLegacy,
  type BmwManifest,
} from "./manifest.ts";

const KNOWN_SHEETS = new Set(BMW_SHEETS.map((s) => s.name));

export function parseSheetRows(
  headers: string[],
  rowValues: unknown[][],
): WorkbookSheetData {
  const rows: WorkbookSheetData = [];
  for (const values of rowValues) {
    const record: Record<string, unknown> = {};
    let hasData = false;
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]?.trim();
      if (!header) continue;
      const val = values[i];
      if (val != null && val !== "") hasData = true;
      record[header] = val instanceof Object && val !== null && "result" in (val as object)
        ? (val as { result: unknown }).result
        : val;
    }
    if (hasData) rows.push(record);
  }
  return rows;
}

export type RawWorkbookInput = {
  sheets: Array<{ name: string; headers: string[]; rows: unknown[][] }>;
  sourceType: WorkbookSourceType;
  sourceLabel?: string;
  localMedia?: Record<string, string>;
};

export function parseManifestFromRawSheets(
  sheets: RawWorkbookInput["sheets"],
): BmwManifest | null {
  const manifestSheet = sheets.find((s) => s.name === BMW_MANIFEST_SHEET);
  if (!manifestSheet) return null;
  const rows = parseSheetRows(manifestSheet.headers, manifestSheet.rows);
  return parseManifestFromRows(rows);
}

export function parseWorkbookFromRaw(input: RawWorkbookInput): ParsedWorkbook {
  const manifest = parseManifestFromRawSheets(input.sheets);
  const manifestValidation = validateManifestOrLegacy(manifest, input.sheets.some((s) => KNOWN_SHEETS.has(s.name)));

  if (!manifestValidation.valid) {
    throw new WorkbookParseError(manifestValidation.errors.join("; "), manifestValidation.errors);
  }

  const sheets: Record<string, WorkbookSheetData> = {};

  for (const sheet of input.sheets) {
    if (isHiddenSheet(sheet.name)) continue;
    if (!KNOWN_SHEETS.has(sheet.name)) continue;
    sheets[sheet.name] = parseSheetRows(sheet.headers, sheet.rows);
  }

  // Legacy single-sheet auction import → map to 03_Players
  if (Object.keys(sheets).length === 0 && input.sheets[0]) {
    const legacy = input.sheets[0];
    const legacyName = legacy.name.toLowerCase();
    if (legacyName.includes("auction") || legacyName.includes("player")) {
      sheets["03_Players"] = parseSheetRows(legacy.headers, legacy.rows);
    }
  }

  return {
    version: manifest?.workbookVersion ?? BMW_VERSION,
    sheets,
    sourceType: input.sourceType,
    sourceLabel: input.sourceLabel,
    manifest: manifest ?? null,
    isLegacy: manifestValidation.isLegacy,
    localMedia: input.localMedia,
  };
}

export class WorkbookParseError extends Error {
  constructor(
    message: string,
    public readonly errors: string[] = [],
  ) {
    super(message);
    this.name = "WorkbookParseError";
  }
}

export function extractLegacyAuctionRows(workbook: ParsedWorkbook): WorkbookSheetData {
  return workbook.sheets["03_Players"] ?? [];
}

/** Map BMW player row to legacy auction import format (backward compat) */
export function bmwPlayerRowToLegacyAuctionRow(
  row: Record<string, unknown>,
  playerId?: number,
): Record<string, unknown> {
  const legacy: Record<string, unknown> = { ...row };
  if (playerId != null) legacy["Player ID"] = playerId;
  // Legacy auction import expects "Registration ID"
  if (row["Registration Code"] && !row["Registration ID"]) {
    legacy["Registration ID"] = row["Registration Code"];
  }
  return legacy;
}

/** @deprecated Use bmwPlayerRowToLegacyAuctionRow */
export const tmwPlayerRowToLegacyAuctionRow = bmwPlayerRowToLegacyAuctionRow;

/** Extract sport from parsed workbook */
export function getWorkbookSport(workbook: ParsedWorkbook): string {
  const tournamentRow = workbook.sheets["01_Tournament"]?.[0];
  return String(tournamentRow?.["Sport"] ?? "cricket").trim() || "cricket";
}

/** Extract asset rows from 09_Assets sheet */
export function extractAssetRows(workbook: ParsedWorkbook): Array<Record<string, unknown>> {
  return workbook.sheets["09_Assets"] ?? [];
}
