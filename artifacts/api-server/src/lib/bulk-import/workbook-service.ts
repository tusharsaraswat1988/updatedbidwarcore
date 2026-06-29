/**
 * BidWar Master Workbook (BMW) — universal import/export service.
 * Single engine for all tournament data exchange operations.
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  tournamentsTable,
  categoriesTable,
  teamsTable,
  playersTable,
  tournamentPlayerProfilesTable,
  bulkImportJobsTable,
  workbookVersionsTable,
} from "@workspace/db";
import {
  parseWorkbookFromRaw,
  validateWorkbook,
  buildValidationReportCsv,
  bmwPlayerRowToLegacyAuctionRow,
  buildFieldLabelMap,
  resolvePlayerIdentity,
  getWorkbookSport,
  type ParsedWorkbook,
  type WorkbookImportMode,
  type WorkbookValidationResult,
} from "@workspace/api-base/tournament-workbook";
import { normalizeBooleanInput } from "@workspace/api-base/auction-data";
import { getOrganizerBidOptions } from "@workspace/api-base/bid-value";
import type { SponsorLogo } from "@workspace/api-base/sponsor-priority";
import { buildTournamentWorkbookExcel } from "./workbook-excel-builder.ts";
import {
  parseExcelBufferToRawWorkbook,
  readWorkbookFromGoogleSheetUrl,
} from "./google-sheet-workbook-reader.ts";
import { importPhotosFromRows, isPhotoUrl } from "./photo-import-service.ts";
import {
  commitAuctionImport,
  validateAuctionImport,
  parseExcelBuffer as parseLegacyExcelBuffer,
} from "./auction-data-service.ts";
import { parseWorkbookFromZip, applyLocalMediaToPlayers, cleanupZipExtract } from "./zip-import-service.ts";
import { importAssetsFromWorkbook, applyAssetResultsToWorkbook } from "./asset-import-service.ts";
import { writeEntityAuditLogs } from "./entity-audit-service.ts";

export async function loadTournamentExportContext(tournamentId: number) {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  if (!tournament) throw new Error("Tournament not found");

  const [categories, teams, playerRows, profileRows] = await Promise.all([
    db.select().from(categoriesTable).where(eq(categoriesTable.tournamentId, tournamentId)),
    db.select().from(teamsTable).where(eq(teamsTable.tournamentId, tournamentId)),
    db.select().from(playersTable).where(eq(playersTable.tournamentId, tournamentId)),
    db.select().from(tournamentPlayerProfilesTable).where(eq(tournamentPlayerProfilesTable.tournamentId, tournamentId)),
  ]);

  let sponsors: Record<string, unknown>[] = [];
  try {
    sponsors = tournament.sponsorLogos ? JSON.parse(tournament.sponsorLogos) as Record<string, unknown>[] : [];
  } catch {
    sponsors = [];
  }

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  const profiles = new Map(profileRows.map((p) => [p.masterPlayerId, p as Record<string, unknown>]));

  return {
    tournament: tournament as Record<string, unknown>,
    categories: categories as Record<string, unknown>[],
    teams: teams as Record<string, unknown>[],
    players: playerRows as Record<string, unknown>[],
    profiles,
    sponsors,
    categoryMap,
    teamMap,
  };
}

export async function exportTournamentWorkbook(tournamentId: number): Promise<Buffer> {
  const ctx = await loadTournamentExportContext(tournamentId);
  return buildTournamentWorkbookExcel(ctx);
}

export async function parseWorkbookBuffer(buffer: Buffer): Promise<ParsedWorkbook> {
  const raw = await parseExcelBufferToRawWorkbook(buffer);
  return parseWorkbookFromRaw(raw);
}

export async function parseWorkbookFromGoogleUrl(url: string): Promise<ParsedWorkbook> {
  const raw = await readWorkbookFromGoogleSheetUrl(url);
  return parseWorkbookFromRaw(raw);
}

export async function parseWorkbookFromZipBuffer(buffer: Buffer): Promise<ParsedWorkbook> {
  const workbook = await parseWorkbookFromZip(buffer);
  await applyLocalMediaToPlayers(workbook);
  return workbook;
}

export async function buildWorkbookValidationContext(
  tournamentId: number,
  mode: WorkbookImportMode,
) {
  const ctx = await loadTournamentExportContext(tournamentId);
  const tournament = ctx.tournament;

  const existingPlayerFields = new Map<number, Record<string, unknown>>();
  for (const p of ctx.players) {
    existingPlayerFields.set(p.id as number, {
      "Player Name": p.name,
      Mobile: p.mobileNumber,
      Email: p.email,
      "Base Value": p.basePrice,
      Role: p.role,
      Status: p.status,
    });
  }

  return {
    tournamentId,
    auctionCode: tournament.auctionCode as string | null,
    minBid: (tournament.minBid as number) ?? 100000,
    bidValueMode: (tournament.bidValueMode as string) ?? "system",
    bidValueOptions: getOrganizerBidOptions(tournament as Parameters<typeof getOrganizerBidOptions>[0]),
    categoryNames: new Map(ctx.categories.map((c) => [String(c.name).toLowerCase(), c.id as number])),
    teamNames: new Map(ctx.teams.map((t) => [String(t.name).toLowerCase(), t.id as number])),
    existingPlayers: ctx.players.map((p) => ({
      id: p.id as number,
      name: String(p.name),
      mobileNumber: String(p.mobileNumber ?? ""),
      email: p.email as string | null,
      age: p.age as number | null,
    })),
    existingPlayerFields,
    mode,
    sport: String(tournament.sport ?? "cricket"),
  };
}

export async function validateTournamentWorkbook(
  tournamentId: number,
  workbook: ParsedWorkbook,
  mode: WorkbookImportMode,
): Promise<WorkbookValidationResult> {
  const ctx = await buildWorkbookValidationContext(tournamentId, mode);
  const result = validateWorkbook(workbook, ctx);

  const playerRows = workbook.sheets["03_Players"] ?? [];
  for (let i = 0; i < playerRows.length; i++) {
    const url = playerRows[i]?.["Photo URL"];
    if (url && !isPhotoUrl(url) && !String(url).startsWith("local://")) {
      result.issues.push({
        sheet: "03_Players",
        row: i + 2,
        column: "Photo URL",
        severity: "warning",
        message: "Photo URL format may not be downloadable",
        code: "BROKEN_URL",
      });
      result.summary.warnings++;
    }
  }

  result.valid = result.issues.filter((x) => x.severity === "error").length === 0 && result.summary.rowsTotal > 0;
  return result;
}

async function commitWorkbookEntities(
  tournamentId: number,
  workbook: ParsedWorkbook,
): Promise<number> {
  let created = 0;

  await db.transaction(async (tx) => {
    for (const row of workbook.sheets["02_Categories"] ?? []) {
      const name = String(row["Category Name"] ?? "").trim();
      if (!name) continue;
      const [existing] = await tx.select().from(categoriesTable)
        .where(and(eq(categoriesTable.tournamentId, tournamentId), eq(categoriesTable.name, name)))
        .limit(1);
      if (!existing) {
        await tx.insert(categoriesTable).values({
          tournamentId,
          name,
          maxPlayers: parseInt(String(row["Max Players"] ?? "0"), 10) || undefined,
          minBid: parseInt(String(row["Budget"] ?? "0"), 10) || undefined,
          sortOrder: parseInt(String(row["Priority"] ?? "0"), 10) || 0,
        });
        created++;
      }
    }

    for (const row of workbook.sheets["04_Teams"] ?? []) {
      const name = String(row["Team Name"] ?? "").trim();
      if (!name) continue;
      const [existing] = await tx.select().from(teamsTable)
        .where(and(eq(teamsTable.tournamentId, tournamentId), eq(teamsTable.name, name)))
        .limit(1);
      if (!existing) {
        await tx.insert(teamsTable).values({
          tournamentId,
          name,
          shortCode: name.slice(0, 3).toUpperCase(),
          ownerName: String(row["Owner Name"] ?? "") || "Owner",
          ownerMobile: String(row["Owner Mobile"] ?? "") || "0000000000",
          ownerEmail: String(row["Email"] ?? "") || null,
          color: String(row["Primary Color"] ?? "") || null,
          logoUrl: String(row["Logo URL"] ?? "") || null,
          purse: parseInt(String(row["Budget"] ?? "0"), 10) || 10000000,
        });
        created++;
      }
    }

    const sponsorRows = workbook.sheets["05_Sponsors"] ?? [];
    if (sponsorRows.length > 0) {
      const [t] = await tx.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId)).limit(1);
      let existing: SponsorLogo[] = [];
      try {
        existing = t?.sponsorLogos ? JSON.parse(t.sponsorLogos) : [];
      } catch { existing = []; }

      for (const row of sponsorRows) {
        const name = String(row["Sponsor Name"] ?? "").trim();
        if (!name || existing.some((s) => s.name === name)) continue;
        existing.push({
          name,
          url: String(row["Logo URL"] ?? ""),
          type: String(row["Category"] ?? ""),
          sponsorPriority: parseInt(String(row["Priority"] ?? "0"), 10) || undefined,
        });
        created++;
      }
      await tx.update(tournamentsTable)
        .set({ sponsorLogos: JSON.stringify(existing) })
        .where(eq(tournamentsTable.id, tournamentId));
    }

    const tournamentUpdates: Record<string, unknown> = {};
    for (const sheetName of ["01_Tournament", "06_Auction_Settings", "07_Match_Settings"] as const) {
      const row = workbook.sheets[sheetName]?.[0];
      if (!row) continue;
      const fieldMap = buildFieldLabelMap(sheetName);
      for (const [header, val] of Object.entries(row)) {
        const field = fieldMap.get(header.trim().toLowerCase());
        if (field?.entity === "tournament" && field.column && val != null && val !== "") {
          tournamentUpdates[field.column] =
            field.type === "number" ? parseInt(String(val), 10)
            : field.type === "boolean" ? normalizeBooleanInput(val)
            : val;
        }
      }
    }
    if (Object.keys(tournamentUpdates).length > 0) {
      await tx.update(tournamentsTable).set(tournamentUpdates).where(eq(tournamentsTable.id, tournamentId));
    }
  });

  return created;
}

export async function commitTournamentWorkbook(
  tournamentId: number,
  workbook: ParsedWorkbook,
  validation: WorkbookValidationResult,
  meta: {
    performedBy: string;
    fileName?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    importMode: WorkbookImportMode;
    existingJobId?: number;
    sourceType?: string;
    googleSheetUrl?: string;
    versionNotes?: string;
  },
): Promise<{ jobId: number; updatedRows: number; versionId?: number }> {
  if (validation.mode === "dry_run") {
    return { jobId: 0, updatedRows: 0 };
  }

  const extractDir = (workbook as ParsedWorkbook & { extractDir?: string }).extractDir;

  try {
    const assetResults = await importAssetsFromWorkbook(workbook);
    applyAssetResultsToWorkbook(workbook, assetResults);

    const playerRows = workbook.sheets["03_Players"] ?? [];
    await importPhotosFromRows(playerRows, ["Photo URL", "Logo URL"]);

    const start = Date.now();
    const entitiesCreated = await commitWorkbookEntities(tournamentId, workbook);

    const valCtx = await buildWorkbookValidationContext(tournamentId, validation.mode);
    const legacyRows: Record<string, unknown>[] = [];
    for (const row of playerRows) {
      const identity = resolvePlayerIdentity(row, valCtx.existingPlayers, valCtx.auctionCode);
      if (!identity.isNew && identity.playerId) {
        legacyRows.push(bmwPlayerRowToLegacyAuctionRow(row, identity.playerId));
      }
    }

    let playerUpdated = 0;
    let jobId = meta.existingJobId ?? 0;

    if (legacyRows.length > 0) {
      const legacyPreview = await validateAuctionImport(tournamentId, legacyRows);
      if (legacyPreview.valid) {
        const playerResult = await commitAuctionImport(tournamentId, legacyPreview.rows, {
          performedBy: meta.performedBy,
          fileName: meta.fileName,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          preview: legacyPreview,
          existingJobId: meta.existingJobId,
        });
        playerUpdated = playerResult.updatedRows;
        jobId = playerResult.jobId;
      }
    } else if (!jobId) {
      const [job] = await db.insert(bulkImportJobsTable).values({
        tournamentId,
        moduleType: "bidwar_master_workbook",
        importMode: meta.importMode,
        sourceType: meta.sourceType ?? "excel",
        googleSheetUrl: meta.googleSheetUrl ?? null,
        uploadedBy: meta.performedBy,
        fileName: meta.fileName ?? null,
        ipAddress: meta.ipAddress ?? null,
        browser: meta.userAgent ?? null,
        status: "committed",
        totalRows: validation.summary.rowsTotal,
        updatedRows: entitiesCreated,
        previewJson: validation.summary,
        processingTimeMs: Date.now() - start,
      }).returning();
      jobId = job!.id;
    }

    const sport = getWorkbookSport(workbook);
    const [version] = await db.insert(workbookVersionsTable).values({
      tournamentId,
      jobId: jobId || null,
      versionLabel: `BMW-${sport}-${new Date().toISOString().slice(0, 10)}-${Date.now()}`,
      versionNotes: meta.versionNotes ?? null,
      createdBy: meta.performedBy,
      snapshotMeta: { ...validation.summary, health: validation.health },
      manifestSnapshot: workbook.manifest ?? null,
    }).returning();

    if (jobId) {
      await db.update(bulkImportJobsTable).set({
        moduleType: "bidwar_master_workbook",
        importMode: meta.importMode,
        workbookVersionId: version?.id,
        updatedRows: playerUpdated + entitiesCreated,
        processingTimeMs: Date.now() - start,
      }).where(eq(bulkImportJobsTable.id, jobId));
    }

    if (validation.diffs?.length) {
      await writeEntityAuditLogs(
        validation.diffs
          .filter((d) => d.changeType !== "unchanged")
          .map((d) => ({
            entityType: d.entityType ?? "workbook",
            entityId: d.entityId ?? d.identity ?? String(d.row),
            fieldName: d.field,
            oldValue: d.oldValue,
            newValue: d.newValue,
            action: "bmw_import",
            performedBy: meta.performedBy,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            jobId,
            tournamentId,
          })),
      );
    }

    return {
      jobId,
      updatedRows: playerUpdated + entitiesCreated,
      versionId: version?.id,
    };
  } finally {
    if (extractDir) await cleanupZipExtract(extractDir);
  }
}

export async function listWorkbookHistory(tournamentId: number) {
  return db.select().from(bulkImportJobsTable).where(
    eq(bulkImportJobsTable.tournamentId, tournamentId),
  ).orderBy(desc(bulkImportJobsTable.uploadedAt));
}

export async function listWorkbookVersions(tournamentId: number) {
  return db.select().from(workbookVersionsTable)
    .where(eq(workbookVersionsTable.tournamentId, tournamentId))
    .orderBy(desc(workbookVersionsTable.createdAt));
}

export async function getWorkbookHealth(
  tournamentId: number,
  workbook: ParsedWorkbook,
  mode: WorkbookImportMode,
) {
  const validation = await validateTournamentWorkbook(tournamentId, workbook, mode);
  return {
    health: validation.health,
    valid: validation.valid,
    summary: validation.summary,
    issues: validation.issues,
  };
}

export { buildValidationReportCsv, parseLegacyExcelBuffer as parseLegacyAuctionExcelBuffer };

/** @deprecated Use bmwPlayerRowToLegacyAuctionRow */
export { bmwPlayerRowToLegacyAuctionRow as tmwPlayerRowToLegacyAuctionRow };
