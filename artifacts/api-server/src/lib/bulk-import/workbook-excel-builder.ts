import ExcelJS from "exceljs";
import {
  BMW_SHEETS,
  INSTRUCTIONS_SHEET,
  SUMMARY_SHEET,
  BMW_MANIFEST_SHEET,
  REF_SHEET_CATEGORIES,
  REF_SHEET_TEAMS,
  REF_SHEET_STATUS,
  REF_SHEET_ROLES,
  REF_SHEET_SETTINGS,
  REF_SHEET_YES_NO,
  REF_SHEET_SPORTS,
  REF_SHEET_GENDER,
  BMW_CATEGORY_SHEET,
  BMW_TEAM_SHEET,
  buildRegistrationCode,
} from "@workspace/api-base/tournament-workbook";
import type { WorkbookFieldDefinition, WorkbookSheetDefinition } from "@workspace/api-base/tournament-workbook";
import {
  BMW_VERSION,
  BMW_MANIFEST_FIELDS,
  BMW_SUPPORTED_SPORTS,
  createExportManifest,
} from "@workspace/api-base/tournament-workbook";
import { getRoleLabelsForSport, normalizeSportId } from "@workspace/api-base/tournament-workbook";
import { playerTagLabel } from "@workspace/api-base/player-tag-label";
import {
  formatPlayerGenderForWorkbook,
  WORKBOOK_GENDER_LABELS,
} from "@workspace/api-base/player-gender";

/** BidWar Master Workbook — enterprise color system */
const BRAND = {
  gold: "FFFBBF24",
  dark: "FF0A0A0F",
  slate: "FF1E293B",
  white: "FFFFFFFF",
  muted: "FF64748B",
  link: "FF0563C1",
  readonly: "FFE8E8E8",
  editable: "FFFFF2CC",
  auto: "FFE2EFDA",
  required: "FFFFC7CE",
  dropdown: "FFD6E4F0",
  stripe: "FFF8FAFC",
  errorFill: "FFFFC7CE",
  errorFont: "FF9C0006",
  manifest: "FFD9E1F2",
} as const;

const DATA_ROW_CAP = 2000;
const VALIDATION_ROW_CAP = 500;

type ExportContext = {
  tournament: Record<string, unknown>;
  categories: Record<string, unknown>[];
  teams: Record<string, unknown>[];
  players: Record<string, unknown>[];
  profiles: Map<string, Record<string, unknown>>;
  sponsors: Record<string, unknown>[];
  categoryMap: Record<number, string>;
  teamMap: Record<number, string>;
  assets?: Record<string, unknown>[];
};

type RefRanges = {
  categories: string;
  teams: string;
  status: string;
  roles: string;
  yesNo: string;
  sports: string;
  gender: string;
};

