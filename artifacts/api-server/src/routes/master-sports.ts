import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db";
import { requireTournamentOrganizer } from "../middleware/require-organizer";
import {
  listMasterPlayersForBadminton,
  importMasterPlayersToBadminton,
  buildSideJsonFromMasterPlayer,
  getBadmintonSettings,
  getBadmintonScoringFormat,
  saveBadmintonScoringFormat,
  loadBadmintonBranding,
  updateBadmintonBranding,
  importBrandingFromTournament,
  importAuctionBrandingToBadminton,
  importPlayersFromTournament,
} from "../lib/master-sports/badminton";
import {
  migrateBadmintonPlayersToMaster,
  ensureStatisticsForMigratedPlayers,
} from "../lib/master-sports/migrate-badminton";
import { syncAllAuctionPlayersToMaster } from "../lib/master-sports/sync";
import { parseValidatedSponsorLogos } from "../lib/sponsor-validation";

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
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  const schema = z.object({
    masterPlayerIds: z.array(z.string().min(1)).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  try {
    const result = await importMasterPlayersToBadminton(
      tournamentId,
      parsed.data.masterPlayerIds,
    );
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Import failed" });
  }
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
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

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

  if (parsed.data.linkedAuctionTournamentId !== undefined && parsed.data.linkedAuctionTournamentId !== null) {
    const [linked] = await db
      .select({ sport: tournamentsTable.sport })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, parsed.data.linkedAuctionTournamentId))
      .limit(1);
    if (!linked) {
      res.status(400).json({ error: "Linked tournament not found" });
      return;
    }
    if (linked.sport !== "badminton") {
      res.status(400).json({ error: "Linked auction source must be a badminton tournament" });
      return;
    }
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

/** GET tournament scoring format (UI: "Scoring Format") */
router.get("/scoring-format", async (req, res) => {
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

  res.json(getBadmintonScoringFormat(tournament.scoringSettingsJson as Record<string, unknown>));
});

/** PUT tournament scoring format — organizers only */
router.put("/scoring-format", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  const schema = z.object({
    presetId: z.enum(["standard_bwf", "fast_match", "single_game", "custom"]),
    format: z.object({
      totalGames: z.number().int(),
      pointsPerGame: z.number().int(),
      deuceAt: z.number().int(),
      maxPoints: z.number().int(),
      midGameSideChange: z.boolean(),
    }),
    options: z
      .object({
        suddenDeath: z.boolean().optional(),
      })
      .optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid scoring format" });
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

  const updated = await saveBadmintonScoringFormat(tournamentId, parsed.data);
  res.json(getBadmintonScoringFormat(updated));
});

/** GET tournament branding for scoreboard / display surfaces */
router.get("/branding", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }

  const branding = await loadBadmintonBranding(tournamentId);
  if (!branding) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(branding);
});

/** PATCH tournament branding (scorer-only tournaments without auction) */
router.patch("/branding", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  const schema = z.object({
    displayName: z.string().min(1).max(200).optional(),
    logoUrl: z
      .string()
      .nullable()
      .optional()
      .refine(
        (v) => v == null || v === "" || v.startsWith("https://res.cloudinary.com/"),
        "Logo URL must be a Cloudinary HTTPS URL",
      ),
    logoPublicId: z.string().nullable().optional(),
    sponsorLogos: z.string().nullable().optional(),
    venue: z.string().max(200).nullable().optional(),
    organizerName: z.string().max(200).nullable().optional(),
    primaryColor: z.string().max(20).optional(),
    accentColor: z.string().max(20).optional(),
    scoreBoardSponsor: z
      .object({
        logoUrl: z
          .string()
          .nullable()
          .optional()
          .refine(
            (v) => v == null || v === "" || v.startsWith("https://res.cloudinary.com/"),
            "Logo URL must be a Cloudinary HTTPS URL",
          ),
        logoPublicId: z.string().nullable().optional(),
        name: z.string().max(200).nullable().optional(),
        title: z.string().max(200).nullable().optional(),
      })
      .nullable()
      .optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  if (parsed.data.sponsorLogos !== undefined) {
    const sponsorCheck = parseValidatedSponsorLogos(parsed.data.sponsorLogos ?? undefined);
    if (!sponsorCheck.ok) {
      res.status(400).json({ error: sponsorCheck.error });
      return;
    }
    parsed.data.sponsorLogos = sponsorCheck.value ?? null;
  }

  try {
    const brandingInput = {
      ...parsed.data,
      scoreBoardSponsor:
        parsed.data.scoreBoardSponsor == null
          ? parsed.data.scoreBoardSponsor
          : {
              logoUrl: parsed.data.scoreBoardSponsor.logoUrl ?? null,
              logoPublicId: parsed.data.scoreBoardSponsor.logoPublicId ?? null,
              name: parsed.data.scoreBoardSponsor.name ?? null,
              title: parsed.data.scoreBoardSponsor.title ?? null,
            },
    };
    const branding = await updateBadmintonBranding(tournamentId, brandingInput, req.log);
    res.json(branding);
  } catch (e) {
    res.status(404).json({ error: e instanceof Error ? e.message : "Update failed" });
  }
});

/** POST import Auction Hub branding into badminton display settings (same tournament) */
router.post("/import-auction-branding", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  try {
    const branding = await importAuctionBrandingToBadminton(tournamentId);
    res.json(branding);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Import failed" });
  }
});

/** POST import branding from another tournament */
router.post("/import-branding", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  const schema = z.object({
    sourceTournamentId: z.number().int(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  if (parsed.data.sourceTournamentId === tournamentId) {
    res.status(400).json({ error: "Cannot import from the same tournament" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, parsed.data.sourceTournamentId))) return;

  try {
    const branding = await importBrandingFromTournament(
      tournamentId,
      parsed.data.sourceTournamentId,
    );
    res.json(branding);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Import failed" });
  }
});

/** POST import players from another tournament (badminton or auction roster) */
router.post("/import-from-tournament", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  const schema = z.object({
    sourceTournamentId: z.number().int(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  if (parsed.data.sourceTournamentId === tournamentId) {
    res.status(400).json({ error: "Cannot import from the same tournament" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, parsed.data.sourceTournamentId))) return;

  try {
    const result = await importPlayersFromTournament(
      tournamentId,
      parsed.data.sourceTournamentId,
    );
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Import failed" });
  }
});

/** POST run badminton → master migration (admin/organizer) */
router.post("/migrate-to-master", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

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
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

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
