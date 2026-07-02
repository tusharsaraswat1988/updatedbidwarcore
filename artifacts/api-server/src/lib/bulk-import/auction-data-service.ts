import { eq, and, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  playersTable,
  categoriesTable,
  teamsTable,
  tournamentsTable,
  tournamentPlayerProfilesTable,
  bulkImportJobsTable,
  bulkImportJobItemsTable,
  entityAuditLogsTable,
} from "@workspace/db";
import {
  validateImportRows,
  type ParsedImportRow,
  type ImportValidationContext,
  type ImportValidationResult,
  AUCTION_EDITABLE_FIELDS,
} from "@workspace/api-base/auction-data";
import { getOrganizerBidOptions } from "@workspace/api-base/bid-value";
import {
  changeKey,
  serializeValue,
} from "./engine";
import type { EntityAuditInput } from "./entity-audit-service";

export async function exportAuctionDataExcel(tournamentId: number): Promise<Buffer> {
  // Backward compat: delegate to full TMW export (superset of legacy auction sheet)
  const { exportTournamentWorkbook } = await import("./workbook-service.js");
  return exportTournamentWorkbook(tournamentId);
}

export async function parseExcelBuffer(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const { parseWorkbookBuffer } = await import("./workbook-service.js");
  const { extractLegacyAuctionRows } = await import("@workspace/api-base/tournament-workbook");
  const wb = await parseWorkbookBuffer(buffer);
  return extractLegacyAuctionRows(wb);
}

export async function buildValidationContext(tournamentId: number): Promise<ImportValidationContext> {
  const [tournament, playerRows, categoryRows, teamRows, profileRows] = await Promise.all([
    db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId)).limit(1).then((r) => r[0]),
    db.select().from(playersTable).where(eq(playersTable.tournamentId, tournamentId)),
    db.select().from(categoriesTable).where(eq(categoriesTable.tournamentId, tournamentId)),
    db.select().from(teamsTable).where(eq(teamsTable.tournamentId, tournamentId)),
    db
      .select()
      .from(tournamentPlayerProfilesTable)
      .where(eq(tournamentPlayerProfilesTable.tournamentId, tournamentId)),
  ]);

  if (!tournament) throw new Error("Tournament not found");

  const categoryNames = new Map(categoryRows.map((c) => [c.name.toLowerCase(), c.id]));
  const teamNames = new Map(teamRows.map((t) => [t.name.toLowerCase(), t.id]));
  const existingPlayerIds = new Set(playerRows.map((p) => p.id));
  const playerTournamentMap = new Map(playerRows.map((p) => [p.id, p.tournamentId]));
  const profileIdToPlayerId = new Map<number, number>();

  for (const profile of profileRows) {
    const player = playerRows.find((p) => p.globalPlayerId === profile.masterPlayerId);
    if (player) profileIdToPlayerId.set(profile.id, player.id);
  }

  const usedAuctionOrders = new Map<number, number>();
  for (const p of playerRows) {
    if (p.serialNo != null) usedAuctionOrders.set(p.serialNo, p.id);
  }

  return {
    tournamentId,
    minBid: tournament.minBid ?? 100000,
    bidValueMode: tournament.bidValueMode ?? "system",
    bidValueOptions: getOrganizerBidOptions(tournament),
    categoryNames,
    teamNames,
    existingPlayerIds,
    playerTournamentMap,
    profileIdToPlayerId,
    usedAuctionOrders,
    duplicateRowKeys: new Set(),
  };
}

export async function validateAuctionImport(
  tournamentId: number,
  rows: Record<string, unknown>[],
): Promise<ImportValidationResult> {
  const ctx = await buildValidationContext(tournamentId);
  return validateImportRows(rows, ctx);
}