function colLetter(col: number): string {
  let n = col;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function sanitizeTableName(sheetName: string): string {
  return `BMW_${sheetName.replace(/[^A-Za-z0-9]/g, "_")}`;
}

function formatBool(v: unknown): string {
  return v === true || v === "true" || v === 1 ? "Yes" : v === false || v === "false" || v === 0 ? "No" : "";
}

function isUrlField(field: WorkbookFieldDefinition): boolean {
  return field.type === "url" || field.type === "photo_url";
}

function isDropdownField(field: WorkbookFieldDefinition): boolean {
  return (
    Boolean(field.enumValues?.length)
    || field.type === "category_ref"
    || field.type === "team_ref"
    || field.type === "boolean"
    || field.key === "role"
    || field.key === "sport"
    || field.key === "gender"
  );
}

function headerColorForField(field: WorkbookFieldDefinition): string {
  if (isDropdownField(field)) return BRAND.dropdown;
  if (field.required && field.editability === "editable") return BRAND.required;
  if (field.editability === "auto") return BRAND.auto;
  if (field.editability === "readonly") return BRAND.readonly;
  return BRAND.editable;
}

function dataFillForField(field: WorkbookFieldDefinition, stripe: boolean): string {
  if (field.editability === "readonly") return BRAND.readonly;
  if (field.editability === "auto") return BRAND.auto;
  return stripe ? BRAND.stripe : BRAND.editable;
}

function enumOptions(field: WorkbookFieldDefinition): string[] {
  if (!field.enumValues?.length) return [];
  if (field.enumLabels) {
    return field.enumValues.map((v) => field.enumLabels![v] ?? v);
  }
  return [...field.enumValues];
}

function fieldTooltip(field: WorkbookFieldDefinition): string {
  const lines: string[] = [];
  if (field.description) lines.push(field.description);
  if (field.required) lines.push("Required — must be filled before import.");
  if (field.editability === "readonly") lines.push("Read-only — do not edit.");
  if (field.editability === "auto") lines.push("Auto-generated — used for identity matching. Edit only when creating new records.");
  if (isDropdownField(field)) lines.push("Select from the dropdown list.");
  if (isUrlField(field)) lines.push("Enter a full URL (https://…). Exported as a clickable link.");
  lines.push(`Field type: ${field.type.replace(/_/g, " ")}.`);
  return lines.join("\n");
}

function refRange(sheetName: string, rows: number, col = "A"): string {
  const end = Math.max(2, rows + 1);
  return `'${sheetName}'!$${col}$2:$${col}$${end}`;
}

/** Live range on a data sheet — grows when organizers add rows (e.g. new categories). */
function dataSheetColumnRange(sheetName: string, col = "A", maxRow = DATA_ROW_CAP): string {
  return `'${sheetName}'!$${col}$2:$${col}$${maxRow}`;
}

function validationFormula(field: WorkbookFieldDefinition, refs: RefRanges): string | null {
  if (field.type === "category_ref") return dataSheetColumnRange(BMW_CATEGORY_SHEET);
  if (field.type === "team_ref") return dataSheetColumnRange(BMW_TEAM_SHEET);
  if (field.type === "boolean") return refs.yesNo;
  if (field.key === "role") return refs.roles;
  if (field.key === "sport") return refs.sports;
  if (field.key === "gender") return refs.gender;
  if (field.key === "status" && field.entity === "player") return refs.status;
  if (field.enumValues?.length) {
    const opts = enumOptions(field);
    return `"${opts.join(",")}"`;
  }
  return null;
}

function buildRowForSheet(
  sheet: WorkbookSheetDefinition,
  ctx: ExportContext,
  record?: Record<string, unknown>,
  profile?: Record<string, unknown> | null,
): Record<string, string | number> {
  const row: Record<string, string | number> = {};
  const t = ctx.tournament;
  const p = record ?? {};
  const prof = profile ?? {};

  for (const field of sheet.fields) {
    switch (field.key) {
      case "registrationCode":
        row[field.label] = buildRegistrationCode(
          String(p.mobileNumber ?? ""),
          String(p.name ?? ""),
          String(t.auctionCode ?? ""),
        );
        break;
      case "playerId":
        row[field.label] = (p.id as number) ?? "";
        break;
      case "name":
        row[field.label] = String(p.name ?? t.name ?? "");
        break;
      case "mobile":
        row[field.label] = field.entity === "tournament"
          ? String(t.organizerMobile ?? "")
          : String(p.mobileNumber ?? "");
        break;
      case "email":
        if (field.entity === "tournament") {
          row[field.label] = String(t.organizerEmail ?? "");
        } else if (field.entity === "team") {
          row[field.label] = String(p.ownerEmail ?? "");
        } else {
          row[field.label] = String(p.email ?? "");
        }
        break;
      case "gender":
        row[field.label] = formatPlayerGenderForWorkbook(p.gender as string | null | undefined);
        break;
      case "category":
        row[field.label] = p.categoryId
          ? (ctx.categoryMap[p.categoryId as number] ?? "")
          : String(prof.category ?? "");
        break;
      case "currentTeam":
        row[field.label] = p.teamId ? (ctx.teamMap[p.teamId as number] ?? "") : "";
        break;
      case "baseValue":
        row[field.label] = (p.basePrice as number) ?? (t.minBid as number) ?? "";
        break;
      case "auctionOrder":
        row[field.label] = (p.serialNo as number) ?? "";
        break;
      case "status":
        row[field.label] = {
          available: "Available", sold: "Sold", unsold: "Unsold", retained: "Retained", withdrawn: "Withdrawn",
        }[String(p.status ?? t.status ?? "")] ?? String(p.status ?? t.status ?? "");
        break;
      case "specialTags":
        row[field.label] = playerTagLabel(p.playerTag as string) ?? "";
        break;
      case "captain":
        row[field.label] = p.playerTag === "captain" ? "Yes" : "No";
        break;
      case "viceCaptain":
        row[field.label] = p.playerTag === "vice_captain" ? "Yes" : "No";
        break;
      case "retained":
        row[field.label] = p.status === "retained" ? "Yes" : "No";
        break;
      case "wildcard":
        row[field.label] = formatBool(prof.isWildcard);
        break;
      case "budget":
        row[field.label] = (p.purse as number) ?? (t.basePurse as number) ?? (record?.minBid as number) ?? "";
        break;
      case "remainingBudget":
        if (p.purse != null && p.purseUsed != null) {
          row[field.label] = (p.purse as number) - (p.purseUsed as number);
        } else row[field.label] = "";
        break;
      case "logo":
      case "tournamentLogo":
        row[field.label] = String(t.logoUrl ?? p.logoUrl ?? "");
        break;
      case "banner":
      case "bannerUrl":
        row[field.label] = String(t.mainBannerUrl ?? "");
        break;
      case "photoUrl":
      case "logoUrl":
        row[field.label] = String(p.photoUrl ?? p.logoUrl ?? p.url ?? "");
        break;
      default: {
        const col = field.column;
        let raw: unknown;
        if (field.entity === "tournament") raw = col ? t[col] : undefined;
        else if (field.entity === "player") raw = col ? p[col] : undefined;
        else if (field.entity === "tournament_profile") raw = col ? prof[col] : undefined;
        else if (field.entity === "team") raw = col ? p[col] : undefined;
        else if (field.entity === "category") raw = col ? record?.[col] : undefined;
        else if (field.entity === "sponsor") raw = col ? p[col] : undefined;
        else raw = record?.[field.key];

        if (field.type === "boolean") row[field.label] = formatBool(raw);
        else row[field.label] = raw == null ? "" : (typeof raw === "number" ? raw : String(raw));
      }
    }
  }
  return row;
}

function setCellValue(cell: ExcelJS.Cell, value: string | number, field?: WorkbookFieldDefinition): void {
  const str = value == null ? "" : String(value);
  if (field && isUrlField(field) && /^https?:\/\//i.test(str)) {
    cell.value = { text: str, hyperlink: str, tooltip: str };
    cell.font = { color: { argb: BRAND.link }, underline: true };
  } else {
    cell.value = value;
  }
}

function autoSizeColumns(ws: ExcelJS.Worksheet, colCount: number, minWidth = 12, maxWidth = 44): void {
  for (let c = 1; c <= colCount; c++) {
    let maxLen = minWidth;
    ws.getColumn(c).eachCell({ includeEmpty: false }, (cell) => {
      const text = cell.value instanceof Object && cell.value !== null && "text" in cell.value
        ? String((cell.value as { text: string }).text)
        : String(cell.value ?? "");
      maxLen = Math.max(maxLen, Math.min(text.length + 2, maxWidth));
    });
    ws.getColumn(c).width = maxLen;
  }
}

function applyEnterpriseSheetStyling(
  ws: ExcelJS.Worksheet,
  sheetDef: WorkbookSheetDefinition,
  refs: RefRanges,
  lastDataRow: number,
): void {
  const colCount = sheetDef.fields.length;
  if (colCount === 0) return;

  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  headerRow.font = { bold: true, color: { argb: BRAND.dark }, size: 11 };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (colNumber > colCount) return;
    const field = sheetDef.fields[colNumber - 1];
    if (!field) return;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColorForField(field) } };
    cell.border = {
      top: { style: "thin", color: { argb: BRAND.slate } },
      bottom: { style: "thin", color: { argb: BRAND.slate } },
      left: { style: "thin", color: { argb: BRAND.slate } },
      right: { style: "thin", color: { argb: BRAND.slate } },
    };
    cell.note = fieldTooltip(field);
    cell.protection = { locked: true };
  });

  for (let r = 2; r <= lastDataRow; r++) {
    const stripe = r % 2 === 0;
    const row = ws.getRow(r);
    row.alignment = { vertical: "middle", wrapText: false };
    sheetDef.fields.forEach((field, i) => {
      const cell = row.getCell(i + 1);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: dataFillForField(field, stripe) } };
      cell.border = {
        top: { style: "hair", color: { argb: "FFE2E8F0" } },
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
      };
      cell.protection = { locked: field.editability === "readonly" || field.editability === "auto" };

      if (isUrlField(field)) {
        const raw = cell.value;
        const str = raw == null ? "" : String(raw);
        if (/^https?:\/\//i.test(str)) {
          setCellValue(cell, str, field);
        }
      }

      if (field.key === "mobile" || field.key === "registrationCode" || field.key === "playerId") {
        cell.numFmt = "@";
      }

      const validation = validationFormula(field, refs);
      if (validation && r <= VALIDATION_ROW_CAP) {
        cell.dataValidation = {
          type: validation.startsWith('"') ? "list" : "list",
          allowBlank: !field.required,
          formulae: [validation],
          showErrorMessage: true,
          errorTitle: "Invalid value",
          error: field.required
            ? `"${field.label}" must match an allowed value.`
            : `"${field.label}" should match an allowed value.`,
        };
      }
    });
  }

  const xSplit = sheetDef.freezeColumns ?? 0;
  ws.views = [{ state: "frozen", xSplit, ySplit: 1, activeCell: "A2" }];

  if (lastDataRow >= 1) {
    const endCol = colLetter(colCount);
    const tableRows: (string | number)[][] = [];
    for (let r = 2; r <= lastDataRow; r++) {
      const rowVals: (string | number)[] = [];
      for (let c = 1; c <= colCount; c++) {
        const cell = ws.getCell(r, c);
        const v = cell.value;
        if (v instanceof Object && v !== null && "text" in v) {
          rowVals.push(String((v as { text: string }).text));
        } else {
          rowVals.push(v == null ? "" : (typeof v === "number" ? v : String(v)));
        }
      }
      tableRows.push(rowVals);
    }

    ws.addTable({
      name: sanitizeTableName(sheetDef.name),
      ref: `A1:${endCol}${lastDataRow}`,
      headerRow: true,
      totalsRow: false,
      columns: sheetDef.fields.map((f) => ({ name: f.label, filterButton: true })),
      rows: tableRows,
      style: {
        theme: "TableStyleMedium2",
        showRowStripes: true,
        showFirstColumn: (sheetDef.freezeColumns ?? 0) > 0,
      },
    });
  }

  sheetDef.fields.forEach((field, i) => {
    if (!field.required || field.editability === "auto") return;
    const col = colLetter(i + 1);
    const ref = `${col}2:${col}${Math.max(lastDataRow, VALIDATION_ROW_CAP)}`;
    ws.addConditionalFormatting({
      ref,
      rules: [
        {
          type: "expression",
          priority: 1,
          formulae: [`LEN(TRIM(${col}2))=0`],
          style: {
            fill: { type: "pattern", pattern: "solid", bgColor: { argb: BRAND.errorFill } },
            font: { color: { argb: BRAND.errorFont } },
          },
        },
      ],
    });
  });

  autoSizeColumns(ws, colCount);
  ws.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertRows: true,
    insertColumns: false,
    deleteRows: true,
    deleteColumns: false,
    sort: true,
    autoFilter: true,
  });
}

