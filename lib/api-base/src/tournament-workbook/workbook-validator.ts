import type {
  WorkbookValidationResult,
  WorkbookImportMode,
  WorkbookIssue,
  ParsedWorkbook,
} from "./types";
import {
  buildRegistrationCode,
  buildFieldLabelMap,
  getRegistrationCodeFromRow,
} from "./sheet-definitions";
import {
  resolvePlayerIdentity,
  detectDuplicateIdentities,
  detectDuplicateMobiles,
  findPlayersMissingFromWorkbook,
  type ExistingPlayerRecord,
} from "./identity-resolver";
import {
  normalizeBooleanInput,
  normalizeStatusInput,
} from "../auction-data/field-registry";
import { getWorkbookSport } from "./workbook-parser";
import { isValidRoleForSport, getRoleLabelsForSport, normalizeSportId } from "./sport-registry";
import { computeHealthScore } from "./health-score";
import { buildFieldDiffs, getActionableDiffs } from "./field-diff";
import { generateImportSuggestions } from "./ai-suggestions";
import { parseWorkbookGenderLabel } from "../player-gender";
import {
  BMW_CATEGORY_NAME_HEADER,
  BMW_CATEGORY_SHEET,
  BMW_TEAM_NAME_HEADER,
  BMW_TEAM_SHEET,
} from "./sheet-definitions";

export type ValidationContext = {
  tournamentId: number;
  auctionCode?: string | null;
  minBid: number;
  bidValueMode: string;
  bidValueOptions: number[];
  categoryNames: Map<string, number>;
  teamNames: Map<string, number>;
  existingPlayers: ExistingPlayerRecord[];
  existingPlayerFields?: Map<number, Record<string, unknown>>;
  mode: WorkbookImportMode;
  sport?: string;
};