async function ensureTournamentProfile(
  player: typeof playersTable.$inferSelect,
  tournamentId: number,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<typeof tournamentPlayerProfilesTable.$inferSelect> {
  if (!player.globalPlayerId) {
    throw new Error(`Player ${player.id} has no linked master profile for tournament profile fields`);
  }

  const [existing] = await tx
    .select()
    .from(tournamentPlayerProfilesTable)
    .where(
      and(
        eq(tournamentPlayerProfilesTable.tournamentId, tournamentId),
        eq(tournamentPlayerProfilesTable.masterPlayerId, player.globalPlayerId),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const initials = player.name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 4) || `P${player.id}`;

  const [created] = await tx
    .insert(tournamentPlayerProfilesTable)
    .values({
      tournamentId,
      masterPlayerId: player.globalPlayerId,
      displayName: player.name,
      initials,
    })
    .returning();

  return created!;
}

export async function commitAuctionImport(
  tournamentId: number,
  rows: ParsedImportRow[],
  meta: {
    performedBy: string;
    fileName?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    preview: ImportValidationResult;
    existingJobId?: number;
  },
): Promise<{ jobId: number; updatedRows: number }> {
  const start = Date.now();

  return db.transaction(async (tx) => {
    const jobItems: Array<{
      playerId: number;
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
      status: string;
    }> = [];
    const auditEntries: EntityAuditInput[] = [];

    let jobId = meta.existingJobId;
    if (jobId) {
      await tx
        .update(bulkImportJobsTable)
        .set({ status: "committed" })
        .where(eq(bulkImportJobsTable.id, jobId));
    } else {
      const [job] = await tx
        .insert(bulkImportJobsTable)
        .values({
          tournamentId,
          moduleType: "auction_data",
          uploadedBy: meta.performedBy,
          fileName: meta.fileName ?? null,
          ipAddress: meta.ipAddress ?? null,
          browser: meta.userAgent ?? null,
          status: "committed",
          totalRows: rows.length,
          previewJson: meta.preview.summary,
          processingTimeMs: 0,
        })
        .returning();
      jobId = job!.id;
    }

    for (const row of rows) {
      const [player] = await tx
        .select()
        .from(playersTable)
        .where(and(eq(playersTable.id, row.playerId), eq(playersTable.tournamentId, tournamentId)))
        .limit(1);

      if (!player) continue;

      let profile = null;
      if (player.globalPlayerId) {
        const [p] = await tx
          .select()
          .from(tournamentPlayerProfilesTable)
          .where(
            and(
              eq(tournamentPlayerProfilesTable.tournamentId, tournamentId),
              eq(tournamentPlayerProfilesTable.masterPlayerId, player.globalPlayerId),
            ),
          )
          .limit(1);
        profile = p ?? null;
      }

      const needsProfile = row.updates.some((u) => u.field.source === "tournament_profile");
      if (needsProfile && !profile) {
        profile = await ensureTournamentProfile(player, tournamentId, tx);
      }

      for (const update of row.updates) {
        const field = update.field;
        const entityType = field.source === "player" ? "player" : "tournament_profile";
        const entityId =
          field.source === "player" ? String(player.id) : String(profile!.id);
        const sourceRecord = field.source === "player" ? player : profile;
        const oldRaw = (sourceRecord as Record<string, unknown>)[field.column];
        const oldValue = serializeValue(oldRaw);
        const newValue = serializeValue(update.parsedValue);

        if (oldValue === newValue) {
          jobItems.push({
            playerId: row.playerId,
            fieldName: field.key,
            oldValue,
            newValue,
            status: "skipped",
          });
          continue;
        }

        if (field.source === "player") {
          await tx
            .update(playersTable)
            .set({ [field.column]: update.parsedValue } as Record<string, unknown>)
            .where(eq(playersTable.id, player.id));
        } else if (profile) {
          await tx
            .update(tournamentPlayerProfilesTable)
            .set({ [field.column]: update.parsedValue } as Record<string, unknown>)
            .where(eq(tournamentPlayerProfilesTable.id, profile.id));
        }

        auditEntries.push({
          entityType,
          entityId,
          fieldName: field.key,
          oldValue,
          newValue,
          action: "bulk_import",
          performedBy: meta.performedBy,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          jobId: jobId!,
          tournamentId,
        });

        jobItems.push({
          playerId: row.playerId,
          fieldName: field.key,
          oldValue,
          newValue,
          status: "updated",
        });
      }
    }

    const updatedRows = jobItems.filter((i) => i.status === "updated").length;
    const failedRows = jobItems.filter((i) => i.status === "error").length;

    await tx
      .update(bulkImportJobsTable)
      .set({
        updatedRows,
        failedRows,
        skippedRows: rows.length - updatedRows,
        processingTimeMs: Date.now() - start,
        status: "committed",
      })
      .where(eq(bulkImportJobsTable.id, jobId!));

    // Audit + job items outside tx is acceptable for append-only logs,
    // but we write inside transaction scope via direct insert
    if (auditEntries.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < auditEntries.length; i += batchSize) {
        await tx.insert(entityAuditLogsTable).values(
          auditEntries.slice(i, i + batchSize).map((e: EntityAuditInput) => ({
            entityType: e.entityType,
            entityId: e.entityId,
            fieldName: e.fieldName,
            oldValue: e.oldValue,
            newValue: e.newValue,
            action: e.action,
            performedBy: e.performedBy,
            ipAddress: e.ipAddress ?? null,
            userAgent: e.userAgent ?? null,
            jobId: e.jobId ?? null,
            tournamentId: e.tournamentId ?? null,
          })),
        );
      }
    }

    if (jobItems.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < jobItems.length; i += batchSize) {
        await tx.insert(bulkImportJobItemsTable).values(
          jobItems.slice(i, i + batchSize).map((c) => ({
            jobId: jobId!,
            playerId: c.playerId,
            fieldName: c.fieldName,
            oldValue: c.oldValue,
            newValue: c.newValue,
            status: c.status,
            errorMessage: null,
          })),
        );
      }
    }

    return { jobId: jobId!, updatedRows };
  });
}

export async function listImportHistory(tournamentId: number) {
  return db
    .select()
    .from(bulkImportJobsTable)
    .where(
      and(
        eq(bulkImportJobsTable.tournamentId, tournamentId),
        eq(bulkImportJobsTable.moduleType, "auction_data"),
      ),
    )
    .orderBy(desc(bulkImportJobsTable.uploadedAt));
}

export function buildErrorReportCsv(issues: ImportValidationResult["issues"]): string {
  const headers = ["Row", "Column", "Player ID", "Severity", "Message"];
  const lines = [headers.join(",")];
  for (const issue of issues) {
    lines.push(
      [
        issue.row,
        issue.column ?? "",
        issue.playerId ?? "",
        issue.severity,
        `"${issue.message.replace(/"/g, '""')}"`,
      ].join(","),
    );
  }
  return lines.join("\n");
}

export { AUCTION_EDITABLE_FIELDS, changeKey };