function fillStyleCell(ws: ExcelJS.Worksheet, row: number, col: number, color: string, label: string): void {
  const cell = ws.getCell(row, col);
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  cell.value = label;
  cell.font = { bold: true, size: 10, color: { argb: BRAND.dark } };
  cell.border = {
    top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" },
  };
}

function addDashboardSheet(wb: ExcelJS.Workbook, ctx: ExportContext): void {
  const ws = wb.addWorksheet(INSTRUCTIONS_SHEET, { views: [{ showGridLines: false }] });
  const tName = String(ctx.tournament.name ?? "Tournament");
  const sport = normalizeSportId(String(ctx.tournament.sport ?? "cricket"));
  const generatedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

  ws.mergeCells("A1:F1");
  const title = ws.getCell("A1");
  title.value = "BidWar Master Workbook";
  title.font = { bold: true, size: 20, color: { argb: BRAND.gold } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.dark } };
  title.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 36;

  ws.mergeCells("A2:F2");
  const subtitle = ws.getCell("A2");
  subtitle.value = "Enterprise tournament data exchange — one workbook, complete control";
  subtitle.font = { italic: true, size: 11, color: { argb: BRAND.white } };
  subtitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.slate } };
  subtitle.alignment = { horizontal: "center" };
  ws.getRow(2).height = 22;

  let row = 4;
  const info: [string, string][] = [
    ["Tournament", tName],
    ["Sport", sport.replace(/_/g, " ")],
    ["Workbook Version", BMW_VERSION],
    ["Generated", `${generatedAt} IST`],
    ["Players", String(ctx.players.length)],
    ["Teams", String(ctx.teams.length)],
    ["Categories", String(ctx.categories.length)],
  ];
  ws.getCell(row, 1).value = "Overview";
  ws.getCell(row, 1).font = { bold: true, size: 13, color: { argb: BRAND.dark } };
  row++;
  for (const [label, value] of info) {
    ws.getCell(row, 1).value = label;
    ws.getCell(row, 1).font = { bold: true, color: { argb: BRAND.muted } };
    ws.getCell(row, 2).value = value;
    row++;
  }

  row++;
  ws.getCell(row, 1).value = "Quick Start";
  ws.getCell(row, 1).font = { bold: true, size: 13 };
  row++;
  const steps = [
    "1. Review 00_Summary for live counts and completion status.",
    "2. Edit yellow cells on data sheets (01–09). Grey and green cells are protected.",
    "3. Use dropdowns (blue headers). Category & team lists read live from 02_Categories and 04_Teams tabs.",
    "4. Paste photo/logo URLs — they export as clickable links.",
    "5. Import back via BidWar → Tournament Master Workbook.",
  ];
  for (const step of steps) {
    ws.getCell(row, 1).value = step;
    ws.mergeCells(row, 1, row, 6);
    row++;
  }

  row++;
  ws.getCell(row, 1).value = "Color Legend";
  ws.getCell(row, 1).font = { bold: true, size: 13 };
  row++;
  fillStyleCell(ws, row, 1, BRAND.readonly, "Grey — Read Only");
  fillStyleCell(ws, row, 3, BRAND.editable, "Yellow — Editable");
  fillStyleCell(ws, row, 5, BRAND.auto, "Green — Auto Generated");
  row++;
  fillStyleCell(ws, row, 1, BRAND.required, "Red — Required");
  fillStyleCell(ws, row, 3, BRAND.dropdown, "Blue — Dropdown");
  row += 2;

  ws.getCell(row, 1).value = "Identity Matching (no database IDs)";
  ws.getCell(row, 1).font = { bold: true, size: 13 };
  row++;
  const identity = [
    ["Priority 1", "Registration Code (recommended)"],
    ["Priority 2", "Mobile number"],
    ["Priority 3", "Email address"],
    ["Priority 4", "Name + Date of Birth"],
    ["Priority 5", "Create New player"],
  ];
  for (const [p, desc] of identity) {
    ws.getCell(row, 1).value = p;
    ws.getCell(row, 1).font = { bold: true };
    ws.getCell(row, 2).value = desc;
    ws.mergeCells(row, 2, row, 6);
    row++;
  }

  row++;
  ws.getCell(row, 1).value = "Data Sheets";
  ws.getCell(row, 1).font = { bold: true, size: 13 };
  row++;
  for (const sheet of BMW_SHEETS) {
    ws.getCell(row, 1).value = sheet.name;
    ws.getCell(row, 1).font = { bold: true, color: { argb: BRAND.link } };
    ws.getCell(row, 2).value = sheet.title;
    ws.mergeCells(row, 2, row, 6);
    row++;
  }

  row++;
  ws.getCell(row, 1).value = "Import Modes";
  ws.getCell(row, 1).font = { bold: true, size: 13 };
  row++;
  ws.getCell(row, 1).value = "merge_data · update_tournament · create_tournament · dry_run · replace_data · clone_tournament";
  ws.mergeCells(row, 1, row, 6);
  ws.getCell(row, 1).alignment = { wrapText: true };

  ws.getColumn(1).width = 22;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 18;
  ws.getColumn(5).width = 18;
  ws.getColumn(6).width = 18;
  ws.protect("", { selectLockedCells: true, selectUnlockedCells: true });
}

