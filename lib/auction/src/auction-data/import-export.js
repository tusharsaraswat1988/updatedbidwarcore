import { AUCTION_EDITABLE_FIELDS, AUCTION_LOCKED_COLUMNS, buildLabelToFieldMap, buildLockedLabelMap, formatFieldForExport, getExportColumnHeaders, normalizeBooleanInput, normalizeStatusInput, normalizeTagInput, } from "./field-registry";
export function buildAuctionExportRow(player, profile, ctx) {
    const row = {};
    for (const locked of AUCTION_LOCKED_COLUMNS) {
        if (locked.key === "playerId")
            row[locked.label] = player.id;
        else if (locked.key === "tournamentId")
            row[locked.label] = player.tournamentId;
        else if (locked.key === "tournamentPlayerId")
            row[locked.label] = profile?.id ?? "";
    }
    for (const field of AUCTION_EDITABLE_FIELDS) {
        const source = field.source === "player" ? player : profile;
        const raw = source ? source[field.column] : undefined;
        row[field.label] = formatFieldForExport(field, raw, ctx);
    }
    return row;
}
export function buildAuctionExportRows(players, profileByMasterId, ctx) {
    return players.map((player) => {
        const profile = player.globalPlayerId
            ? profileByMasterId.get(player.globalPlayerId) ?? null
            : null;
        return buildAuctionExportRow(player, profile, ctx);
    });
}
export function auctionExportRowsToSheetValues(rows) {
    const headers = getExportColumnHeaders();
    if (rows.length === 0)
        return [headers];
    return [
        headers,
        ...rows.map((row) => headers.map((h) => {
            const v = row[h];
            return v == null || v === "" ? "" : String(v);
        })),
    ];
}
function parseNumeric(value) {
    if (value == null || value === "")
        return null;
    const n = typeof value === "number" ? value : parseInt(String(value).replace(/,/g, ""), 10);
    return Number.isFinite(n) ? n : null;
}
function resolveRefByName(value, nameMap) {
    if (value == null || value === "")
        return null;
    const s = String(value).trim();
    const byName = nameMap.get(s.toLowerCase());
    if (byName != null)
        return byName;
    const asNum = parseInt(s, 10);
    return Number.isFinite(asNum) ? asNum : null;
}
export function parseExcelRowToUpdates(row, rowNumber, ctx) {
    const issues = [];
    const labelToField = buildLabelToFieldMap();
    const lockedMap = buildLockedLabelMap();
    let playerId = null;
    let tournamentPlayerId = null;
    let tournamentId = null;
    for (const [header, value] of Object.entries(row)) {
        const locked = lockedMap.get(header.trim().toLowerCase());
        if (!locked)
            continue;
        const num = parseNumeric(value);
        if (locked.key === "playerId")
            playerId = num;
        else if (locked.key === "tournamentPlayerId")
            tournamentPlayerId = num;
        else if (locked.key === "tournamentId")
            tournamentId = num;
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
    const updates = [];
    let proposedAuctionOrder = null;
    for (const [header, rawValue] of Object.entries(row)) {
        if (rawValue == null || rawValue === "")
            continue;
        const field = labelToField.get(header.trim().toLowerCase());
        if (!field)
            continue;
        let parsedValue = rawValue;
        let error = null;
        switch (field.type) {
            case "number": {
                parsedValue = parseNumeric(rawValue);
                if (parsedValue == null) {
                    error = `${field.label} must be numeric`;
                    break;
                }
                if (field.key === "baseValue") {
                    if (parsedValue <= 0) {
                        error = `${field.label} must be greater than 0`;
                    }
                    else if (ctx.bidValueMode === "player" && ctx.bidValueOptions.length > 0) {
                        if (!ctx.bidValueOptions.includes(parsedValue)) {
                            error = `${field.label} must be one of: ${ctx.bidValueOptions.join(", ")}`;
                        }
                    }
                    else if (parsedValue < ctx.minBid) {
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
                    proposedAuctionOrder = parsedValue;
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
                }
                else {
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
        }
        else {
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
        }
        else {
            // Reserve this order for batch validation (supports swaps within same import)
            const previousOrder = [...ctx.usedAuctionOrders.entries()].find(([, pid]) => pid === playerId)?.[0];
            if (previousOrder != null)
                ctx.usedAuctionOrders.delete(previousOrder);
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
export function validateImportRows(rows, ctx) {
    const allIssues = [];
    const parsedRows = [];
    const changedFields = new Set();
    for (let i = 0; i < rows.length; i++) {
        const { parsed, issues } = parseExcelRowToUpdates(rows[i], i + 2, ctx);
        allIssues.push(...issues);
        const rowErrors = issues.filter((x) => x.severity === "error");
        if (parsed && parsed.updates.length > 0 && rowErrors.length === 0) {
            parsedRows.push(parsed);
            for (const u of parsed.updates)
                changedFields.add(u.field.label);
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
