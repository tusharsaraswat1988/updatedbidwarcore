import {
  AUCTION_EDITABLE_FIELDS,
  AUCTION_LOCKED_COLUMNS,
  buildLabelToFieldMap,
  buildLockedLabelMap,
  formatFieldForExport,
  getExportColumnHeaders,
  normalizeBooleanInput,
  normalizeStatusInput,
  normalizeTagInput,
  type AuctionFieldDefinition,
} from "./field-registry";

export type AuctionExportRow = Record<string, string | number>;

export interface AuctionPlayerRecord {
  id: number;
  tournamentId: number;
  categoryId?: number | null;
  teamId?: number | null;
  basePrice?: number | null;
  serialNo?: number | null;
  status?: string | null;
  soldPrice?: number | null;
  retainedPrice?: number | null;
  playerTag?: string | null;
  isNonPlayingMember?: boolean | null;
  role?: string | null;
  specialization?: string | null;
  globalPlayerId?: string | null;
}

export interface TournamentProfileRecord {
  id?: number | null;
  tournamentId?: number;
  masterPlayerId?: string;
  subCategory?: string | null;
  auctionBatch?: string | null;
  seedRank?: number | null;
  rating?: number | null;
  priority?: number | null;
  remarks?: string | null;
  isWildcard?: boolean | null;
  category?: string | null;
}

export interface AuctionExportContext {
  categoryMap: Record<number, string>;
  teamMap: Record<number, string>;
}

export function buildAuctionExportRow(
  player: AuctionPlayerRecord,
  profile: TournamentProfileRecord | null,
  ctx: AuctionExportContext,
): AuctionExportRow {
  const row: AuctionExportRow = {};

  for (const locked of AUCTION_LOCKED_COLUMNS) {
    if (locked.key === "playerId") row[locked.label] = player.id;
    else if (locked.key === "tournamentId") row[locked.label] = player.tournamentId;
    else if (locked.key === "tournamentPlayerId") row[locked.label] = profile?.id ?? "";
  }

  for (const field of AUCTION_EDITABLE_FIELDS) {
    const source = field.source === "player" ? player : profile;
    const raw = source ? (source as Record<string, unknown>)[field.column] : undefined;
    row[field.label] = formatFieldForExport(field, raw, ctx);
  }

  return row;
}

export function buildAuctionExportRows(
  players: AuctionPlayerRecord[],
  profileByMasterId: Map<string, TournamentProfileRecord>,
  ctx: AuctionExportContext,
): AuctionExportRow[] {
  return players.map((player) => {
    const profile = player.globalPlayerId
      ? profileByMasterId.get(player.globalPlayerId) ?? null
      : null;
    return buildAuctionExportRow(player, profile, ctx);
  });
}

export function auctionExportRowsToSheetValues(rows: AuctionExportRow[]): string[][] {
  const headers = getExportColumnHeaders();
  if (rows.length === 0) return [headers];

  return [
    headers,
    ...rows.map((row) =>
      headers.map((h) => {
        const v = row[h];
        return v == null || v === "" ? "" : String(v);
      }),
    ),
  ];
}

export type ImportRowIssue = {
  row: number;
  column?: string;
  playerId?: number;
  severity: "error" | "warning";
  message: string;
};

export type ParsedImportRow = {
  rowNumber: number;
  playerId: number;
  tournamentPlayerId: number | null;
  tournamentId: number;
  updates: Array<{
    field: AuctionFieldDefinition;
    rawValue: unknown;
    parsedValue: unknown;
  }>;
};

export type ImportValidationContext = {
  tournamentId: number;
  minBid: number;
  bidValueMode: string;
  bidValueOptions: number[];
  categoryNames: Map<string, number>;
  teamNames: Map<string, number>;
  existingPlayerIds: Set<number>;
  playerTournamentMap: Map<number, number>;
  profileIdToPlayerId: Map<number, number>;
  usedAuctionOrders: Map<number, number>;
  duplicateRowKeys: Set<string>;
};

export type ImportValidationResult = {
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
};