function computeSheetCompletion(
  ws: ExcelJS.Worksheet,
  sheetDef: WorkbookSheetDefinition,
  lastRow: number,
): number {
  if (lastRow <= 1) return 100;
  const required = sheetDef.fields.filter((f) => f.required && f.editability !== "auto");
  if (required.length === 0) return 100;

  let total = 0;
  let filled = 0;
  for (let r = 2; r <= lastRow; r++) {
    for (const field of required) {
      const idx = sheetDef.fields.indexOf(field) + 1;
      total++;
      const val = ws.getCell(r, idx).value;
      const text = val instanceof Object && val !== null && "text" in val
        ? String((val as { text: string }).text)
        : String(val ?? "");
      if (text.trim()) filled++;
    }
  }
  return total === 0 ? 100 : Math.round((filled / total) * 100);
}

function fillSummarySheet(
  ws: ExcelJS.Worksheet,
  ctx: ExportContext,
  wb: ExcelJS.Workbook,
  sheetRowCounts: Map<string, number>,
): void {
  const tName = String(ctx.tournament.name ?? "Tournament");

  ws.mergeCells("A1:D1");
  ws.getCell("A1").value = "BidWar Workbook Summary";
  ws.getCell("A1").font = { bold: true, size: 16, color: { argb: BRAND.gold } };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.dark } };
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 30;

  ws.mergeCells("A2:D2");
  ws.getCell("A2").value = tName;
  ws.getCell("A2").font = { bold: true, size: 12 };
  ws.getCell("A2").alignment = { horizontal: "center" };

  ws.getRow(4).values = ["Sheet", "Records", "Required Completion", "Live Count Formula"];
  ws.getRow(4).font = { bold: true, color: { argb: BRAND.dark } };
  ws.getRow(4).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.gold } };
  });

  let row = 5;
  let totalCompletion = 0;
  let completionSheets = 0;

  for (const sheetDef of BMW_SHEETS) {
    const dataWs = wb.getWorksheet(sheetDef.name);
    const lastRow = sheetRowCounts.get(sheetDef.name) ?? 1;
    const recordCount = Math.max(0, lastRow - 1);
    const completion = dataWs ? computeSheetCompletion(dataWs, sheetDef, lastRow) : 100;

    if (sheetDef.fields.some((f) => f.required)) {
      totalCompletion += completion;
      completionSheets++;
    }

    const firstRequired = sheetDef.fields.find((f) => f.required);
    const countCol = firstRequired ? colLetter(sheetDef.fields.indexOf(firstRequired) + 1) : "A";
    const liveFormula = recordCount > 0
      ? `=COUNTA('${sheetDef.name}'!${countCol}2:${countCol}${DATA_ROW_CAP})`
      : 0;

    ws.getCell(row, 1).value = `${sheetDef.name.replace(/^\d+_/, "")} — ${sheetDef.title}`;
    ws.getCell(row, 2).value = recordCount;
    ws.getCell(row, 3).value = `${completion}%`;
    ws.getCell(row, 3).font = {
      color: { argb: completion >= 90 ? "FF006100" : completion >= 70 ? "FF9C6500" : BRAND.errorFont },
      bold: true,
    };
    ws.getCell(row, 4).value = { formula: String(liveFormula) };
    row++;
  }

  row++;
  const overall = completionSheets > 0 ? Math.round(totalCompletion / completionSheets) : 100;
  ws.mergeCells(`A${row}:B${row}`);
  ws.getCell(row, 1).value = "Overall Completion";
  ws.getCell(row, 1).font = { bold: true, size: 13 };
  ws.getCell(row, 3).value = `${overall}%`;
  ws.getCell(row, 3).font = { bold: true, size: 14, color: { argb: overall >= 90 ? "FF006100" : BRAND.errorFont } };

  row += 2;
  ws.getCell(row, 1).value = "Totals";
  ws.getCell(row, 1).font = { bold: true, size: 12 };
  row++;
  const totals: [string, number | { formula: string }][] = [
    ["Categories", { formula: `=COUNTA('02_Categories'!A2:A${DATA_ROW_CAP})` }],
    ["Players", { formula: `=COUNTA('03_Players'!B2:B${DATA_ROW_CAP})` }],
    ["Teams", { formula: `=COUNTA('04_Teams'!A2:A${DATA_ROW_CAP})` }],
    ["Sponsors", { formula: `=COUNTA('05_Sponsors'!A2:A${DATA_ROW_CAP})` }],
    ["Assets", { formula: `=COUNTA('09_Assets'!A2:A${DATA_ROW_CAP})` }],
  ];
  for (const [label, val] of totals) {
    ws.getCell(row, 1).value = label;
    ws.getCell(row, 1).font = { bold: true };
    ws.getCell(row, 2).value = typeof val === "number" ? val : val;
    row++;
  }

  ws.getColumn(1).width = 36;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 36;
  ws.protect("", { selectLockedCells: true, selectUnlockedCells: true });
}

