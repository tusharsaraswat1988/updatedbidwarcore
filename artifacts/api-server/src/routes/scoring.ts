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
  flushAndActivateScoringSseClient,
  getScoringSseClientCount,
  removeScoringSseClient,
  getCricketObsDirectorState,
  broadcastCricketObsDirector,
} from "../lib/scoring-broadcast";
import { buildCricketMatchSummary, InvalidEventPayloadError } from "@workspace/scoring-core";
import { InvalidTournamentModuleStateError } from "@workspace/platform-core";
import { db, scoringMatchesTable, tournamentsTable, cricketBroadcastMessageTemplatesTable, scoringEventsTable } from "@workspace/db";
import { eq, and, desc, asc, or, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  requireSportModule,
  assertSportModule,
  ModuleAuthorizationError,
} from "../middleware/require-module";
import { ensureScoringEnabled, getScoringStandings, getSquadReadiness, rebuildTournamentStandings } from "../lib/scoring-standings";
import {
  getPublicMatchScorecard,
  getTournamentLeaderboard,
  projectMatchPlayerStats,
  projectMatchAwards,
  rebuildTournamentLeaderboards,
  type EnrichedLeaderboardRow,
} from "../lib/scoring-stats-service";
import {
  getGlobalPlayerCricketProfile,
  getTournamentPlayerPublicProfile,
  getTournamentTeamPublicProfile,
  listTournamentAwards,
} from "../lib/scoring-public-service";
import { getGlobalCricketLeaderboard, projectGlobalCricketStatsForMatch } from "../lib/scoring-global-stats-service";
import { advanceTournamentProgression } from "../lib/tournament-progression-service";
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
import {
  listCricketRulePresets,
  getCricketRulePreset,
  createCricketRulePreset,
  updateCricketRulePreset,
  deleteCricketRulePreset,
} from "../lib/cricket-rule-presets-service";

const router = Router();

router.use(scoringFeatureMiddleware);

function parseId(value: string): number | null {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
}

