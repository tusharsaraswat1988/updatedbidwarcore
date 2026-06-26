import { Router, type Request } from "express";
import { z } from "zod";
import { scoringFeatureMiddleware } from "../lib/scoring-feature";
import { isTournamentOrganizer, requireTournamentOrganizer } from "../middleware/require-organizer";
import {
  appendScoringEvent,
  createScoringMatch,
  getLiveScoringDisplay,
  getScoringMatch,
  listScoringMatches,
  ScoringServiceError,
  undoLastScoringEvent,
} from "../lib/scoring-service";
import {
  addScoringSseClient,
  getScoringSseClientCount,
  removeScoringSseClient,
} from "../lib/scoring-broadcast";
import { buildCricketMatchSummary, InvalidEventPayloadError } from "@workspace/scoring-core";
import { db, tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { ensureScoringEnabled, getScoringStandings, getSquadReadiness } from "../lib/scoring-standings";
import {
  getPublicMatchScorecard,
  getTournamentLeaderboard,
  type EnrichedLeaderboardRow,
} from "../lib/scoring-stats-service";
import {
  getGlobalPlayerCricketProfile,
  getTournamentPlayerPublicProfile,
  getTournamentTeamPublicProfile,
} from "../lib/scoring-public-service";
import { getGlobalCricketLeaderboard } from "../lib/scoring-global-stats-service";
import type { LeaderboardCategory } from "@workspace/scoring-core";

const router = Router();

router.use(scoringFeatureMiddleware);

function parseId(value: string): number | null {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
}

function actorFromRequest(req: Request, usedPin: boolean) {
  if (req.jwtUser?.isAdmin) {
    return { type: "admin" as const, id: "admin" };
  }
  if (usedPin) {
    return { type: "scorer_pin" as const, id: "pin" };
  }
  return { type: "organizer" as const, id: req.jwtUser?.organizerAccountId?.toString() ?? "organizer" };
}

async function canWriteScoring(
  req: Request,
  tournamentId: number,
  scorerPin?: string,
): Promise<{ ok: true; usedPin: boolean } | { ok: false }> {
  const [tournament] = await db
    .select({ organizerId: tournamentsTable.organizerId, scoringPin: tournamentsTable.scoringPin })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (tournament && isTournamentOrganizer(req, tournamentId, tournament.organizerId)) {
    return { ok: true, usedPin: false };
  }
  if (!scorerPin) return { ok: false };

  if (tournament?.scoringPin && tournament.scoringPin === scorerPin) {
    return { ok: true, usedPin: true };
  }
  return { ok: false };
}

function matchToJson(m: {
  id: number;
  tournamentId: number;
  fixtureId: number | null;
  sportSlug: string;
  status: string;
  homeTeamId: number;
  awayTeamId: number;
  roundName: string | null;
  scheduledAt: Date | null;
  venue: string | null;
  rulesJson: { overs?: number; maxWickets?: number } | null;
  winnerTeamId: number | null;
  resultSummary: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: m.id,
    tournamentId: m.tournamentId,
    fixtureId: m.fixtureId,
    sportSlug: m.sportSlug,
    status: m.status,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    roundName: m.roundName,
    scheduledAt: m.scheduledAt?.toISOString() ?? null,
    venue: m.venue,
    rules: m.rulesJson,
    winnerTeamId: m.winnerTeamId,
    resultSummary: m.resultSummary,
    startedAt: m.startedAt?.toISOString() ?? null,
    completedAt: m.completedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

function liveDisplayJson(result: Awaited<ReturnType<typeof getLiveScoringDisplay>>) {
  if (!result.match || !result.state) {
    return { match: null, state: null, summary: null };
  }
  return {
    match: matchToJson(result.match),
    state: result.state,
    summary: result.summary,
  };
}

const LEADERBOARD_CATEGORIES = new Set<LeaderboardCategory>([
  "runs",
  "wickets",
  "sixes",
  "fours",
  "strike_rate",
  "economy",
  "catches",
  "stumpings",
]);

/** Public tournament leaderboards (no auth). */
router.get("/tournaments/:tournamentId/scoring/leaderboards/:category", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  const category = req.params.category as LeaderboardCategory;
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!LEADERBOARD_CATEGORIES.has(category)) {
    res.status(400).json({ error: "Invalid leaderboard category" });
    return;
  }

  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 50);

  try {
    const rows: EnrichedLeaderboardRow[] = await getTournamentLeaderboard(
      tournamentId,
      category,
      limit,
    );
    res.json({ category, rows });
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

/** Public full scorecard for a match (no auth). */
router.get(
  "/tournaments/:tournamentId/scoring/matches/:matchId/scorecard",
  async (req, res) => {
    const tournamentId = parseId(req.params.tournamentId);
    const matchId = parseId(req.params.matchId);
    if (tournamentId === null || matchId === null) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    try {
      const result = await getPublicMatchScorecard(tournamentId, matchId);
      res.json(result);
    } catch (err) {
      if (err instanceof ScoringServiceError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  },
);

/** Public points table (no auth). */
router.get("/tournaments/:tournamentId/scoring/standings", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  try {
    const standings = await getScoringStandings(tournamentId);
    res.json({ standings });
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

/** Squad readiness from auction sold/retained players (organizer). */
router.get("/tournaments/:tournamentId/scoring/squads", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  try {
    const squads = await getSquadReadiness(tournamentId);
    res.json({ squads, minPlayingXi: 11 });
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

/** Public snapshot for LED display (no auth). */
router.get("/tournaments/:tournamentId/scoring/live", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  try {
    const display = await getLiveScoringDisplay(tournamentId);
    res.json(liveDisplayJson(display));
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

/** Public SSE stream for live scoreboard updates. */
router.get("/tournaments/:tournamentId/scoring/events", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  try {
    await ensureScoringEnabled(tournamentId);
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const client = addScoringSseClient(tournamentId, res);
  logger.info(
    { tournamentId, clientCount: getScoringSseClientCount(tournamentId) },
    "scoring SSE client connected",
  );

  try {
    const display = await getLiveScoringDisplay(tournamentId);
    res.write(`data: ${JSON.stringify({ type: "scoring_state", ...liveDisplayJson(display) })}\n\n`);
  } catch {
    res.write(`data: ${JSON.stringify({ type: "scoring_state", match: null, state: null, summary: null })}\n\n`);
  }

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeScoringSseClient(client);
    logger.info(
      { tournamentId, clientCount: getScoringSseClientCount(tournamentId) },
      "scoring SSE client disconnected",
    );
  });
});

router.get("/tournaments/:tournamentId/scoring/matches", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  try {
    const matches = await listScoringMatches(tournamentId);
    res.json(matches.map(matchToJson));
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.post("/tournaments/:tournamentId/scoring/matches", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  const schema = z.object({
    homeTeamId: z.number().int().positive(),
    awayTeamId: z.number().int().positive(),
    fixtureId: z.number().int().positive().nullable().optional(),
    oversLimit: z.number().int().positive().max(50).optional(),
    roundName: z.string().nullable().optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
    venue: z.string().nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await createScoringMatch(tournamentId, parsed.data);
    res.status(201).json({
      match: matchToJson(result.match),
      state: result.state,
    });
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/tournaments/:tournamentId/scoring/matches/:matchId", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  const matchId = parseId(req.params.matchId);
  if (tournamentId === null || matchId === null) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  try {
    const result = await getScoringMatch(tournamentId, matchId);
    const summary =
      result.match.summaryJson ??
      (result.state.matchStatus === "completed" || result.state.matchStatus === "abandoned"
        ? buildCricketMatchSummary(result.state)
        : null);
    res.json({
      match: matchToJson(result.match),
      state: result.state,
      summary,
      eventCount: result.events.length,
      lastSequence: result.state.lastSequence,
    });
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof InvalidEventPayloadError) {
      res.status(422).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.post("/tournaments/:tournamentId/scoring/matches/:matchId/events", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  const matchId = parseId(req.params.matchId);
  if (tournamentId === null || matchId === null) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const schema = z.object({
    eventType: z.string().min(1),
    payload: z.record(z.unknown()),
    expectedSequence: z.number().int().min(0),
    scorerPin: z.string().optional(),
    correlationId: z.string().uuid().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const auth = await canWriteScoring(req, tournamentId, parsed.data.scorerPin);
  if (!auth.ok) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const result = await appendScoringEvent(tournamentId, matchId, {
      eventType: parsed.data.eventType,
      payload: parsed.data.payload,
      expectedSequence: parsed.data.expectedSequence,
      correlationId: parsed.data.correlationId,
      actor: actorFromRequest(req, auth.usedPin),
    });
    res.status(201).json({
      event: {
        id: result.event.id,
        eventType: result.event.eventType,
        sequence: result.event.sequence,
        payload: result.event.payload,
      },
      state: result.state,
      match: matchToJson(result.match),
    });
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.post("/tournaments/:tournamentId/scoring/matches/:matchId/undo", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  const matchId = parseId(req.params.matchId);
  if (tournamentId === null || matchId === null) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const schema = z.object({
    expectedSequence: z.number().int().min(0),
    scorerPin: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const auth = await canWriteScoring(req, tournamentId, parsed.data.scorerPin);
  if (!auth.ok) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const result = await undoLastScoringEvent(tournamentId, matchId, {
      expectedSequence: parsed.data.expectedSequence,
      actor: actorFromRequest(req, auth.usedPin),
    });
    res.status(201).json({
      event: {
        id: result.event.id,
        eventType: result.event.eventType,
        sequence: result.event.sequence,
        payload: result.event.payload,
      },
      state: result.state,
      match: matchToJson(result.match),
    });
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

/** Public tournament player profile (stats + MoM awards). */
router.get("/tournaments/:tournamentId/scoring/public/players/:playerId", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  const playerId = parseId(req.params.playerId);
  if (tournamentId === null || playerId === null) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  try {
    res.json(await getTournamentPlayerPublicProfile(tournamentId, playerId));
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

/** Public tournament team profile (squad + results). */
router.get("/tournaments/:tournamentId/scoring/public/teams/:teamId", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  const teamId = parseId(req.params.teamId);
  if (tournamentId === null || teamId === null) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  try {
    res.json(await getTournamentTeamPublicProfile(tournamentId, teamId));
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

/** Global cricket player career profile (public). */
router.get("/global-players/:globalPlayerId/cricket-profile", async (req, res) => {
  const globalPlayerId = String(req.params.globalPlayerId || "").trim();
  if (!globalPlayerId) {
    res.status(400).json({ error: "Invalid player ID" });
    return;
  }

  try {
    res.json(await getGlobalPlayerCricketProfile(globalPlayerId));
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

/** Global cricket career leaderboards (public, cross-tournament). */
router.get("/cricket/global-leaderboards/:category", async (req, res) => {
  const category = req.params.category as LeaderboardCategory;
  if (!LEADERBOARD_CATEGORIES.has(category)) {
    res.status(400).json({ error: "Invalid leaderboard category" });
    return;
  }

  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 50);

  try {
    const rows = await getGlobalCricketLeaderboard(category, limit);
    res.json({ category, rows });
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

export default router;