function addManifestSheet(wb: ExcelJS.Workbook, sport: string): void {
  const ws = wb.addWorksheet(BMW_MANIFEST_SHEET);
  const manifest = createExportManifest({ sport: normalizeSportId(sport) });
  ws.addRow(["Field", "Value"]);
  for (const field of BMW_MANIFEST_FIELDS) {
    ws.addRow([field.label, manifest[field.key] ?? ""]);
  }
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.manifest } };
  });
  autoSizeColumns(ws, 2, 14, 50);
  ws.protect("", { selectLockedCells: true, selectUnlockedCells: false });
  ws.state = "veryHidden";
}

function addReferenceSheets(wb: ExcelJS.Workbook, ctx: ExportContext): RefRanges {
  const sport = normalizeSportId(ctx.tournament.sport ?? "cricket");

  const catWs = wb.addWorksheet(REF_SHEET_CATEGORIES);
  catWs.addRow(["Category Name"]);
  const catNames = ctx.categories.length ? ctx.categories.map((c) => [c.name]) : [["—"]];
  catNames.forEach((r) => catWs.addRow(r));
  catWs.state = "veryHidden";

  const teamWs = wb.addWorksheet(REF_SHEET_TEAMS);
  teamWs.addRow(["Team Name"]);
  const teamNames = ctx.teams.length ? ctx.teams.map((t) => [t.name]) : [["—"]];
  teamNames.forEach((r) => teamWs.addRow(r));
  teamWs.state = "veryHidden";

  const statusWs = wb.addWorksheet(REF_SHEET_STATUS);
  statusWs.addRow(["Status"]);
  const statusLabels = ["Available", "Sold", "Unsold", "Retained", "Withdrawn"];
  statusLabels.forEach((s) => statusWs.addRow([s]));
  statusWs.state = "veryHidden";

  const rolesWs = wb.addWorksheet(REF_SHEET_ROLES);
  rolesWs.addRow(["Role"]);
  const roles = getRoleLabelsForSport(sport);
  (roles.length ? roles : ["—"]).forEach((role) => rolesWs.addRow([role]));
  rolesWs.state = "veryHidden";

  const yesWs = wb.addWorksheet(REF_SHEET_YES_NO);
  yesWs.addRow(["Value"]);
  yesWs.addRow(["Yes"]);
  yesWs.addRow(["No"]);
  yesWs.state = "veryHidden";

  const sportsWs = wb.addWorksheet(REF_SHEET_SPORTS);
  sportsWs.addRow(["Sport"]);
  BMW_SUPPORTED_SPORTS.forEach((s) => sportsWs.addRow([s.replace(/_/g, " ")]));
  sportsWs.state = "veryHidden";

  const genderWs = wb.addWorksheet(REF_SHEET_GENDER);
  genderWs.addRow(["Gender"]);
  WORKBOOK_GENDER_LABELS.forEach((g) => genderWs.addRow([g]));
  genderWs.state = "veryHidden";

  const settingsWs = wb.addWorksheet(REF_SHEET_SETTINGS);
  settingsWs.addRow(["Setting", "Value"]);
  settingsWs.addRow(["Sport", sport]);
  settingsWs.addRow(["Workbook Version", BMW_VERSION]);
  settingsWs.state = "veryHidden";

  return {
    categories: refRange(REF_SHEET_CATEGORIES, catNames.length),
    teams: refRange(REF_SHEET_TEAMS, teamNames.length),
    status: refRange(REF_SHEET_STATUS, statusLabels.length),
    roles: refRange(REF_SHEET_ROLES, roles.length || 1),
    yesNo: refRange(REF_SHEET_YES_NO, 2),
    sports: refRange(REF_SHEET_SPORTS, BMW_SUPPORTED_SPORTS.length),
    gender: refRange(REF_SHEET_GENDER, WORKBOOK_GENDER_LABELS.length),
  };
}