export function parseLastEventId(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  let strVal: string;
  if (Array.isArray(raw)) {
    strVal = String(raw[0] ?? "");
  } else if (typeof raw === "number") {
    return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : undefined;
  } else {
    strVal = String(raw);
  }
  const parsed = parseInt(strVal.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
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
  const [tournament] = await db
    .select({
      id: tournamentsTable.id,
      auctionEnabled: tournamentsTable.auctionEnabled,
      scoringEnabled: tournamentsTable.scoringEnabled,
      sport: tournamentsTable.sport,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  assertSportModule(tournament, "cricket");

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
  if (e instanceof ModuleAuthorizationError) {
    res.status(e.status).json({ error: e.message, code: e.code });
    return true;
  }
  if (e instanceof InvalidTournamentModuleStateError) {
    res.status(400).json({
      error: "A tournament must have at least one enabled product module (auction or scoring).",
      code: "INVALID_MODULE_STATE",
    });
    return true;
  }
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
      e.code === "MATCH_LOCKED" || e.code === "SCORER_LEASE_REVOKED"
        ? "MATCH_LOCKED"
        : e.code === "SCORER_LEASE_STALE"
          ? "SCORER_LEASE_STALE"
          : e.code === "SCORER_LEASE_EXPIRED"
            ? "SCORER_LEASE_EXPIRED"
            : e.code === "SCORER_LEASE_REQUIRED"
              ? "SCORER_LEASE_REQUIRED"
              : "MATCH_LOCK_REQUIRED";
    const status = 409;
    logger.warn({ code, lockCode: e.code, message: e.message }, "SCORING_LOCK_DENIED");
    res.status(status).json({
      error: e.message,
      code,
      leaseCode: e.code,
      message: e.message,
    });
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
  summaryJson?: Record<string, unknown> | null;
  stateJson?: Record<string, unknown> | null;
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
    /** EPIC-Rule-Presets — selected rule preset */
    rulePresetId: (m as { rulePresetId?: number | null }).rulePresetId ?? (bind as { rulePresetId?: number } | undefined)?.rulePresetId ?? null,
    rulePresetName: (bind as { rulePresetName?: string } | undefined)?.rulePresetName ?? null,
    resultSummary: m.resultSummary,
    summaryJson: m.summaryJson ?? null,
    stateJson: m.stateJson ?? null,
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

router.use("/tournaments/:tournamentId/scoring", async (req, res, next) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  const [tournament] = await db
    .select({
      id: tournamentsTable.id,
      auctionEnabled: tournamentsTable.auctionEnabled,
      scoringEnabled: tournamentsTable.scoringEnabled,
      sport: tournamentsTable.sport,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!requireSportModule(res, tournament, "cricket")) return;
  next();
});

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

/** Public SSE stream for live scoreboard updates with durable sequence replay. */
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

  const rawLastId = req.headers["last-event-id"] ?? req.query.lastEventId ?? req.query.sinceSeq;
  const lastEventId = parseLastEventId(rawLastId);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // 1. Register into live client registry first with buffering active so no live events are lost during catchup
  const client = addScoringSseClient(tournamentId, res, lastEventId, { bufferUntilFlush: true });
  logger.info(
    { tournamentId, lastEventId, clientCount: getScoringSseClientCount(tournamentId) },
    "scoring SSE client connected",
  );

  let currentDisplay: Awaited<ReturnType<typeof getLiveScoringDisplay>> | null = null;
  try {
    currentDisplay = await getLiveScoringDisplay(tournamentId);
  } catch {
    currentDisplay = { match: null, state: null, summary: null };
  }

  const activeMatch = currentDisplay?.match;
  const currentState = currentDisplay?.state as { lastSequence?: number } | null;
  const latestSeq = currentState?.lastSequence ?? 0;

  // 2. If client reconnected with a valid lastEventId, replay bounded missed events from DB
  const MAX_SSE_REPLAY_EVENTS = 200;
  if (
    activeMatch &&
    lastEventId !== undefined &&
    lastEventId >= 0 &&
    lastEventId < latestSeq
  ) {
    try {
      const replayFromSeq = Math.max(lastEventId, latestSeq - MAX_SSE_REPLAY_EVENTS);
      const missedEvents = await db
        .select()
        .from(scoringEventsTable)
        .where(
          and(
            eq(scoringEventsTable.tournamentId, tournamentId),
            eq(scoringEventsTable.matchId, activeMatch.id),
            sql`${scoringEventsTable.sequence} > ${replayFromSeq}`,
            sql`${scoringEventsTable.sequence} <= ${latestSeq}`,
          ),
        )
        .orderBy(asc(scoringEventsTable.sequence))
        .limit(MAX_SSE_REPLAY_EVENTS);

      for (const ev of missedEvents) {
        res.write(
          `id: ${ev.sequence}\nevent: scoring_replay\ndata: ${JSON.stringify({
            type: "scoring_replay",
            matchId: ev.matchId,
            sequence: ev.sequence,
            eventType: ev.eventType,
            payload: ev.payloadJson,
            occurredAt: ev.occurredAt.toISOString(),
          })}\n\n`,
        );
      }
    } catch (err) {
      logger.warn({ err, tournamentId, lastEventId }, "Failed to replay missed scoring events");
    }
  }

  // 3. Emit current authoritative state snapshot
  const seqHeader = latestSeq > 0 ? `id: ${latestSeq}\n` : "";
  res.write(
    `${seqHeader}event: scoring_state\ndata: ${JSON.stringify({
      type: "scoring_state",
      sequence: latestSeq,
      ...liveDisplayJson(currentDisplay ?? { match: null, state: null, summary: null }),
    })}\n\n`,
  );

  // 4. Activate client and atomically flush any live events that arrived during catchup (> latestSeq)
  flushAndActivateScoringSseClient(client, latestSeq);

  const currentObs = getCricketObsDirectorState(tournamentId);
  if (
    currentObs &&
    ((currentObs.overlay && currentObs.overlay !== "none") ||
      (currentObs.broadcastMessage && currentObs.broadcastMessage.active))
  ) {
    res.write(
      `event: obs_director\ndata: ${JSON.stringify({
        type: "cricket_obs_director",
        overlay: currentObs.overlay,
        matchId: currentObs.matchId,
        sponsorName: currentObs.sponsorName,
        stageOrGroup: currentObs.stageOrGroup,
        broadcastMessage: currentObs.broadcastMessage,
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
  }, 15000);

  req.on("close", cleanup);
  res.on("close", cleanup);
});

/** POST /tournaments/:tournamentId/scoring/obs-director — trigger overlay, scoring animation, or broadcast message on OBS screens in real time */
router.post("/tournaments/:tournamentId/scoring/obs-director", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  const [tournament] = await db
    .select({
      id: tournamentsTable.id,
      organizerId: tournamentsTable.organizerId,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  const callerIsOrganizer = isTournamentOrganizer(req, tournamentId, tournament.organizerId);
  if (!callerIsOrganizer) {
    try {
      const scorerAuth = await requireScorerFromRequest(req);
      await assertScorerMayAccessTournament(scorerAuth.scorerId, tournamentId);
    } catch (e) {
      if (sendScorerAuthError(res, e)) return;
      res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
      return;
    }
  }

  const body = req.body ?? {};
  const overlay = typeof body.overlay === "string" ? body.overlay : undefined;
  const matchId = typeof body.matchId === "number" ? body.matchId : typeof body.matchId === "string" ? parseInt(body.matchId, 10) : undefined;
  const sponsorName = typeof body.sponsorName === "string" ? body.sponsorName : undefined;
  const stageOrGroup = typeof body.stageOrGroup === "string" ? body.stageOrGroup : undefined;
  const flash = typeof body.flash === "string" ? body.flash : undefined;
  const detail = typeof body.detail === "string" ? body.detail : undefined;
  const messageType = typeof body.messageType === "string" ? body.messageType : undefined;

  let broadcastMessage: { active: boolean; name: string; details: string } | null | undefined = undefined;
  if (body.broadcastMessage !== undefined) {
    if (body.broadcastMessage === null) {
      broadcastMessage = null;
    } else if (typeof body.broadcastMessage === "object") {
      const bm = body.broadcastMessage;
      const active = Boolean(bm.active);
      const name = typeof bm.name === "string" ? bm.name.trim() : "";
      const details = typeof bm.details === "string" ? bm.details.trim() : "";

      if (active) {
        if (!name || name.length > 100) {
          res.status(400).json({ error: "Broadcast message name must be between 1 and 100 characters" });
          return;
        }
        if (!details || details.length > 180) {
          res.status(400).json({ error: "Broadcast message details must be between 1 and 180 characters" });
          return;
        }
      }
      broadcastMessage = {
        active,
        name: name.slice(0, 100),
        details: details.slice(0, 180),
      };
    }
  }

  broadcastCricketObsDirector(tournamentId, {
    overlay,
    matchId: Number.isFinite(matchId) ? matchId : undefined,
    sponsorName,
    stageOrGroup,
    flash,
    detail,
    messageType,
    broadcastMessage,
  });
  res.json({ ok: true, overlay, matchId, sponsorName, stageOrGroup, flash, detail, messageType, broadcastMessage });
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

/** GET /tournaments/:tournamentId/scoring/broadcast-message-templates — list saved templates */
router.get("/tournaments/:tournamentId/scoring/broadcast-message-templates", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  try {
    const templates = await db
      .select()
      .from(cricketBroadcastMessageTemplatesTable)
      .where(eq(cricketBroadcastMessageTemplatesTable.tournamentId, tournamentId))
      .orderBy(asc(cricketBroadcastMessageTemplatesTable.id));

    res.json(templates);
  } catch (err) {
    logger.error({ error: err, tournamentId }, "Failed to list broadcast message templates");
    res.status(500).json({ error: "Failed to list broadcast message templates" });
  }
});

/** POST /tournaments/:tournamentId/scoring/broadcast-message-templates — create template */
router.post("/tournaments/:tournamentId/scoring/broadcast-message-templates", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  const body = req.body ?? {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";

  if (!name || name.length > 100) {
    res.status(400).json({ error: "Name must be between 1 and 100 characters" });
    return;
  }
  if (!details || details.length > 180) {
    res.status(400).json({ error: "Details must be between 1 and 180 characters" });
    return;
  }

  try {
    const [template] = await db
      .insert(cricketBroadcastMessageTemplatesTable)
      .values({
        tournamentId,
        name: name.slice(0, 100),
        details: details.slice(0, 180),
      })
      .returning();

    res.status(201).json(template);
  } catch (err) {
    logger.error({ error: err, tournamentId }, "Failed to create broadcast message template");
    res.status(500).json({ error: "Failed to create broadcast message template" });
  }
});

/** PUT /tournaments/:tournamentId/scoring/broadcast-message-templates/:id — update template */
router.put("/tournaments/:tournamentId/scoring/broadcast-message-templates/:id", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  const templateId = parseId(req.params.id);
  if (tournamentId === null || templateId === null) {
    res.status(400).json({ error: "Invalid tournament or template ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  const body = req.body ?? {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";

  if (!name || name.length > 100) {
    res.status(400).json({ error: "Name must be between 1 and 100 characters" });
    return;
  }
  if (!details || details.length > 180) {
    res.status(400).json({ error: "Details must be between 1 and 180 characters" });
    return;
  }

  try {
    const [updated] = await db
      .update(cricketBroadcastMessageTemplatesTable)
      .set({
        name: name.slice(0, 100),
        details: details.slice(0, 180),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(cricketBroadcastMessageTemplatesTable.id, templateId),
          eq(cricketBroadcastMessageTemplatesTable.tournamentId, tournamentId),
        ),
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    logger.error({ error: err, tournamentId, templateId }, "Failed to update broadcast message template");
    res.status(500).json({ error: "Failed to update broadcast message template" });
  }
});

/** DELETE /tournaments/:tournamentId/scoring/broadcast-message-templates/:id — delete template */
router.delete("/tournaments/:tournamentId/scoring/broadcast-message-templates/:id", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  const templateId = parseId(req.params.id);
  if (tournamentId === null || templateId === null) {
    res.status(400).json({ error: "Invalid tournament or template ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  try {
    const [deleted] = await db
      .delete(cricketBroadcastMessageTemplatesTable)
      .where(
        and(
          eq(cricketBroadcastMessageTemplatesTable.id, templateId),
          eq(cricketBroadcastMessageTemplatesTable.tournamentId, tournamentId),
        ),
      )
      .returning({ id: cricketBroadcastMessageTemplatesTable.id });

    if (!deleted) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ error: err, tournamentId, templateId }, "Failed to delete broadcast message template");
    res.status(500).json({ error: "Failed to delete broadcast message template" });
  }
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

// ─── Rule Presets (EPIC-Rule-Presets) ──────────────────────────────────────────

router.get("/tournaments/:tournamentId/scoring/rule-presets", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  try {
    const presets = await listCricketRulePresets(tournamentId);
    res.json(presets);
  } catch (err) {
    if (err instanceof ScoringServiceError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.post("/tournaments/:tournamentId/scoring/rule-presets", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  const schema = z.object({
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    variantId: z.string().optional(),
    ruleProfileId: z.string().optional(),
    ruleProfileVersion: z.string().optional(),
    ruleOverridesJson: z.record(z.unknown()).nullable().optional(),
    squadRulesJson: z.record(z.unknown()).nullable().optional(),
    isDefault: z.boolean().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const preset = await createCricketRulePreset(tournamentId, parsed.data);
    res.status(201).json(preset);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create rule preset";
    res.status(400).json({ error: msg });
  }
});

router.get("/tournaments/:tournamentId/scoring/rule-presets/:presetId", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  const presetId = parseId(req.params.presetId);
  if (tournamentId === null || presetId === null) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  try {
    const preset = await getCricketRulePreset(tournamentId, presetId);
    if (!preset) {
      res.status(404).json({ error: "Rule Preset not found" });
      return;
    }
    res.json(preset);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to get rule preset";
    res.status(400).json({ error: msg });
  }
});

router.patch("/tournaments/:tournamentId/scoring/rule-presets/:presetId", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  const presetId = parseId(req.params.presetId);
  if (tournamentId === null || presetId === null) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  const schema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    variantId: z.string().optional(),
    ruleProfileId: z.string().optional(),
    ruleProfileVersion: z.string().optional(),
    ruleOverridesJson: z.record(z.unknown()).nullable().optional(),
    squadRulesJson: z.record(z.unknown()).nullable().optional(),
    isDefault: z.boolean().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const updated = await updateCricketRulePreset(tournamentId, presetId, parsed.data);
    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update rule preset";
    res.status(400).json({ error: msg });
  }
});

router.delete("/tournaments/:tournamentId/scoring/rule-presets/:presetId", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  const presetId = parseId(req.params.presetId);
  if (tournamentId === null || presetId === null) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  try {
    const result = await deleteCricketRulePreset(tournamentId, presetId);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(204).send();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete rule preset";
    res.status(400).json({ error: msg });
  }
});

// ─── Scoring Matches ──────────────────────────────────────────────────────────

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
    rulePresetId: z.number().int().positive().nullable().optional(),
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
    rulePresetId: z.number().int().positive().nullable().optional(),
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
    (req.jwtUser as { email?: string } | undefined)?.email ||
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
    leaseId: z.string().optional(),
    leaseVersion: z.number().int().positive().optional(),
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
      lease: {
        scorerId: scorerAuth.scorerId,
        sessionId: scorerAuth.sessionId,
        leaseId: parsed.data.leaseId,
        leaseVersion: parsed.data.leaseVersion,
      },
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
    if (sendScorerLockError(res, err)) return;
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
    leaseId: z.string().optional(),
    leaseVersion: z.number().int().positive().optional(),
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
      lease: {
        scorerId: scorerAuth.scorerId,
        sessionId: scorerAuth.sessionId,
        leaseId: parsed.data.leaseId,
        leaseVersion: parsed.data.leaseVersion,
      },
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
    if (sendScorerLockError(res, err)) return;
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

  // Optional lease meta for reset.
  // scorerPin is intentionally NOT accepted.
  const schema = z
    .object({
      leaseId: z.string().optional(),
      leaseVersion: z.number().int().positive().optional(),
    })
    .optional();
  const parsed = schema?.safeParse(req.body ?? {});
  const leaseMeta = parsed?.success ? parsed.data : undefined;

  let scorerAuth: Awaited<ReturnType<typeof requireScorerForMutation>>;
  try {
    scorerAuth = await requireScorerForMutation(req, tournamentId, matchId);
  } catch (e) {
    if (sendScorerAuthError(res, e)) return;
    if (sendScorerLockError(res, e)) return;
    throw e;
  }

  try {
    const result = await resetCricketMatchSetup(
      tournamentId,
      matchId,
      {
        type: "scorer",
        id: String(scorerAuth.scorerId),
      },
      {
        scorerId: scorerAuth.scorerId,
        sessionId: scorerAuth.sessionId,
        leaseId: leaseMeta?.leaseId,
        leaseVersion: leaseMeta?.leaseVersion,
      },
    );
    res.json({
      match: matchToJson(result.match),
      state: result.state,
      summary: null,
      eventCount: 0,
      lastSequence: 0,
    });
  } catch (err) {
    if (sendScorerLockError(res, err)) return;
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

/**
 * Manual/administrative projection and statistics reconciliation endpoint.
 * Recalculates match player stats, awards, global aggregates, standings, progression, and leaderboards.
 */
router.post("/tournaments/:tournamentId/scoring/reconcile", async (req, res) => {
  const tournamentId = parseId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  const targetMatchId = typeof req.body?.matchId === "number" ? req.body.matchId : undefined;

  try {
    const finishedMatches = await db
      .select({ id: scoringMatchesTable.id })
      .from(scoringMatchesTable)
      .where(
        and(
          eq(scoringMatchesTable.tournamentId, tournamentId),
          eq(scoringMatchesTable.sportSlug, "cricket"),
          targetMatchId !== undefined
            ? eq(scoringMatchesTable.id, targetMatchId)
            : or(
                eq(scoringMatchesTable.status, "completed"),
                eq(scoringMatchesTable.status, "abandoned"),
                eq(scoringMatchesTable.status, "no_result"),
                eq(scoringMatchesTable.status, "walkover"),
              ),
        ),
      );

    for (const m of finishedMatches) {
      await projectMatchPlayerStats(m.id);
      await projectMatchAwards(m.id);
      await projectGlobalCricketStatsForMatch(m.id);
    }

    await rebuildTournamentStandings(tournamentId);
    await advanceTournamentProgression(tournamentId);
    await rebuildTournamentLeaderboards(tournamentId);

    res.json({
      success: true,
      tournamentId,
      reconciledMatchesCount: finishedMatches.length,
      matchIds: finishedMatches.map((m) => m.id),
    });
  } catch (err) {
    logger.error({ error: err, tournamentId }, "Failed to reconcile scoring projections");
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to reconcile tournament scoring",
    });
  }
});

export default router;
