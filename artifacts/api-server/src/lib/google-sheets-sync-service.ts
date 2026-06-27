import { db, googleSheetSyncsTable, playersTable, tournamentsTable, categoriesTable, teamsTable } from "@workspace/db";
import { buildPlayerExportSheetValues } from "@workspace/api-base/export-players-rows";
import { asc, eq } from "drizzle-orm";
import type { Logger } from "pino";
import { googleSheetsOwnerKey } from "./google-sheets-oauth.js";
import {
  createPlayersSpreadsheet,
  getValidAccessToken,
  GoogleSheetsNotConnectedError,
  GoogleSheetsTokenExpiredError,
  regeneratePlayersSpreadsheet,
} from "./google-sheets-service.js";
import { getGoogleSheetsConnectionStatus } from "./google-sheets-token-store.js";
import { serializePlayersWithSpecifications } from "./player-spec-response.js";

const MAX_SYNC_RETRIES = 3;

function ownerKeyForOrganizerId(organizerId: number): string {
  return `organizer:${organizerId}`;
}

async function buildTournamentSheetValues(tournamentId: number): Promise<string[][]> {
  const playerRows = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tournamentId))
    .orderBy(asc(playersTable.serialNo), asc(playersTable.id));

  const serializedPlayers = await serializePlayersWithSpecifications(playerRows, "private");

  const [categories, teams] = await Promise.all([
    db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.tournamentId, tournamentId)),
    db.select({ id: teamsTable.id, name: teamsTable.name }).from(teamsTable).where(eq(teamsTable.tournamentId, tournamentId)),
  ]);

  const catMap = Object.fromEntries(categories.map((c) => [c.id, { name: c.name }]));
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, { name: t.name }]));

  return buildPlayerExportSheetValues(serializedPlayers, catMap, teamMap);
}

async function markSyncStatus(
  tournamentId: number,
  syncStatus: string,
  patch: { lastSyncedAt?: Date | null; lastError?: string | null } = {},
): Promise<void> {
  await db
    .update(googleSheetSyncsTable)
    .set({
      syncStatus,
      lastSyncedAt: patch.lastSyncedAt,
      lastError: patch.lastError ?? null,
      updatedAt: new Date(),
    })
    .where(eq(googleSheetSyncsTable.tournamentId, tournamentId));
}

export async function getTournamentGoogleSheetSync(tournamentId: number) {
  const [row] = await db
    .select()
    .from(googleSheetSyncsTable)
    .where(eq(googleSheetSyncsTable.tournamentId, tournamentId));
  return row ?? null;
}

export async function getTournamentGoogleSheetStatus(tournamentId: number, organizerAccountId?: number, isAdmin?: boolean) {
  const ownerKey = googleSheetsOwnerKey(organizerAccountId, !!isAdmin);
  const oauth = ownerKey ? await getGoogleSheetsConnectionStatus(ownerKey) : { connected: false, email: null };
  const sync = await getTournamentGoogleSheetSync(tournamentId);

  return {
    googleConnected: oauth.connected,
    googleAccountEmail: oauth.email,
    sheetConfigured: !!sync,
    spreadsheetId: sync?.spreadsheetId ?? null,
    spreadsheetUrl: sync?.spreadsheetUrl ?? null,
    syncStatus: sync?.syncStatus ?? null,
    lastSyncedAt: sync?.lastSyncedAt?.toISOString() ?? null,
    lastError: sync?.lastError ?? null,
  };
}

export async function disconnectTournamentGoogleSheet(tournamentId: number): Promise<void> {
  await db.delete(googleSheetSyncsTable).where(eq(googleSheetSyncsTable.tournamentId, tournamentId));
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function performGoogleSheetSync(
  tournamentId: number,
  log?: Logger,
  options?: { force?: boolean },
): Promise<{ spreadsheetUrl: string; playerCount: number } | null> {
  const sync = await getTournamentGoogleSheetSync(tournamentId);
  if (!sync) return null;

  if (!options?.force && sync.syncStatus === "DISCONNECTED") {
    return null;
  }

  const ownerKey = ownerKeyForOrganizerId(sync.organizerId);
  await markSyncStatus(tournamentId, "SYNCING", { lastError: null });

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_SYNC_RETRIES; attempt++) {
    try {
      const accessToken = await getValidAccessToken(ownerKey);
      const sheetValues = await buildTournamentSheetValues(tournamentId);
      const playerCount = Math.max(0, sheetValues.length - 1);

      await regeneratePlayersSpreadsheet(accessToken, sync.spreadsheetId, sheetValues);

      await markSyncStatus(tournamentId, "CONNECTED", {
        lastSyncedAt: new Date(),
        lastError: null,
      });

      log?.info({ tournamentId, playerCount, attempt }, "Google Sheet sync completed");
      return { spreadsheetUrl: sync.spreadsheetUrl, playerCount };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (err instanceof GoogleSheetsTokenExpiredError || err instanceof GoogleSheetsNotConnectedError) {
        await markSyncStatus(tournamentId, "DISCONNECTED", {
          lastError: "Google account authorization expired. Please reconnect.",
        });
        log?.warn({ err, tournamentId }, "Google Sheet sync disconnected — token expired");
        throw lastError;
      }

      log?.warn({ err, tournamentId, attempt }, "Google Sheet sync attempt failed");
      if (attempt < MAX_SYNC_RETRIES) {
        await sleep(1000 * attempt);
      }
    }
  }

  await markSyncStatus(tournamentId, "ERROR", {
    lastError: lastError?.message ?? "Sync failed",
  });
  throw lastError ?? new Error("Google Sheet sync failed");
}

export async function connectAndSyncTournamentGoogleSheet(
  tournamentId: number,
  organizerId: number,
  log?: Logger,
): Promise<{ spreadsheetUrl: string; spreadsheetId: string; playerCount: number; created: boolean }> {
  const ownerKey = ownerKeyForOrganizerId(organizerId);
  const accessToken = await getValidAccessToken(ownerKey);

  const [tournament] = await db
    .select({ name: tournamentsTable.name })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));
  if (!tournament) {
    throw new Error("Tournament not found");
  }

  const sheetValues = await buildTournamentSheetValues(tournamentId);
  const playerCount = Math.max(0, sheetValues.length - 1);

  const existing = await getTournamentGoogleSheetSync(tournamentId);
  if (existing) {
    await markSyncStatus(tournamentId, "SYNCING", { lastError: null });
    await regeneratePlayersSpreadsheet(accessToken, existing.spreadsheetId, sheetValues);
    await markSyncStatus(tournamentId, "CONNECTED", { lastSyncedAt: new Date(), lastError: null });
    return {
      spreadsheetUrl: existing.spreadsheetUrl,
      spreadsheetId: existing.spreadsheetId,
      playerCount,
      created: false,
    };
  }

  const title = `${tournament.name} - Players`;
  const createdSheet = await createPlayersSpreadsheet(accessToken, title, sheetValues);

  await db.insert(googleSheetSyncsTable).values({
    organizerId,
    tournamentId,
    spreadsheetId: createdSheet.spreadsheetId,
    spreadsheetUrl: createdSheet.spreadsheetUrl,
    syncStatus: "CONNECTED",
    lastSyncedAt: new Date(),
    lastError: null,
  });

  log?.info({ tournamentId, spreadsheetId: createdSheet.spreadsheetId }, "Google Sheet created for tournament");
  return {
    spreadsheetUrl: createdSheet.spreadsheetUrl,
    spreadsheetId: createdSheet.spreadsheetId,
    playerCount,
    created: true,
  };
}