function buildAssetRows(ctx: ExportContext): Record<string, string | number>[] {
  const assets: Record<string, string | number>[] = [];
  const t = ctx.tournament;

  if (t.logoUrl) {
    assets.push({ "Entity Type": "Tournament", "Entity Name": String(t.name ?? ""), "Media Type": "Logo", Source: "Direct URL", URL: String(t.logoUrl), "Target Folder": "bidwar/workbook/logos", Status: "Uploaded" });
  }
  if (t.mainBannerUrl) {
    assets.push({ "Entity Type": "Tournament", "Entity Name": String(t.name ?? ""), "Media Type": "Banner", Source: "Direct URL", URL: String(t.mainBannerUrl), "Target Folder": "bidwar/workbook/banners", Status: "Uploaded" });
  }

  for (const player of ctx.players) {
    if (player.photoUrl) {
      assets.push({ "Entity Type": "Player", "Entity Name": String(player.name ?? ""), "Media Type": "Photo", Source: "Direct URL", URL: String(player.photoUrl), "Target Folder": "bidwar/workbook/photos", Status: "Uploaded" });
    }
  }

  for (const team of ctx.teams) {
    if (team.logoUrl) {
      assets.push({ "Entity Type": "Team", "Entity Name": String(team.name ?? ""), "Media Type": "Logo", Source: "Direct URL", URL: String(team.logoUrl), "Target Folder": "bidwar/workbook/logos", Status: "Uploaded" });
    }
  }

  for (const sponsor of ctx.sponsors) {
    if (sponsor.url) {
      assets.push({ "Entity Type": "Sponsor", "Entity Name": String(sponsor.name ?? ""), "Media Type": "Logo", Source: "Direct URL", URL: String(sponsor.url), "Target Folder": "bidwar/workbook/logos", Status: "Uploaded" });
    }
  }

  return assets;
}

