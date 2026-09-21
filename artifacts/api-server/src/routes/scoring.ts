import { Router } from "express";
import { z } from "zod";
import { scoringFeatureMiddleware } from "../lib/scoring-feature";
import {
  isTournamentOrganizer,
  requireTournamentOrganizer,
} from "../middleware/require-organizer";
import {
  appendScoringEvent,
  createScoringMatch,
  deleteCricketMatch,
  updateScoringMatch,
  getLiveScoringDisplay,
  getScoringMatch,
  listScoringMatches,
  resetCricketMatchSetup,
  ScoringServiceError,
  undoLastScoringEvent,
} from "../lib/scoring-service";
import {
  addScoringSseClient,
  getScoringSseClientCount,
  removeScoringSseClient,
  getCricketObsDirectorState,
  broadcastCricketObsDirector,
} from "../lib/scoring-broadcast";
import { buildCricketMatchSummary, InvalidEventPayloadError } from "@workspace/scoring-core";
import { db, scoringMatchesTable, tournamentsTable } from "@workspace/db";
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
  listTournamentAwards,
} from "../lib/scoring-public-service";
import { getGlobalCricketLeaderboard } from "../lib/scoring-global-stats-service";
import type { LeaderboardCategory } from "@workspace/scoring-core";
import { applyCricketRulesToMatches } from "../lib/cricket-rules-service";
import {
  requireScorerFromRequest,
  assertScorerCanScore,
  assertScorerMayAccessTournament,
  ScorerAuthError,
} from "../lib/scorer-auth";
import {
  assertSessionOwnsMatchLock,
  ScorerLockError,
} from "../lib/scorer-match-locks";

const router = Router();

router.use(scoringFeatureMiddleware);

function parseId(value: string): number | null {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
}

/**
 * Resolve and validate the full dedicated-scorer authorization chain for a mutation.
 * This is the ONLY authorized path for cricket scoring mutations.
 *
 * Pipeline:
 *  1. requireScorerFromRequest  — valid scorer JWT (no organizer fallback)
 *  2. assertScorerCanScore      — account is active (not view-only)
 *  3. assertScorerMayAccessTournament — scorer assigned to tournament
 *  4. verify match.tournamentId === tournamentId (tenant isolation)
 *  5. assertSessionOwnsMatchLock — session owns the active match lock
 *
 * Throws ScorerAuthError or ScorerLockError on any failure.
 * Returns the resolved ScorerAuthContext (for audit logging).
 */
async function requireScorerForMutation(
  req: import("express").Request,
  tournamentId: number,
  matchId: number,
) {
  const scorerAuth = await requireScorerFromRequest(req);
  assertScorerCanScore(scorerAuth);
  await assertScorerMayAccessTournament(scorerAuth.scorerId, tournamentId);

  // Tenant isolation: match must belong to the tournament in the URL.
  const [match] = await db
    .select({ tournamentId: scoringMatchesTable.tournamentId })
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.id, matchId))
    .limit(1);

  if (!match) {
    throw new ScorerAuthError("Match not found", "MATCH_NOT_FOUND", 404);
  }
  if (match.tournamentId !== tournamentId) {
    logger.warn(
      {
        scorerId: scorerAuth.scorerId,
        sessionId: scorerAuth.sessionId,
        matchId,
        urlTournamentId: tournamentId,
        actualTournamentId: match.tournamentId,
        reason: "TENANT_MISMATCH",
      },
      "SCORING_AUTH_DENIED: match does not belong to the requested tournament",
    );
    throw new ScorerAuthError(
      "Match does not belong to this tournament",
      "TENANT_MISMATCH",
      403,
    );
  }

  await assertSessionOwnsMatchLock({ matchId, sessionId: scorerAuth.sessionId });

  return scorerAuth;
}

/** Map ScorerAuthError to HTTP response. Returns true if handled. */
function sendScorerAuthError(res: import("express").Response, e: unknown): boolean {
  if (e instanceof ScorerAuthError) {
    logger.warn(
      { code: e.code, status: e.status, message: e.message },
      "SCORING_AUTH_DENIED",
    );
    res.status(e.status).json({ error: e.message, code: e.code });
    return true;
  }
  return false;
}

