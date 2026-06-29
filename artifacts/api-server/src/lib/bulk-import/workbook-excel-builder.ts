import ExcelJS from "exceljs";
import {
  BMW_SHEETS,
  INSTRUCTIONS_SHEET,
  BMW_MANIFEST_SHEET,
  REF_SHEET_CATEGORIES,
  REF_SHEET_TEAMS,
  REF_SHEET_STATUS,
  REF_SHEET_ROLES,
  REF_SHEET_SETTINGS,
  buildRegistrationCode,
  PLAYER_STATUS_VALUES,
} from "@workspace/api-base/tournament-workbook";
import type { WorkbookSheetDefinition } from "@workspace/api-base/tournament-workbook";
import {
  BMW_VERSION,
  BMW_MANIFEST_FIELDS,
  createExportManifest,
} from "@workspace/api-base/tournament-workbook";
import { getRoleLabelsForSport, normalizeSportId } from "@workspace/api-base/tournament-workbook";
import { playerTagLabel } from "@workspace/api-base/player-tag-label";

const COLORS = {
  readonly: "FFE0E0E0",
  editable: "FFFFF2CC",
  auto: "FFE2EFDA",
  header: "FFFBBF24",
  headerFg: "FF0A0A0F",
  manifest: "FFD9E1F2",
};

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

function formatBool(v: unknown): string {
  return v === true || v === "true" || v === 1 ? "Yes" : v === false || v === "false" || v === 0 ? "No" : "";
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
      case "name":
        row[field.label] = String(p.name ?? t.name ?? "");
        break;
      case "mobile":
        row[field.label] = String(p.mobileNumber ?? t.organizerMobile ?? "");
        break;
      case "email":
        row[field.label] = String(p.email ?? t.organizerEmail ?? "");
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

function applySheetStyling(ws: ExcelJS.Worksheet, sheetDef: WorkbookSheetDefinition): void {
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: COLORS.headerFg } };
  headerRow.eachCell((cell, colNumber) => {
    const field = sheetDef.fields[colNumber - 1];
    if (!field) return;
    const color =
      field.editability === "readonly" ? COLORS.readonly
      : field.editability === "auto" ? COLORS.auto
      : COLORS.editable;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  });

  if (sheetDef.freezeColumns) {
    ws.views = [{ state: "frozen", xSplit: sheetDef.freezeColumns, ySplit: 1 }];
  }
  ws.autoFilter = { from: "A1", to: { row: 1, column: sheetDef.fields.length } };

  sheetDef.fields.forEach((field, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.max(field.label.length + 4, 14);
    if (field.enumValues?.length) {
      for (let r = 2; r <= 500; r++) {
        ws.getCell(r, i + 1).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`"${field.enumValues.join(",")}"`],
        };
      }
    }
  });
}

function addInstructionsSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet(INSTRUCTIONS_SHEET);
  const lines = [
    ["BidWar Master Workbook (BMW)", ""],
    ["Version", BMW_VERSION],
    ["", ""],
    ["Color Key", ""],
    ["Grey", "Read-only — do not edit"],
    ["Yellow", "Editable fields"],
    ["Green", "Auto-generated (Registration Code)"],
    ["", ""],
    ["Identity Matching (no database IDs)", ""],
    ["1", "Registration Code (recommended)"],
    ["2", "Mobile"],
    ["3", "Email"],
    ["4", "Name + DOB"],
    ["5", "Create New"],
    ["", ""],
    ["Import Modes", "create_tournament | update_tournament | merge_data | replace_data | clone_tournament | dry_run"],
    ["", ""],
    ["ZIP Import", "Upload Tournament.zip containing workbook.xlsx + Photos/Logos folders"],
  ];
  for (const line of lines) ws.addRow(line);
  ws.getColumn(1).width = 40;
  ws.getColumn(2).width = 60;
}

function addManifestSheet(wb: ExcelJS.Workbook, sport: string): void {
  const ws = wb.addWorksheet(BMW_MANIFEST_SHEET);
  const manifest = createExportManifest({ sport: normalizeSportId(sport) });
  ws.addRow(["Field", "Value"]);
  for (const field of BMW_MANIFEST_FIELDS) {
    ws.addRow([field.label, manifest[field.key] ?? ""]);
  }
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 50;
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.manifest } };
  });
  ws.protect("", { selectLockedCells: true, selectUnlockedCells: false });
  ws.state = "veryHidden";
}