function populateDataSheet(
  ws: ExcelJS.Worksheet,
  sheetDef: WorkbookSheetDefinition,
  ctx: ExportContext,
): number {
  const headers = sheetDef.fields.map((f) => f.label);
  ws.addRow(headers);

  const writeRow = (rowData: Record<string, string | number>) => {
    const excelRow = ws.addRow([]);
    sheetDef.fields.forEach((field, i) => {
      const val = rowData[field.label] ?? "";
      setCellValue(excelRow.getCell(i + 1), val, field);
    });
  };

  if (sheetDef.name === "01_Tournament") {
    writeRow(buildRowForSheet(sheetDef, ctx));
  } else if (sheetDef.name === "02_Categories") {
    for (const cat of ctx.categories) writeRow(buildRowForSheet(sheetDef, ctx, cat));
  } else if (sheetDef.name === "03_Players") {
    for (const player of ctx.players) {
      const profile = player.globalPlayerId
        ? ctx.profiles.get(String(player.globalPlayerId)) ?? null
        : null;
      writeRow(buildRowForSheet(sheetDef, ctx, player, profile));
    }
  } else if (sheetDef.name === "04_Teams") {
    for (const team of ctx.teams) writeRow(buildRowForSheet(sheetDef, ctx, team));
  } else if (sheetDef.name === "05_Sponsors") {
    for (const sponsor of ctx.sponsors) writeRow(buildRowForSheet(sheetDef, ctx, sponsor));
  } else if (sheetDef.name === "09_Assets") {
    const assetRows = ctx.assets ?? buildAssetRows(ctx);
    for (const asset of assetRows) {
      const excelRow = ws.addRow([]);
      sheetDef.fields.forEach((field, i) => {
        const val = asset[field.label];
        setCellValue(excelRow.getCell(i + 1), val == null || val === "" ? "" : String(val), field);
      });
    }
  } else if (["06_Auction_Settings", "07_Match_Settings", "08_Organizers"].includes(sheetDef.name)) {
    writeRow(buildRowForSheet(sheetDef, ctx));
  }

  return ws.rowCount;
}

