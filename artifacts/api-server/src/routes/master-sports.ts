import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db";
import { isOrganizerOrAdmin } from "../middleware/require-organizer";
import {
  listMasterPlayersForBadminton,
  importMasterPlayersToBadminton,
  buildSideJsonFromMasterPlayer,
  getBadmintonSettings,
} from "../lib/master-sports/badminton";
import {
  migrateBadmintonPlayersToMaster,
  ensureStatisticsForMigratedPlayers,
} from "../lib/master-sports/migrate-badminton";
import { syncAllAuctionPlayersToMaster } from "../lib/master-sports/sync";

const router = Router({ mergeParams: true });

function tid(req: { params: Record<string, string> }): number | null {
  const n = parseInt(req.params.id, 10);
  return Number.isNaN(n) ? null : n;
}

/** GET master players for badminton import / match creation */
router.get("/master-players", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }

  const items = await listMasterPlayersForBadminton(tournamentId);
  res.json(items);
});

/** POST import selected master players into badminton tournament */
router.post("/import-master-players", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }
  if (!isOrganizerOrAdmin(req, tournamentId)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const schema = z.object({
    masterPlayerIds: z.array(z.string().min(1)).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const result = await importMasterPlayersToBadminton(
    tournamentId,
    parsed.data.masterPlayerIds,
  );
  res.json(result);
});

/** GET side JSON preview from master player (match creation helper) */
router.get("/master-players/:masterPlayerId/side-json", async (req, res) => {
  const tournamentId = tid(req);
  const masterPlayerId = req.params.masterPlayerId;
  if (!tournamentId || !masterPlayerId) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  try {
    const badmintonPlayerId = req.query.badmintonPlayerId
      ? parseInt(String(req.query.badmintonPlayerId), 10)
      : undefined;
    const sideJson = await buildSideJsonFromMasterPlayer(
      masterPlayerId,
      tournamentId,
      badmintonPlayerId,
    );
    res.json(sideJson);
  } catch {
    res.status(404).json({ error: "Master player not found" });
  }
});

/** PATCH badminton tournament settings (auto sync mode) */
router.patch("/settings", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }
  if (!isOrganizerOrAdmin(req, tournamentId)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const schema = z.object({
    autoSyncAuctionPlayers: z.boolean().optional(),
    linkedAuctionTournamentId: z.number().int().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const current = (tournament.scoringSettingsJson ?? {}) as Record<string, unknown>;
  const updated = {
    ...current,
    ...(parsed.data.autoSyncAuctionPlayers !== undefined
      ? { autoSyncAuctionPlayers: parsed.data.autoSyncAuctionPlayers }
      : {}),
    ...(parsed.data.linkedAuctionTournamentId !== undefined
      ? { linkedAuctionTournamentId: parsed.data.linkedAuctionTournamentId }
      : {}),
  };

  await db
    .update(tournamentsTable)
    .set({ scoringSettingsJson: updated })
    .where(eq(tournamentsTable.id, tournamentId));

  res.json(getBadmintonSettings(updated));
});

/** GET badminton master sports settings */
router.get("/settings", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }

  const [tournament] = await db
    .select({ scoringSettingsJson: tournamentsTable.scoringSettingsJson })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(getBadmintonSettings(tournament.scoringSettingsJson as Record<string, unknown>));
});

/** POST run badminton → master migration (admin/organizer) */
router.post("/migrate-to-master", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }
  if (!isOrganizerOrAdmin(req, tournamentId)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const migration = await migrateBadmintonPlayersToMaster(tournamentId);
  const statsCreated = await ensureStatisticsForMigratedPlayers(tournamentId);

  res.json({ ...migration, statisticsRowsCreated: statsCreated });
});

/** POST sync linked auction players to master (manual trigger) */
router.post("/sync-auction-players", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }
  if (!isOrganizerOrAdmin(req, tournamentId)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const [tournament] = await db
    .select({ scoringSettingsJson: tournamentsTable.scoringSettingsJson })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  const settings = getBadmintonSettings(
    tournament?.scoringSettingsJson as Record<string, unknown>,
  );

  const auctionTournamentId = settings.linkedAuctionTournamentId ?? tournamentId;
  const synced = await syncAllAuctionPlayersToMaster(auctionTournamentId);
  res.json({ synced, auctionTournamentId });
});

export default router;
