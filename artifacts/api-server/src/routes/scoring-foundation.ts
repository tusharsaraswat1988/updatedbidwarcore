import { Router } from "express";
import { z } from "zod";
import { isOrganizerOrAdmin } from "../middleware/require-organizer";
import {
  createScoringOfficial,
  createScoringVenue,
  deleteScoringOfficial,
  deleteScoringVenue,
  generateScoringDraw,
  getMatchSquads,
  getPublicTournamentSchedule,
  listScoringDraws,
  listScoringFixtures,
  listScoringGroups,
  listScoringOfficials,
  listScoringVenues,
  setMatchSquad,
  updateScoringOfficial,
  updateScoringVenue,
} from "../lib/scoring-foundation-service";
import { ScoringServiceError } from "../lib/scoring-service";

const router = Router({ mergeParams: true });

function tid(req: { params: Record<string, string> }): number | null {
  const n = parseInt(req.params.tournamentId ?? req.params.id, 10);
  return Number.isNaN(n) ? null : n;
}

function handleError(res: import("express").Response, err: unknown) {
  if (err instanceof ScoringServiceError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  throw err;
}

function requireOrganizer(req: import("express").Request, res: import("express").Response, tournamentId: number) {
  if (!isOrganizerOrAdmin(req, tournamentId)) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  return true;
}

// ─── Public ───────────────────────────────────────────────────────────────────

router.get("/public/schedule", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  try {
    const data = await getPublicTournamentSchedule(tournamentId);
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Venues ───────────────────────────────────────────────────────────────────

router.get("/venues", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "Invalid tournament ID" });
  if (!requireOrganizer(req, res, tournamentId)) return;
  try {
    res.json(await listScoringVenues(tournamentId));
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/venues", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "Invalid tournament ID" });
  if (!requireOrganizer(req, res, tournamentId)) return;

  const schema = z.object({
    name: z.string().min(1),
    city: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    surfaceType: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const row = await createScoringVenue(tournamentId, parsed.data);
    res.status(201).json(row);
  } catch (err) {
    handleError(res, err);
  }
});

router.patch("/venues/:venueId", async (req, res) => {
  const tournamentId = tid(req);
  const venueId = parseInt(req.params.venueId, 10);
  if (!tournamentId || Number.isNaN(venueId)) {
    return void res.status(400).json({ error: "Invalid ID" });
  }
  if (!requireOrganizer(req, res, tournamentId)) return;

  const schema = z.object({
    name: z.string().min(1).optional(),
    city: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    surfaceType: z.string().nullable().optional(),
    status: z.string().optional(),
    sortOrder: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    res.json(await updateScoringVenue(tournamentId, venueId, parsed.data));
  } catch (err) {
    handleError(res, err);
  }
});

router.delete("/venues/:venueId", async (req, res) => {
  const tournamentId = tid(req);
  const venueId = parseInt(req.params.venueId, 10);
  if (!tournamentId || Number.isNaN(venueId)) {
    return void res.status(400).json({ error: "Invalid ID" });
  }
  if (!requireOrganizer(req, res, tournamentId)) return;
  try {
    res.json(await deleteScoringVenue(tournamentId, venueId));
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Officials ────────────────────────────────────────────────────────────────

router.get("/officials", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "Invalid tournament ID" });
  if (!requireOrganizer(req, res, tournamentId)) return;
  try {
    res.json(await listScoringOfficials(tournamentId));
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/officials", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "Invalid tournament ID" });
  if (!requireOrganizer(req, res, tournamentId)) return;

  const schema = z.object({
    name: z.string().min(1),
    role: z.enum(["umpire", "scorer", "referee", "match_referee"]).optional(),
    mobile: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    res.status(201).json(await createScoringOfficial(tournamentId, parsed.data));
  } catch (err) {
    handleError(res, err);
  }
});

router.patch("/officials/:officialId", async (req, res) => {
  const tournamentId = tid(req);
  const officialId = parseInt(req.params.officialId, 10);
  if (!tournamentId || Number.isNaN(officialId)) {
    return void res.status(400).json({ error: "Invalid ID" });
  }
  if (!requireOrganizer(req, res, tournamentId)) return;

  const schema = z.object({
    name: z.string().min(1).optional(),
    role: z.string().optional(),
    mobile: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    res.json(await updateScoringOfficial(tournamentId, officialId, parsed.data));
  } catch (err) {
    handleError(res, err);
  }
});

router.delete("/officials/:officialId", async (req, res) => {
  const tournamentId = tid(req);
  const officialId = parseInt(req.params.officialId, 10);
  if (!tournamentId || Number.isNaN(officialId)) {
    return void res.status(400).json({ error: "Invalid ID" });
  }
  if (!requireOrganizer(req, res, tournamentId)) return;
  try {
    res.json(await deleteScoringOfficial(tournamentId, officialId));
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Draws & fixtures ─────────────────────────────────────────────────────────

router.get("/draws", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "Invalid tournament ID" });
  if (!requireOrganizer(req, res, tournamentId)) return;
  try {
    res.json(await listScoringDraws(tournamentId));
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/fixtures", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "Invalid tournament ID" });
  if (!requireOrganizer(req, res, tournamentId)) return;

  const drawIdRaw = req.query.drawId;
  const drawId = drawIdRaw != null ? parseInt(String(drawIdRaw), 10) : undefined;

  try {
    res.json(await listScoringFixtures(tournamentId, Number.isFinite(drawId) ? drawId : undefined));
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/draws/:drawId/groups", async (req, res) => {
  const tournamentId = tid(req);
  const drawId = parseInt(req.params.drawId, 10);
  if (!tournamentId || Number.isNaN(drawId)) {
    return void res.status(400).json({ error: "Invalid ID" });
  }
  if (!requireOrganizer(req, res, tournamentId)) return;
  try {
    res.json(await listScoringGroups(tournamentId, drawId));
  } catch (err) {
    handleError(res, err);
  }
});

const groupSchema = z.object({
  name: z.string().min(1),
  teamIds: z.array(z.number().int().positive()).min(2),
});

router.post("/draws/generate", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "Invalid tournament ID" });
  if (!requireOrganizer(req, res, tournamentId)) return;

  const schema = z.object({
    name: z.string().min(1),
    format: z.enum(["round_robin", "league", "knockout", "league_knockout"]),
    teamIds: z.array(z.number().int().positive()).min(2),
    groups: z.array(groupSchema).optional(),
    oversLimit: z.number().int().positive().max(50).optional(),
    venueId: z.number().int().positive().nullable().optional(),
    startDate: z.string().datetime().nullable().optional(),
    matchesPerDay: z.number().int().positive().max(20).optional(),
    createMatches: z.boolean().optional(),
    officials: z
      .object({
        umpires: z.array(z.number().int().positive()).optional(),
        scorers: z.array(z.number().int().positive()).optional(),
        matchReferee: z.number().int().positive().nullable().optional(),
      })
      .optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const result = await generateScoringDraw({
      tournamentId,
      ...parsed.data,
      createMatches: parsed.data.createMatches ?? true,
    });
    res.status(201).json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Match squads ─────────────────────────────────────────────────────────────

router.get("/matches/:matchId/squads", async (req, res) => {
  const tournamentId = tid(req);
  const matchId = parseInt(req.params.matchId, 10);
  if (!tournamentId || Number.isNaN(matchId)) {
    return void res.status(400).json({ error: "Invalid ID" });
  }
  if (!requireOrganizer(req, res, tournamentId)) return;
  try {
    res.json(await getMatchSquads(tournamentId, matchId));
  } catch (err) {
    handleError(res, err);
  }
});

router.put("/matches/:matchId/squads/:teamId", async (req, res) => {
  const tournamentId = tid(req);
  const matchId = parseInt(req.params.matchId, 10);
  const teamId = parseInt(req.params.teamId, 10);
  if (!tournamentId || Number.isNaN(matchId) || Number.isNaN(teamId)) {
    return void res.status(400).json({ error: "Invalid ID" });
  }
  if (!requireOrganizer(req, res, tournamentId)) return;

  const schema = z.object({
    playingXi: z.array(z.number().int().positive()).min(1).max(11),
    bench: z.array(z.number().int().positive()).max(8).default([]),
    battingOrder: z.array(z.number().int().positive()).optional(),
    captainId: z.number().int().positive().nullable().optional(),
    wicketKeeperId: z.number().int().positive().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    res.json(await setMatchSquad(tournamentId, matchId, teamId, parsed.data));
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