export async function buildTournamentWorkbookExcel(ctx: ExportContext): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BidWar Master Workbook";
  wb.lastModifiedBy = "BidWar Master Workbook Generator";
  wb.created = new Date();
  wb.modified = new Date();
  wb.properties.date1904 = false;
  const sport = String(ctx.tournament.sport ?? "cricket");

  addDashboardSheet(wb, ctx);
  wb.addWorksheet(SUMMARY_SHEET, { views: [{ showGridLines: false }] });
  addManifestSheet(wb, sport);
  const refs = addReferenceSheets(wb, ctx);

  const sheetRowCounts = new Map<string, number>();

  for (const sheetDef of BMW_SHEETS) {
    const ws = wb.addWorksheet(sheetDef.name);
    const lastRow = populateDataSheet(ws, sheetDef, ctx);
    sheetRowCounts.set(sheetDef.name, lastRow);
    applyEnterpriseSheetStyling(ws, sheetDef, refs, lastRow);
  }

  const summaryWs = wb.getWorksheet(SUMMARY_SHEET);
  if (summaryWs) fillSummarySheet(summaryWs, ctx, wb, sheetRowCounts);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** @deprecated Use buildTournamentWorkbookExcel */
export const buildTmwWorkbookExcel = buildTournamentWorkbookExcel;
