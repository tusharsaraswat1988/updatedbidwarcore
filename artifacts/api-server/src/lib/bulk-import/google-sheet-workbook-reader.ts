/**
 * Read Tournament Master Workbook from Google Sheets URL.
 * Supports public export fallback and authenticated Sheets API.
 */

import ExcelJS from "exceljs";
import { getValidAccessToken } from "../google-sheets-service";
import type { RawWorkbookInput } from "@workspace/api-base/tournament-workbook";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

export function extractSpreadsheetId(url: string): string | null {
  const trimmed = url.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

async function fetchPublicXlsxExport(spreadsheetId: string): Promise<Buffer | null> {
  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
  try {
    const res = await fetch(exportUrl, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("spreadsheet") && !contentType.includes("octet-stream")) {
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function parseExcelBufferToRawWorkbook(buffer: Buffer): Promise<RawWorkbookInput> {
  const workbook = new ExcelJS.Workbook();
  const loadXlsx = workbook.xlsx.load.bind(workbook.xlsx) as (
    input: Buffer | Uint8Array | ArrayBuffer,
  ) => Promise<ExcelJS.Workbook>;
  await loadXlsx(buffer);

  const sheets = workbook.worksheets.map((ws) => {
    const headers: string[] = [];
    ws.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? "").trim();
    });

    const rows: unknown[][] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values: unknown[] = [];
      row.eachCell((cell, colNumber) => {
        values[colNumber - 1] = cell.value;
      });
      rows.push(values);
    });

    return { name: ws.name, headers, rows };
  });

  return { sheets, sourceType: "excel" };
}

async function readViaSheetsApi(
  spreadsheetId: string,
  accessToken: string,
): Promise<RawWorkbookInput> {
  const metaRes = await fetch(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties.title`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meta = await metaRes.json() as {
    sheets?: Array<{ properties?: { title?: string } }>;
    error?: { message?: string };
  };
  if (!metaRes.ok) throw new Error(meta.error?.message ?? "Failed to read spreadsheet");

  const sheetNames = meta.sheets?.map((s) => s.properties?.title).filter(Boolean) as string[] ?? [];
  const sheets: RawWorkbookInput["sheets"] = [];

  for (const name of sheetNames) {
    const range = encodeURIComponent(name);
    const valRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${range}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const valBody = await valRes.json() as { values?: unknown[][]; error?: { message?: string } };
    if (!valRes.ok || !valBody.values?.length) continue;

    const [headerRow, ...dataRows] = valBody.values;
    sheets.push({
      name,
      headers: (headerRow ?? []).map((h) => String(h ?? "").trim()),
      rows: dataRows.map((r) => r.map((c) => c)),
    });
  }

  return { sheets, sourceType: "google_sheets", sourceLabel: spreadsheetId };
}

export async function readWorkbookFromGoogleSheetUrl(
  url: string,
  ownerKey = "admin",
): Promise<RawWorkbookInput> {
  const spreadsheetId = extractSpreadsheetId(url);
  if (!spreadsheetId) throw new Error("Invalid Google Sheets URL");

  // A) Public export — no download required by user
  const xlsxBuffer = await fetchPublicXlsxExport(spreadsheetId);
  if (xlsxBuffer) {
    const parsed = await parseExcelBufferToRawWorkbook(xlsxBuffer);
    return { ...parsed, sourceType: "google_sheets", sourceLabel: url };
  }

  // B) Authenticated Sheets API
  const accessToken = await getValidAccessToken(ownerKey);
  return readViaSheetsApi(spreadsheetId, accessToken);
}