function parseNumeric(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseInt(String(value).replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function resolveRef(value: unknown, nameMap: Map<string, number>): number | null {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  const byName = nameMap.get(s.toLowerCase());
  if (byName != null) return byName;
  const asNum = parseInt(s, 10);
  return Number.isFinite(asNum) ? asNum : null;
}

/** Include categories/teams defined in the workbook so new rows validate before DB commit. */
function mergeWorkbookRefNames(
  workbook: ParsedWorkbook,
  ctx: ValidationContext,
): ValidationContext {
  const categoryNames = new Map(ctx.categoryNames);
  let syntheticId = -1;
  for (const row of workbook.sheets[BMW_CATEGORY_SHEET] ?? []) {
    const name = String(row[BMW_CATEGORY_NAME_HEADER] ?? "").trim();
    if (name && !categoryNames.has(name.toLowerCase())) {
      categoryNames.set(name.toLowerCase(), syntheticId--);
    }
  }
  const teamNames = new Map(ctx.teamNames);
  for (const row of workbook.sheets[BMW_TEAM_SHEET] ?? []) {
    const name = String(row[BMW_TEAM_NAME_HEADER] ?? "").trim();
    if (name && !teamNames.has(name.toLowerCase())) {
      teamNames.set(name.toLowerCase(), syntheticId--);
    }
  }
  return { ...ctx, categoryNames, teamNames };
}


function validatePlayersSheet(
  workbook: ParsedWorkbook,
  ctx: ValidationContext,
  issues: WorkbookIssue[],
  changedFields: Set<string>,
  counters: { addCreate: () => void; addUpdate: () => void },
): void {
  const playerRows = workbook.sheets["03_Players"] ?? [];
  if (playerRows.length === 0) return;

  const sport = ctx.sport ?? getWorkbookSport(workbook);
  const validRoles = new Set(getRoleLabelsForSport(sport).map((r) => r.toLowerCase()));

  const dupes = detectDuplicateIdentities(playerRows, ctx.auctionCode);
  for (const d of dupes) {
    issues.push({ sheet: "03_Players", row: d.row, severity: "error", message: d.message, code: "DUPLICATE_IDENTITY" });
  }

  for (const d of detectDuplicateMobiles(playerRows)) {
    issues.push({ sheet: "03_Players", row: d.row, severity: "error", message: d.message, code: "DUPLICATE_MOBILE" });
  }

  const fieldMap = buildFieldLabelMap("03_Players");
  const seenRegCodes = new Set<string>();
  const seenAuctionOrders = new Map<number, number>();

  for (let i = 0; i < playerRows.length; i++) {
    const row = playerRows[i]!;
    const rowNum = i + 2;
    const name = String(row["Player Name"] ?? "").trim();
    if (!name) {
      issues.push({ sheet: "03_Players", row: rowNum, severity: "error", message: "Player Name is required", code: "REQUIRED_FIELD" });
      continue;
    }

    const identity = resolvePlayerIdentity(row, ctx.existingPlayers, ctx.auctionCode);
    const regCode = getRegistrationCodeFromRow(row) || buildRegistrationCode(String(row["Mobile"]), name, ctx.auctionCode);

    if (seenRegCodes.has(regCode)) {
      issues.push({ sheet: "03_Players", row: rowNum, identity: regCode, severity: "error", message: "Duplicate Registration Code in workbook", code: "DUPLICATE_REGISTRATION" });
      continue;
    }
    seenRegCodes.add(regCode);

    if (identity.isNew) counters.addCreate();
    else counters.addUpdate();

    const role = String(row["Role"] ?? "").trim();
    if (role && !isValidRoleForSport(sport, role) && !validRoles.has(role.toLowerCase())) {
      issues.push({
        sheet: "03_Players",
        row: rowNum,
        column: "Role",
        identity: regCode,
        severity: "error",
        message: `Invalid role "${role}" for sport ${normalizeSportId(sport)}. Valid: ${getRoleLabelsForSport(sport).join(", ")}`,
        code: "INVALID_ROLE",
      });
    }

    const auctionOrder = parseNumeric(row["Auction Order"]);
    if (auctionOrder != null) {
      const prev = seenAuctionOrders.get(auctionOrder);
      if (prev != null) {
        issues.push({
          sheet: "03_Players",
          row: rowNum,
          column: "Auction Order",
          severity: "error",
          message: `Duplicate Auction Order ${auctionOrder} (also on row ${prev})`,
          code: "DUPLICATE_AUCTION_ORDER",
        });
      } else {
        seenAuctionOrders.set(auctionOrder, rowNum);
      }
    }

    const teamName = String(row["Current Team"] ?? "").trim();
    if (teamName && resolveRef(teamName, ctx.teamNames) == null) {
      issues.push({
        sheet: "03_Players",
        row: rowNum,
        column: "Current Team",
        identity: regCode,
        severity: "error",
        message: `Team "${teamName}" not found`,
        code: "UNKNOWN_TEAM",
      });
    }

    for (const [header, rawValue] of Object.entries(row)) {
      if (rawValue == null || rawValue === "") continue;
      const field = fieldMap.get(header.trim().toLowerCase());
      if (!field || field.editability === "auto" || field.editability === "readonly") continue;

      let error: string | null = null;
      switch (field.type) {
        case "number": {
          const n = parseNumeric(rawValue);
          if (n == null) error = `${field.label} must be numeric`;
          else if (field.key === "baseValue" && n <= 0) error = `${field.label} must be > 0`;
          else if (field.key === "baseValue" && ctx.bidValueOptions.length > 0 && !ctx.bidValueOptions.includes(n)) {
            error = `${field.label} must be one of: ${ctx.bidValueOptions.join(", ")}`;
          } else if (field.key === "baseValue" && n < ctx.minBid) {
            issues.push({ sheet: "03_Players", row: rowNum, column: field.label, severity: "warning", message: `${field.label} below tournament minimum ${ctx.minBid}`, code: "BUDGET_WARNING" });
          }
          break;
        }
        case "category_ref": {
          if (resolveRef(rawValue, ctx.categoryNames) == null) {
            error = `Category "${rawValue}" not found`;
          }
          break;
        }
        case "team_ref": {
          if (resolveRef(rawValue, ctx.teamNames) == null) error = `Team "${rawValue}" not found`;
          break;
        }
        case "boolean": {
          if (normalizeBooleanInput(rawValue) == null) error = `${field.label} must be Yes/No`;
          break;
        }
        case "enum": {
          if (field.key === "status" && normalizeStatusInput(rawValue) == null) {
            error = `Invalid status "${rawValue}"`;
          } else if (field.key === "gender" && parseWorkbookGenderLabel(rawValue) === undefined) {
            error = `Invalid gender "${rawValue}". Use Male, Female, or Not specified.`;
          }
          break;
        }
        case "photo_url":
        case "url": {
          const url = String(rawValue).trim();
          if (url && !/^https?:\/\//i.test(url) && !url.includes("drive.google.com") && !url.startsWith("local://")) {
            issues.push({ sheet: "03_Players", row: rowNum, column: field.label, severity: "warning", message: `${field.label} may not be a valid URL`, code: "BROKEN_URL" });
          }
          if (field.key === "photoUrl" && !url) {
            issues.push({ sheet: "03_Players", row: rowNum, column: field.label, identity: regCode, severity: "warning", message: "Missing player photo", code: "MISSING_PHOTO" });
          }
          break;
        }
      }

      if (error) {
        issues.push({ sheet: "03_Players", row: rowNum, column: field.label, identity: regCode, severity: "error", message: error });
      } else {
        changedFields.add(field.label);
      }
    }
  }

}

function validateCategoriesSheet(
  workbook: ParsedWorkbook,
  issues: WorkbookIssue[],
  changedFields: Set<string>,
  counters: { add: () => void },
): void {
  const categoryRows = workbook.sheets["02_Categories"] ?? [];
  const names = new Set<string>();

  for (let i = 0; i < categoryRows.length; i++) {
    const name = String(categoryRows[i]?.["Category Name"] ?? "").trim();
    if (!name) {
      issues.push({ sheet: "02_Categories", row: i + 2, severity: "error", message: "Category Name is required", code: "REQUIRED_FIELD" });
    } else {
      if (names.has(name.toLowerCase())) {
        issues.push({ sheet: "02_Categories", row: i + 2, severity: "error", message: `Duplicate category "${name}"`, code: "DUPLICATE_CATEGORY" });
      }
      names.add(name.toLowerCase());
      counters.add();
      changedFields.add("Category Name");
    }
  }
}

function validateTeamsSheet(
  workbook: ParsedWorkbook,
  issues: WorkbookIssue[],
  counters: { add: () => void },
): Set<string> {
  const teamRows = workbook.sheets["04_Teams"] ?? [];
  const teamNames = new Set<string>();

  for (let i = 0; i < teamRows.length; i++) {
    const name = String(teamRows[i]?.["Team Name"] ?? "").trim();
    if (!name) {
      issues.push({ sheet: "04_Teams", row: i + 2, severity: "error", message: "Team Name is required", code: "REQUIRED_FIELD" });
    } else {
      teamNames.add(name.toLowerCase());
      counters.add();
    }
  }

  if (teamRows.length === 0) {
    issues.push({ sheet: "04_Teams", row: 0, severity: "warning", message: "No teams defined in workbook", code: "EMPTY_TEAMS" });
  }

  return teamNames;
}

function validateSponsorsSheet(
  workbook: ParsedWorkbook,
  issues: WorkbookIssue[],
): void {
  const sponsorRows = workbook.sheets["05_Sponsors"] ?? [];
  for (let i = 0; i < sponsorRows.length; i++) {
    const name = String(sponsorRows[i]?.["Sponsor Name"] ?? "").trim();
    if (!name) {
      issues.push({ sheet: "05_Sponsors", row: i + 2, severity: "error", message: "Sponsor Name is required", code: "REQUIRED_FIELD" });
    }
    const logoUrl = String(sponsorRows[i]?.["Logo URL"] ?? "").trim();
    if (logoUrl && !/^https?:\/\//i.test(logoUrl) && !logoUrl.includes("drive.google.com")) {
      issues.push({ sheet: "05_Sponsors", row: i + 2, column: "Logo URL", severity: "warning", message: "Sponsor logo URL may not be accessible", code: "BROKEN_URL" });
    }
  }
}

function validateAssetsSheet(workbook: ParsedWorkbook, issues: WorkbookIssue[]): void {
  const assetRows = workbook.sheets["09_Assets"] ?? [];
  for (let i = 0; i < assetRows.length; i++) {
    const row = assetRows[i]!;
    const entityType = String(row["Entity Type"] ?? "").trim();
    const entityName = String(row["Entity Name"] ?? "").trim();
    const url = String(row["URL"] ?? "").trim();

    if (!entityType || !entityName) {
      issues.push({ sheet: "09_Assets", row: i + 2, severity: "warning", message: "Asset row missing Entity Type or Entity Name", code: "INCOMPLETE_ASSET" });
    }
    if (url && !/^https?:\/\//i.test(url) && !url.startsWith("local://") && !url.includes("drive.google.com")) {
      issues.push({ sheet: "09_Assets", row: i + 2, column: "URL", severity: "warning", message: `Asset URL may not be accessible for ${entityName}`, code: "BROKEN_URL" });
    }
  }
}

function buildPlayerDiffs(
  workbook: ParsedWorkbook,
  ctx: ValidationContext,
): import("./field-diff.ts").FieldDiff[] {
  const playerRows = workbook.sheets["03_Players"] ?? [];
  const currentRecords: Parameters<typeof buildFieldDiffs>[0] = [];
  const stagedRecords: Parameters<typeof buildFieldDiffs>[1] = [];

  for (const existing of ctx.existingPlayers) {
    const fields = ctx.existingPlayerFields?.get(existing.id) ?? {
      "Player Name": existing.name,
      Mobile: existing.mobileNumber,
      Email: existing.email,
    };
    currentRecords.push({
      sheet: "03_Players",
      row: 0,
      identity: existing.registrationCode ?? buildRegistrationCode(existing.mobileNumber, existing.name, ctx.auctionCode),
      entityType: "player",
      entityId: String(existing.id),
      fields,
    });
  }

  for (let i = 0; i < playerRows.length; i++) {
    const row = playerRows[i]!;
    const identity = resolvePlayerIdentity(row, ctx.existingPlayers, ctx.auctionCode);
    stagedRecords.push({
      sheet: "03_Players",
      row: i + 2,
      identity: getRegistrationCodeFromRow(row) || buildRegistrationCode(String(row["Mobile"]), String(row["Player Name"]), ctx.auctionCode),
      entityType: "player",
      entityId: identity.playerId ? String(identity.playerId) : undefined,
      fields: row,
      isNew: identity.isNew,
    });
  }

  return getActionableDiffs(buildFieldDiffs(currentRecords, stagedRecords));
}

export function validateWorkbook(
  workbook: ParsedWorkbook,
  ctx: ValidationContext,
): WorkbookValidationResult {
  let creates = 0;
  let updates = 0;
  const issues: WorkbookIssue[] = [];
  let skips = 0;
  const changedFields = new Set<string>();
  const sheetsProcessed: string[] = [];
  const dryRun = ctx.mode === "dry_run";
  const sport = ctx.sport ?? getWorkbookSport(workbook);
  const enrichedCtx = mergeWorkbookRefNames(workbook, ctx);

  const playerRows = workbook.sheets["03_Players"] ?? [];
  if (playerRows.length > 0) sheetsProcessed.push("03_Players");
  validatePlayersSheet(workbook, { ...enrichedCtx, sport }, issues, changedFields, {
    addCreate: () => { creates++; },
    addUpdate: () => { updates++; },
  });

  const categoryRows = workbook.sheets["02_Categories"] ?? [];
  if (categoryRows.length > 0) {
    sheetsProcessed.push("02_Categories");
    validateCategoriesSheet(workbook, issues, changedFields, { add: () => { creates++; } });
  }

  const teamRows = workbook.sheets["04_Teams"] ?? [];
  if (teamRows.length > 0) {
    sheetsProcessed.push("04_Teams");
    validateTeamsSheet(workbook, issues, { add: () => { creates++; } });
  }

  const sponsorRows = workbook.sheets["05_Sponsors"] ?? [];
  if (sponsorRows.length > 0) {
    sheetsProcessed.push("05_Sponsors");
    validateSponsorsSheet(workbook, issues);
  }

  const assetRows = workbook.sheets["09_Assets"] ?? [];
  if (assetRows.length > 0) {
    sheetsProcessed.push("09_Assets");
    validateAssetsSheet(workbook, issues);
  }

  for (const sheetName of ["01_Tournament", "06_Auction_Settings", "07_Match_Settings", "08_Organizers"] as const) {
    if ((workbook.sheets[sheetName]?.length ?? 0) > 0) sheetsProcessed.push(sheetName);
  }

  const aiSuggestions = generateImportSuggestions(workbook.sheets);
  for (const s of aiSuggestions.filter((x) => !x.autoApply)) {
    issues.push({
      sheet: s.sheet,
      row: s.row,
      column: s.field,
      severity: "suggestion",
      message: `Suggest "${s.suggestedValue}" instead of "${s.originalValue}" (${s.reason})`,
      code: "AI_SUGGESTION",
    });
  }

  const errors = issues.filter((x) => x.severity === "error").length;
  let warnings = issues.filter((x) => x.severity === "warning").length;
  const suggestions = issues.filter((x) => x.severity === "suggestion").length;
  const rowsTotal = Object.values(workbook.sheets).reduce((sum, r) => sum + r.length, 0);

  let deletes = 0;
  const playerRemovalDiffs: import("./field-diff.ts").FieldDiff[] = [];

  if (ctx.mode === "replace_data" && playerRows.length > 0) {
    const missingPlayers = findPlayersMissingFromWorkbook(playerRows, ctx.existingPlayers, ctx.auctionCode);
    deletes = missingPlayers.length;

    for (const player of missingPlayers) {
      const identity =
        player.registrationCode
        ?? buildRegistrationCode(player.mobileNumber, player.name, ctx.auctionCode);
      playerRemovalDiffs.push({
        sheet: "03_Players",
        row: 0,
        field: "Player",
        identity,
        entityType: "player",
        entityId: String(player.id),
        oldValue: player.name,
        newValue: null,
        changeType: "delete",
      });
    }

    if (missingPlayers.length > 0) {
      if (missingPlayers.length <= 20) {
        for (const player of missingPlayers) {
          issues.push({
            sheet: "03_Players",
            row: 0,
            identity: player.name,
            severity: "warning",
            message: `Player "${player.name}" will be removed from the tournament (not listed in workbook).`,
            code: "PLAYER_WILL_BE_DELETED",
          });
          warnings++;
        }
      } else {
        issues.push({
          sheet: "03_Players",
          row: 0,
          severity: "warning",
          message: `${missingPlayers.length} players will be removed from the tournament (not listed in workbook).`,
          code: "PLAYERS_WILL_BE_DELETED",
        });
        warnings++;
      }
    }
  }

  const summary = {
    rowsTotal,
    creates,
    updates,
    skips,
    deletes,
    errors,
    warnings,
    suggestions,
    changedFields: [...changedFields],
    sheetsProcessed,
  };

  const health = computeHealthScore(issues, summary, aiSuggestions.map((s) => s.reason));
  const diffs = [...buildPlayerDiffs(workbook, ctx), ...playerRemovalDiffs];

  return {
    valid: errors === 0 && rowsTotal > 0,
    mode: ctx.mode,
    dryRun,
    issues,
    summary,
    staged: { workbook, playerIdentities: playerRows.length, sport },
    health,
    diffs,
    aiSuggestions,
    manifest: workbook.manifest ?? null,
  };
}

export function buildValidationReportCsv(issues: WorkbookIssue[]): string {
  const headers = ["Sheet", "Row", "Column", "Identity", "Severity", "Code", "Message"];
  const lines = [headers.join(",")];
  for (const issue of issues) {
    lines.push(
      [
        issue.sheet,
        issue.row,
        issue.column ?? "",
        issue.identity ?? "",
        issue.severity,
        issue.code ?? "",
        `"${issue.message.replace(/"/g, '""')}"`,
      ].join(","),
    );
  }
  return lines.join("\n");
}