function parseNumeric(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseInt(String(value).replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function resolveRefByName(
  value: unknown,
  nameMap: Map<string, number>,
): number | null {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  const byName = nameMap.get(s.toLowerCase());
  if (byName != null) return byName;
  const asNum = parseInt(s, 10);
  return Number.isFinite(asNum) ? asNum : null;
}

export function parseExcelRowToUpdates(
  row: Record<string, unknown>,
  rowNumber: number,
  ctx: ImportValidationContext,
): { parsed: ParsedImportRow | null; issues: ImportRowIssue[] } {
  const issues: ImportRowIssue[] = [];
  const labelToField = buildLabelToFieldMap();
  const lockedMap = buildLockedLabelMap();

  let playerId: number | null = null;
  let tournamentPlayerId: number | null = null;
  let tournamentId: number | null = null;

  for (const [header, value] of Object.entries(row)) {
    const locked = lockedMap.get(header.trim().toLowerCase());
    if (!locked) continue;
    const num = parseNumeric(value);
    if (locked.key === "playerId") playerId = num;
    else if (locked.key === "tournamentPlayerId") tournamentPlayerId = num;
    else if (locked.key === "tournamentId") tournamentId = num;
  }

  if (playerId == null) {
    issues.push({ row: rowNumber, severity: "error", message: "Missing or invalid Player ID" });
    return { parsed: null, issues };
  }

  if (tournamentId != null && tournamentId !== ctx.tournamentId) {
    issues.push({
      row: rowNumber,
      playerId,
      severity: "error",
      message: `Tournament ID ${tournamentId} does not match target tournament ${ctx.tournamentId}`,
    });
    return { parsed: null, issues };
  }

  if (!ctx.existingPlayerIds.has(playerId)) {
    issues.push({
      row: rowNumber,
      playerId,
      severity: "error",
      message: `Player ID ${playerId} not found in tournament`,
    });
    return { parsed: null, issues };
  }

  const playerTournament = ctx.playerTournamentMap.get(playerId);
  if (playerTournament !== ctx.tournamentId) {
    issues.push({
      row: rowNumber,
      playerId,
      severity: "error",
      message: `Player ID ${playerId} belongs to a different tournament`,
    });
    return { parsed: null, issues };
  }

  if (tournamentPlayerId != null) {
    const mappedPlayer = ctx.profileIdToPlayerId.get(tournamentPlayerId);
    if (mappedPlayer != null && mappedPlayer !== playerId) {
      issues.push({
        row: rowNumber,
        playerId,
        severity: "error",
        message: `Tournament Player ID ${tournamentPlayerId} does not match Player ID ${playerId}`,
      });
      return { parsed: null, issues };
    }
  }

  const rowKey = String(playerId);
  if (ctx.duplicateRowKeys.has(rowKey)) {
    issues.push({
      row: rowNumber,
      playerId,
      severity: "error",
      message: `Duplicate row for Player ID ${playerId}`,
    });
    return { parsed: null, issues };
  }
  ctx.duplicateRowKeys.add(rowKey);

  const updates: ParsedImportRow["updates"] = [];
  let proposedAuctionOrder: number | null = null;

  for (const [header, rawValue] of Object.entries(row)) {
    if (rawValue == null || rawValue === "") continue;
    const field = labelToField.get(header.trim().toLowerCase());
    if (!field) continue;

    let parsedValue: unknown = rawValue;
    let error: string | null = null;

    switch (field.type) {
      case "number": {
        parsedValue = parseNumeric(rawValue);
        if (parsedValue == null) {
          error = `${field.label} must be numeric`;
          break;
        }
        if (field.key === "baseValue") {
          if ((parsedValue as number) <= 0) {
            error = `${field.label} must be greater than 0`;
          } else if (ctx.bidValueMode === "player" && ctx.bidValueOptions.length > 0) {
            if (!ctx.bidValueOptions.includes(parsedValue as number)) {
              error = `${field.label} must be one of: ${ctx.bidValueOptions.join(", ")}`;
            }
          } else if ((parsedValue as number) < ctx.minBid) {
            issues.push({
              row: rowNumber,
              column: field.label,
              playerId,
              severity: "warning",
              message: `${field.label} ${parsedValue} is below tournament minimum ${ctx.minBid}`,
            });
          }
        }
        if (field.key === "auctionOrder") {
          proposedAuctionOrder = parsedValue as number;
        }
        break;
      }
      case "category_ref": {
        parsedValue = resolveRefByName(rawValue, ctx.categoryNames);
        if (parsedValue == null) {
          error = `${field.label} "${rawValue}" does not exist`;
        }
        break;
      }
      case "team_ref": {
        parsedValue = resolveRefByName(rawValue, ctx.teamNames);
        if (parsedValue == null) {
          error = `${field.label} "${rawValue}" does not exist`;
        }
        break;
      }
      case "boolean": {
        parsedValue = normalizeBooleanInput(rawValue);
        if (parsedValue == null) {
          error = `${field.label} must be Yes/No`;
        }
        break;
      }
      case "enum": {
        if (field.key === "status" || field.column === "status") {
          parsedValue = normalizeStatusInput(rawValue);
        } else {
          parsedValue = normalizeTagInput(rawValue);
        }
        if (parsedValue == null) {
          error = `${field.label} has invalid value "${rawValue}"`;
        }
        break;
      }
      default:
        parsedValue = String(rawValue).trim();
    }

    if (error) {
      issues.push({
        row: rowNumber,
        column: field.label,
        playerId,
        severity: "error",
        message: error,
      });
    } else {
      updates.push({ field, rawValue, parsedValue });
    }
  }

  if (proposedAuctionOrder != null) {
    const existingRow = ctx.usedAuctionOrders.get(proposedAuctionOrder);
    if (existingRow != null && existingRow !== playerId) {
      issues.push({
        row: rowNumber,
        column: "Auction Order",
        playerId,
        severity: "error",
        message: `Auction Order ${proposedAuctionOrder} is already assigned to Player ID ${existingRow}`,
      });
    } else {
      // Reserve this order for batch validation (supports swaps within same import)
      const previousOrder = [...ctx.usedAuctionOrders.entries()].find(([, pid]) => pid === playerId)?.[0];
      if (previousOrder != null) ctx.usedAuctionOrders.delete(previousOrder);
      ctx.usedAuctionOrders.set(proposedAuctionOrder, playerId);
    }
  }

  if (updates.length === 0) {
    issues.push({
      row: rowNumber,
      playerId,
      severity: "warning",
      message: "No editable auction fields to update",
    });
  }

  return {
    parsed: {
      rowNumber,
      playerId,
      tournamentPlayerId,
      tournamentId: ctx.tournamentId,
      updates,
    },
    issues,
  };
}

export function validateImportRows(
  rows: Record<string, unknown>[],
  ctx: ImportValidationContext,
): ImportValidationResult {
  const allIssues: ImportRowIssue[] = [];
  const parsedRows: ParsedImportRow[] = [];
  const changedFields = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const { parsed, issues } = parseExcelRowToUpdates(rows[i]!, i + 2, ctx);
    allIssues.push(...issues);
    const rowErrors = issues.filter((x) => x.severity === "error");
    if (parsed && parsed.updates.length > 0 && rowErrors.length === 0) {
      parsedRows.push(parsed);
      for (const u of parsed.updates) changedFields.add(u.field.label);
    }
  }

  const errors = allIssues.filter((x) => x.severity === "error").length;
  const warnings = allIssues.filter((x) => x.severity === "warning").length;
  const rowsSkipped = rows.length - parsedRows.length;

  return {
    valid: errors === 0 && parsedRows.length > 0,
    rows: parsedRows,
    issues: allIssues,
    summary: {
      playersFound: new Set(parsedRows.map((r) => r.playerId)).size,
      rowsToUpdate: parsedRows.length,
      rowsSkipped,
      errors,
      warnings,
      changedFields: [...changedFields],
    },
  };
}

export { getExportColumnHeaders, buildLabelToFieldMap };