/** Map ScorerLockError to HTTP response. Returns true if handled. */
function sendScorerLockError(res: import("express").Response, e: unknown): boolean {
  if (e instanceof ScorerLockError) {
    // LOCK_NOT_FOUND → 409 MATCH_LOCK_REQUIRED (no lock at all)
    // MATCH_LOCKED   → 409 MATCH_LOCKED (another session owns it)
    // LOCK_NOT_OWNED → 409 MATCH_LOCK_REQUIRED (own lock but stale)
    const code =
      e.code === "MATCH_LOCKED" ? "MATCH_LOCKED" : "MATCH_LOCK_REQUIRED";
    const status = 409;
    logger.warn({ code, lockCode: e.code, message: e.message }, "SCORING_LOCK_DENIED");
    res.status(status).json({ error: e.message, code });
    return true;
  }
  return false;
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
  rulesJson: Record<string, unknown> | null;
  brandingJson?: Record<string, unknown> | null;
  runtimePrepMetadataJson?: Record<string, unknown> | null;
  currentRuntimeVersion?: number | null;
  winnerTeamId: number | null;
  resultSummary: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  tournamentMatchNumber?: number | null;
}) {
  const prep = m.runtimePrepMetadataJson as
    | {
        ruleResolution?: Record<string, unknown>;
        presentationResolution?: Record<string, unknown>;
      }
    | null
    | undefined;
  const bind = prep?.ruleResolution as
    | {
        resolutionId?: string;
        rulesHash?: string;
        runtimeRulesVersion?: string;
        snapshotVersion?: number;
      }
    | undefined;
  const presentationBind = prep?.presentationResolution as
    | {
        presentationResolutionId?: string;
        presentationHash?: string;
        presentationVersion?: string;
        snapshotVersion?: number;
      }
    | undefined;

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
    /**
     * EPIC-12 Phase 1 — Compatibility Adapter paint DTO (temporary).
     * source === "presentation_execution_policy" when Prepare-bound.
     */
    branding: m.brandingJson ?? null,
    /** Session-facing Rule Policy identity — no Rule Engine import. */
    executionPolicyBind: bind
      ? {
          resolutionId: bind.resolutionId ?? null,
          rulesHash: bind.rulesHash ?? null,
          runtimeRulesVersion: bind.runtimeRulesVersion ?? null,
          snapshotVersion: bind.snapshotVersion ?? m.currentRuntimeVersion ?? null,
        }
      : null,
    /** Session-facing Presentation identity — no Presentation Engine import. */
    presentationPolicyBind: presentationBind
      ? {
          presentationResolutionId: presentationBind.presentationResolutionId ?? null,
          presentationHash: presentationBind.presentationHash ?? null,
          presentationVersion: presentationBind.presentationVersion ?? null,
          snapshotVersion:
            presentationBind.snapshotVersion ?? m.currentRuntimeVersion ?? null,
        }
      : null,
    winnerTeamId: m.winnerTeamId,
    resultSummary: m.resultSummary,
    startedAt: m.startedAt?.toISOString() ?? null,
    completedAt: m.completedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    /** Tournament-scoped sequential match number (1 = first match created in this tournament). */
    tournamentMatchNumber: m.tournamentMatchNumber ?? null,
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
    res.json({
      standings,
      hasGroups: (standings as unknown as { hasGroups?: boolean }).hasGroups ?? false,
      groups: (standings as unknown as { groups?: unknown[] }).groups ?? [],
    });
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

/** Squad readiness from Player Registry franchise roster (organizer). */
router.get("/tournaments/:tournamentId/scoring/squads", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  try {
    const squads = await getSquadReadiness(tournamentId);
    res.json({ squads, minPlayingXi: null });
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

  const currentObs = getCricketObsDirectorState(tournamentId);
  if (currentObs && currentObs.overlay && currentObs.overlay !== "none") {
    res.write(
      `data: ${JSON.stringify({
        type: "cricket_obs_director",
        overlay: currentObs.overlay,
        timestamp: Date.now(),
      })}\n\n`,
    );
  }

  const cleanup = () => {
    clearInterval(heartbeat);
    removeScoringSseClient(client);
    req.off("close", cleanup);
    res.off("close", cleanup);
    logger.info(
      { tournamentId, clientCount: getScoringSseClientCount(tournamentId) },
      "scoring SSE client disconnected",
    );
  };

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      cleanup();
    }
  }, 20000);

  req.on("close", cleanup);
  res.on("close", cleanup);
});

/** POST /tournaments/:tournamentId/scoring/obs-director — trigger overlay or scoring animation on OBS screens in real time */
router.post("/tournaments/:tournamentId/scoring/obs-director", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  const body = req.body ?? {};
  const overlay = typeof body.overlay === "string" ? body.overlay : undefined;
  const flash = typeof body.flash === "string" ? body.flash : undefined;
  const detail = typeof body.detail === "string" ? body.detail : undefined;

  broadcastCricketObsDirector(tournamentId, { overlay, flash, detail });
  res.json({ ok: true, overlay, flash, detail });
});