function addReferenceSheets(wb: ExcelJS.Workbook, ctx: ExportContext): void {
  const sport = normalizeSportId(ctx.tournament.sport ?? "cricket");

  const catWs = wb.addWorksheet(REF_SHEET_CATEGORIES);
  catWs.addRow(["Category Name"]);
  ctx.categories.forEach((c) => catWs.addRow([c.name]));
  catWs.state = "veryHidden";

  const teamWs = wb.addWorksheet(REF_SHEET_TEAMS);
  teamWs.addRow(["Team Name"]);
  ctx.teams.forEach((t) => teamWs.addRow([t.name]));
  teamWs.state = "veryHidden";

  const statusWs = wb.addWorksheet(REF_SHEET_STATUS);
  statusWs.addRow(["Status"]);
  PLAYER_STATUS_VALUES.forEach((s) => statusWs.addRow([s]));
  statusWs.state = "veryHidden";

  const rolesWs = wb.addWorksheet(REF_SHEET_ROLES);
  rolesWs.addRow(["Role", "Sport"]);
  for (const role of getRoleLabelsForSport(sport)) {
    rolesWs.addRow([role, sport]);
  }
  rolesWs.state = "veryHidden";

  const settingsWs = wb.addWorksheet(REF_SHEET_SETTINGS);
  settingsWs.addRow(["Setting", "Value"]);
  settingsWs.addRow(["Sport", sport]);
  settingsWs.addRow(["Workbook Version", BMW_VERSION]);
  settingsWs.state = "veryHidden";
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

export async function buildTournamentWorkbookExcel(ctx: ExportContext): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BidWar Master Workbook";
  wb.created = new Date();
  const sport = String(ctx.tournament.sport ?? "cricket");

  addInstructionsSheet(wb);
  addManifestSheet(wb, sport);
  addReferenceSheets(wb, ctx);

  for (const sheetDef of BMW_SHEETS) {
    const ws = wb.addWorksheet(sheetDef.name);
    const headers = sheetDef.fields.map((f) => f.label);
    ws.addRow(headers);

    if (sheetDef.name === "01_Tournament") {
      ws.addRow(headers.map((h) => buildRowForSheet(sheetDef, ctx)[h] ?? ""));
    } else if (sheetDef.name === "02_Categories") {
      for (const cat of ctx.categories) {
        const row = buildRowForSheet(sheetDef, ctx, cat);
        ws.addRow(headers.map((h) => row[h] ?? ""));
      }
    } else if (sheetDef.name === "03_Players") {
      for (const player of ctx.players) {
        const profile = player.globalPlayerId
          ? ctx.profiles.get(String(player.globalPlayerId)) ?? null
          : null;
        const row = buildRowForSheet(sheetDef, ctx, player, profile);
        ws.addRow(headers.map((h) => row[h] ?? ""));
      }
    } else if (sheetDef.name === "04_Teams") {
      for (const team of ctx.teams) {
        const row = buildRowForSheet(sheetDef, ctx, team);
        ws.addRow(headers.map((h) => row[h] ?? ""));
      }
    } else if (sheetDef.name === "05_Sponsors") {
      for (const sponsor of ctx.sponsors) {
        const row = buildRowForSheet(sheetDef, ctx, sponsor);
        ws.addRow(headers.map((h) => row[h] ?? ""));
      }
    } else if (sheetDef.name === "09_Assets") {
      const assetRows = ctx.assets ?? buildAssetRows(ctx);
      for (const asset of assetRows) {
        ws.addRow(headers.map((h) => asset[h] ?? ""));
      }
    } else if (["06_Auction_Settings", "07_Match_Settings", "08_Organizers"].includes(sheetDef.name)) {
      const row = buildRowForSheet(sheetDef, ctx);
      ws.addRow(headers.map((h) => row[h] ?? ""));
    }

    applySheetStyling(ws, sheetDef);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** @deprecated Use buildTournamentWorkbookExcel */
export const buildTmwWorkbookExcel = buildTournamentWorkbookExcel;
