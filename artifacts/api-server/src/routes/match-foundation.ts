import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireTournamentOrganizer } from "../middleware/require-organizer";
import {
  buildMatchConfiguration,
  buildMatchIdentity,
  buildMatchLifecycle,
  buildMatchValidation,
  listMatchHistory,
  listMatchRows,
  loadLatestMatchHistory,
  loadMatchOfficials,
  loadMatchRow,
  loadMatchSides,
  lockMatchSetup,
  patchMatchConfiguration,
} from "../lib/match-service";

import { db, tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireScoringModule } from "../middleware/require-module";

const router: IRouter = Router();

function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

router.use("/tournaments/:tournamentId", async (req, res, next) => {
  const tid = parseId(req.params.tournamentId);
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  const [tournament] = await db
    .select({
      id: tournamentsTable.id,
      auctionEnabled: tournamentsTable.auctionEnabled,
      scoringEnabled: tournamentsTable.scoringEnabled,
      sport: tournamentsTable.sport,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tid))
    .limit(1);

  if (!requireScoringModule(res, tournament)) return;
  next();
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  displayName: z.string().nullable().optional(),
  typeId: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  surface: z.string().nullable().optional(),
  scheduledDate: z.string().nullable().optional(),
  scheduledTime: z.string().nullable().optional(),
  visibility: z.string().nullable().optional(),
  branding: z
    .object({
      primaryColor: z.string().nullable().optional(),
      secondaryColor: z.string().nullable().optional(),
      logoUrl: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

router.get("/tournaments/:tournamentId/matches/identities", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  const matches = await listMatchRows(tid);
  res.json({ identities: matches.map(buildMatchIdentity) });
});

/** GET /tournaments/:id/matches/aggregate — Fast bulk loader for tournament matches */
router.get("/tournaments/:tournamentId/matches/aggregate", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  const matches = await listMatchRows(tid);
  const rows = await Promise.all(
    matches.map(async (match) => {
      const history = await loadLatestMatchHistory(match.id);
      const sides = await loadMatchSides(match);
      const officials = await loadMatchOfficials(match);
      const validation = await buildMatchValidation(tid, match);
      const lifecycle = buildMatchLifecycle(match);
      return {
        identity: buildMatchIdentity(match),
        configuration: buildMatchConfiguration(match, history?.version ?? null),
        lifecycle,
        validation,
        sides,
        officialCount: officials.length,
      };
    }),
  );
  res.json({ rows });
});

router.get("/tournaments/:tournamentId/matches/:matchId/identity", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  const matchId = parseId(req.params.matchId);
  if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
  const match = await loadMatchRow(tid, matchId);
  if (!match) return res.status(404).json({ error: "Match not found" });
  res.json({ identity: buildMatchIdentity(match) });
});

router.get("/tournaments/:tournamentId/matches/:matchId/configuration", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  const matchId = parseId(req.params.matchId);
  if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
  const match = await loadMatchRow(tid, matchId);
  if (!match) return res.status(404).json({ error: "Match not found" });
  const history = await loadLatestMatchHistory(matchId);
  res.json({ configuration: buildMatchConfiguration(match, history?.version ?? null) });
});

router.patch("/tournaments/:tournamentId/matches/:matchId/configuration", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  const matchId = parseId(req.params.matchId);
  if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid configuration patch", details: parsed.error.flatten() });
  }
  const result = await patchMatchConfiguration(tid, matchId, parsed.data);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json({ configuration: result.configuration });
});

router.get("/tournaments/:tournamentId/matches/:matchId/sides", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  const matchId = parseId(req.params.matchId);
  if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
  const match = await loadMatchRow(tid, matchId);
  if (!match) return res.status(404).json({ error: "Match not found" });
  res.json({ sides: await loadMatchSides(match) });
});

router.get("/tournaments/:tournamentId/matches/:matchId/officials", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  const matchId = parseId(req.params.matchId);
  if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
  const match = await loadMatchRow(tid, matchId);
  if (!match) return res.status(404).json({ error: "Match not found" });
  res.json({ officials: loadMatchOfficials(match) });
});

router.get("/tournaments/:tournamentId/matches/:matchId/lifecycle", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  const matchId = parseId(req.params.matchId);
  if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
  const match = await loadMatchRow(tid, matchId);
  if (!match) return res.status(404).json({ error: "Match not found" });
  res.json({ lifecycle: buildMatchLifecycle(match) });
});

router.get("/tournaments/:tournamentId/matches/:matchId/validation", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  const matchId = parseId(req.params.matchId);
  if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
  const match = await loadMatchRow(tid, matchId);
  if (!match) return res.status(404).json({ error: "Match not found" });
  res.json({ validation: await buildMatchValidation(tid, match) });
});

router.get("/tournaments/:tournamentId/matches/:matchId/history", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  const matchId = parseId(req.params.matchId);
  if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
  const match = await loadMatchRow(tid, matchId);
  if (!match) return res.status(404).json({ error: "Match not found" });
  res.json({ history: await listMatchHistory(matchId) });
});

router.post("/tournaments/:tournamentId/matches/:matchId/ready", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  const matchId = parseId(req.params.matchId);
  if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const frozenBy =
    req.jwtUser?.email ||
    (req.jwtUser?.organizerAccountId != null
      ? `organizer:${req.jwtUser.organizerAccountId}`
      : req.jwtUser?.isAdmin
        ? "admin"
        : null);

  const result = await lockMatchSetup(tid, matchId, frozenBy);
  if (!result.ok) {
    return res.status(result.status).json({
      error: result.error,
      validation: result.validation,
    });
  }
  res.json({
    history: result.history,
    validation: result.validation,
    configuration: result.configuration,
    lifecycle: result.lifecycle,
  });
});

export default router;