/** GET /tournaments/:tournamentId/scoring/obs-director — get current OBS overlay state */
router.get("/tournaments/:tournamentId/scoring/obs-director", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  const state = getCricketObsDirectorState(tournamentId);
  res.json(state);
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

router.patch("/tournaments/:tournamentId/scoring/matches/:matchId", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  const matchId = parseId(req.params.matchId);
  if (tournamentId === null || matchId === null) {
    res.status(400).json({ error: "Invalid tournament or match ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  const schema = z.object({
    homeTeamId: z.number().int().positive().optional(),
    awayTeamId: z.number().int().positive().optional(),
    oversLimit: z.number().int().positive().max(50).optional(),
    roundName: z.string().nullable().optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
    venue: z.string().nullable().optional(),
    resultSummary: z.string().nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await updateScoringMatch(tournamentId, matchId, parsed.data);
    res.json({
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

router.delete("/tournaments/:tournamentId/scoring/matches/:matchId", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  const matchId = parseId(req.params.matchId);
  if (tournamentId === null || matchId === null) {
    res.status(400).json({ error: "Invalid tournament or match ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  try {
    await deleteCricketMatch(tournamentId, matchId);
    res.status(204).send();
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

/** Lock Rules & format → ready draws + prepare all cricket matches for Start. */
router.post("/tournaments/:tournamentId/scoring/rules/apply-to-matches", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  const actor =
    req.jwtUser?.email ||
    (req.jwtUser?.organizerAccountId != null
      ? `organizer:${req.jwtUser.organizerAccountId}`
      : req.jwtUser?.isAdmin
        ? "admin"
        : null);

  const result = await applyCricketRulesToMatches(tournamentId, actor);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json(result);
});

router.get("/tournaments/:tournamentId/scoring/matches/:matchId", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  const matchId = parseId(req.params.matchId);
  if (tournamentId === null || matchId === null) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  // Allow either organizer JWT or dedicated scorer JWT to read a single match (read-only).
  // We check both identities manually to avoid requireTournamentOrganizer writing a 403
  // response before the scorer fallback is attempted.
  const [tournament] = await db
    .select({ organizerId: tournamentsTable.organizerId })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  const callerIsOrganizer = !!tournament && isTournamentOrganizer(req, tournamentId, tournament.organizerId);
  if (!callerIsOrganizer) {
    // Not an organizer — require a valid dedicated scorer session.
    try {
      const scorerAuth = await requireScorerFromRequest(req);
      await assertScorerMayAccessTournament(scorerAuth.scorerId, tournamentId);
    } catch (e) {
      if (sendScorerAuthError(res, e)) return;
      res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
      return;
    }
  }

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

/**
 * POST /tournaments/:tournamentId/scoring/matches/:matchId/events
 *
 * ONLY dedicated scorers with a valid JWT + tournament assignment + active match lock
 * may submit scoring events. Organizer JWT is NOT accepted here.
 */
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
    correlationId: z.string().uuid().optional(),
    // scorerPin is intentionally NOT accepted — legacy field removed from mutation path.
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let scorerAuth: Awaited<ReturnType<typeof requireScorerForMutation>>;
  try {
    scorerAuth = await requireScorerForMutation(req, tournamentId, matchId);
  } catch (e) {
    if (sendScorerAuthError(res, e)) return;
    if (sendScorerLockError(res, e)) return;
    throw e;
  }

  try {
    const result = await appendScoringEvent(tournamentId, matchId, {
      eventType: parsed.data.eventType,
      payload: parsed.data.payload,
      expectedSequence: parsed.data.expectedSequence,
      correlationId: parsed.data.correlationId,
      actor: { type: "scorer", id: String(scorerAuth.scorerId) },
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

/**
 * POST /tournaments/:tournamentId/scoring/matches/:matchId/undo
 *
 * ONLY dedicated scorers with a valid JWT + tournament assignment + active match lock.
 */
router.post("/tournaments/:tournamentId/scoring/matches/:matchId/undo", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  const matchId = parseId(req.params.matchId);
  if (tournamentId === null || matchId === null) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const schema = z.object({
    expectedSequence: z.number().int().min(0),
    // scorerPin intentionally NOT accepted.
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let scorerAuth: Awaited<ReturnType<typeof requireScorerForMutation>>;
  try {
    scorerAuth = await requireScorerForMutation(req, tournamentId, matchId);
  } catch (e) {
    if (sendScorerAuthError(res, e)) return;
    if (sendScorerLockError(res, e)) return;
    throw e;
  }

  try {
    const result = await undoLastScoringEvent(tournamentId, matchId, {
      expectedSequence: parsed.data.expectedSequence,
      actor: { type: "scorer", id: String(scorerAuth.scorerId) },
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

/**
 * POST /tournaments/:tournamentId/scoring/matches/:matchId/reset
 *
 * ONLY dedicated scorers with a valid JWT + tournament assignment + active match lock.
 */
router.post("/tournaments/:tournamentId/scoring/matches/:matchId/reset", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  const matchId = parseId(req.params.matchId);
  if (tournamentId === null || matchId === null) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  // No body required for reset, but parse gracefully.
  // scorerPin is intentionally NOT accepted.

  let scorerAuth: Awaited<ReturnType<typeof requireScorerForMutation>>;
  try {
    scorerAuth = await requireScorerForMutation(req, tournamentId, matchId);
  } catch (e) {
    if (sendScorerAuthError(res, e)) return;
    if (sendScorerLockError(res, e)) return;
    throw e;
  }

  try {
    const result = await resetCricketMatchSetup(tournamentId, matchId, {
      type: "scorer",
      id: String(scorerAuth.scorerId),
    });
    res.json({
      match: matchToJson(result.match),
      state: result.state,
      summary: null,
      eventCount: 0,
      lastSequence: 0,
    });
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

/** Tournament awards (MoM etc.) — public read of projected awards. */
router.get("/tournaments/:tournamentId/scoring/awards", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  try {
    const awards = await listTournamentAwards(tournamentId);
    res.json({ awards });
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
