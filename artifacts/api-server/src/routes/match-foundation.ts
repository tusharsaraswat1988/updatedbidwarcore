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

const router: IRouter = Router();

function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

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
