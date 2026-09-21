import {
  db,
  matchConfigurationHistoryTable,
  runtimeMatchHistoryTable,
  scorerMatchLocksTable,
  scoringDlsCalculationsTable,
  scoringEventsTable,
  scoringMatchesTable,
  scoringMatchPlayerStatsTable,
  scoringMatchSquadsTable,
  scoringPlayerAwardsTable,
  scoringSessionsTable,
  tournamentsTable,
} from "@workspace/db";
import {
  CricketEventType,
  buildCricketMatchSummary,
  buildMatchMetaFromRules,
  createInitialCricketState,
  deriveCricketMatchResult,
  type MatchMeta,
  type CricketScoreboardState,
  type CricketMatchSummary,
  type CricketMatchRulesJson,
  RUNTIME_EXECUTION_POLICY_SOURCE,
} from "@workspace/scoring-core";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { verifyMatchStartContract } from "@workspace/platform-core/rule-engine";
import { verifyPresentationMatchStartContract } from "@workspace/platform-core/presentation-engine";
import { replayScoringMatchState } from "./scoring-platform";
import { ScoringPlatformError } from "./scoring-platform/errors";
import { broadcastScoringState } from "./scoring-broadcast";
import {
  appendSingleMatchEvent,
  type ScoringActor,
} from "./scoring-platform/orchestrator";
import { loadMatchEvents } from "./scoring-platform/event-store";
import { cricketFranchiseTeamExists } from "./master-sports/cricket-franchise-registry";
import { listCricketMasterTeams } from "./master-sports/cricket-roster";
import { prepareRuntimeMatch } from "./runtime-match-service";

export type { ScoringActor };

export class ScoringServiceError extends ScoringPlatformError {
  constructor(message: string, status: number, code?: string) {
    super(message, status, code);
    this.name = "ScoringServiceError";
  }
}

function mapPlatformError<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err) => {
    if (err instanceof ScoringPlatformError) {
      throw new ScoringServiceError(err.message, err.status, err.code);
    }
    throw err;
  });
}

const CRICKET_SPORT_SLUG = "cricket" as const;

function matchMetaFromRow(
  match: typeof scoringMatchesTable.$inferSelect,
): MatchMeta {
  const rules = (match.rulesJson ?? {}) as CricketMatchRulesJson;
  const prep = match.runtimePrepMetadataJson as
    | { ruleResolution?: Record<string, unknown> }
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

  return buildMatchMetaFromRules({
    matchId: match.id,
    tournamentId: match.tournamentId,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    rules,
    ruleResolution: bind ?? null,
    matchTypeId: match.matchTypeId,
  });
}

async function projectMatchState(
  match: typeof scoringMatchesTable.$inferSelect,
): Promise<CricketScoreboardState> {
  const events = await loadMatchEvents(match.id);
  const state = replayScoringMatchState<CricketScoreboardState>(
    CRICKET_SPORT_SLUG,
    matchMetaFromRow(match),
    events,
  );
  const lastSeq = events.length > 0 ? events[events.length - 1]!.sequence : 0;
  return { ...state, lastSequence: lastSeq };
}

async function ensureTournamentScoring(tournamentId: number) {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  if (!tournament) {
    throw new ScoringServiceError(
      "Tournament not found",
      404,
      "TOURNAMENT_NOT_FOUND",
    );
  }
  if (!tournament.scoringEnabled) {
    throw new ScoringServiceError(
      "Scoring is not enabled for this tournament",
      403,
      "SCORING_DISABLED",
    );
  }
  if (tournament.sport !== CRICKET_SPORT_SLUG) {
    throw new ScoringServiceError(
      "Only cricket scoring is supported in V1",
      400,
      "UNSUPPORTED_SPORT",
    );
  }
  return tournament;
}

async function ensureTeamInTournament(tournamentId: number, teamId: number) {
  const ok = await cricketFranchiseTeamExists(tournamentId, teamId);
  if (!ok) {
    throw new ScoringServiceError(
      "That team is not available for Sports yet. Make teams & players available before creating matches.",
      400,
      "ROSTER_NOT_READY",
    );
  }
}

/** Block match create when Auction → Sports handoff has not produced a usable roster. */
export async function assertCricketSportsRosterReady(
  tournamentId: number,
): Promise<void> {
  const teams = await listCricketMasterTeams(tournamentId);
  const withSquad = teams.filter((t) => t.squadCount > 0);
  if (teams.length < 2 || withSquad.length < 2) {
    throw new ScoringServiceError(
      "Teams & players are not ready yet. Make teams & players available before creating matches.",
      400,
      "ROSTER_NOT_READY",
    );
  }
}

export async function createScoringMatch(
  tournamentId: number,
  input: {
    homeTeamId: number;
    awayTeamId: number;
    fixtureId?: number | null;
    oversLimit?: number;
    roundName?: string | null;
    scheduledAt?: string | null;
    venue?: string | null;
  },
) {
  const tournament = await ensureTournamentScoring(tournamentId);
  if (input.homeTeamId === input.awayTeamId) {
    throw new ScoringServiceError(
      "Home and away teams must differ",
      400,
      "INVALID_TEAMS",
    );
  }
  await assertCricketSportsRosterReady(tournamentId);
  await ensureTeamInTournament(tournamentId, input.homeTeamId);
  await ensureTeamInTournament(tournamentId, input.awayTeamId);

  // Non-authoritative placeholder only. Runtime Prepare overwrites rulesJson
  // from RuntimeExecutionPolicy via the Compatibility Adapter (EPIC-11 Phase 1).
  // Match Create must never be the source of gameplay rules.
  const placeholderRules =
    input.oversLimit != null
      ? { overs: input.oversLimit, maxWickets: 10 }
      : { maxWickets: 10 };

  const [match] = await db
    .insert(scoringMatchesTable)
    .values({
      tournamentId,
      fixtureId: input.fixtureId ?? null,
      sportSlug: "cricket",
      matchKind: "team_match",
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      homeSideJson: { teamId: input.homeTeamId },
      awaySideJson: { teamId: input.awayTeamId },
      rulesJson: placeholderRules,
      roundName: input.roundName ?? null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      venue: input.venue ?? null,
      status: "scheduled",
    })
    .returning();

  const initialState = createInitialCricketState(matchMetaFromRow(match));

  await db.insert(scoringSessionsTable).values({
    matchId: match.id,
    tournamentId,
    status: "idle",
    stateJson: initialState,
    lastEventSeq: 0,
  });

  // Organiser mental model: tournament rules already exist at match create.
  // Best-effort Runtime Prepare freezes those rules so Match Start is not blocked
  // by a separate "Mission Control → Prepare" step. Create still succeeds if
  // Prepare cannot run yet (e.g. competition profile not locked).
  const prepared = await prepareRuntimeMatch(tournamentId, match.id, null);
  if (prepared.ok) {
    const [refreshed] = await db
      .select()
      .from(scoringMatchesTable)
      .where(eq(scoringMatchesTable.id, match.id))
      .limit(1);
    if (refreshed) {
      const preparedState = createInitialCricketState(
        matchMetaFromRow(refreshed),
      );
      await db
        .update(scoringSessionsTable)
        .set({ stateJson: preparedState })
        .where(eq(scoringSessionsTable.matchId, match.id));
      return { match: refreshed, state: preparedState };
    }
  }

  return { match, state: initialState };
}

export async function updateScoringMatch(
  tournamentId: number,
  matchId: number,
  input: {
    oversLimit?: number;
    roundName?: string | null;
    venue?: string | null;
    scheduledAt?: string | null;
    homeTeamId?: number;
    awayTeamId?: number;
    resultSummary?: string | null;
  },
) {
  await ensureTournamentScoring(tournamentId);

  const [existing] = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new ScoringServiceError("Match not found", 404, "MATCH_NOT_FOUND");
  }

  // If match has already started or toss made, teams cannot be altered (as player lineups and toss are tied to teams)
  const isStarted = existing.status !== "scheduled" && existing.status !== "draft";
  if (isStarted && (input.homeTeamId !== undefined || input.awayTeamId !== undefined)) {
    throw new ScoringServiceError(
      "Cannot change teams after the match has started or toss has been made. Display metadata (overs, venue, round name, scheduled time, result summary) can still be edited.",
      400,
      "TEAMS_LOCKED_AFTER_START",
    );
  }

  const patch: Partial<typeof scoringMatchesTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.roundName !== undefined) patch.roundName = input.roundName;
  if (input.venue !== undefined) patch.venue = input.venue;
  if (input.resultSummary !== undefined) patch.resultSummary = input.resultSummary;
  if (input.scheduledAt !== undefined) {
    patch.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  }
  if (input.homeTeamId !== undefined) {
    await ensureTeamInTournament(tournamentId, input.homeTeamId);
    patch.homeTeamId = input.homeTeamId;
    patch.homeSideJson = { teamId: input.homeTeamId };
  }
  if (input.awayTeamId !== undefined) {
    await ensureTeamInTournament(tournamentId, input.awayTeamId);
    patch.awayTeamId = input.awayTeamId;
    patch.awaySideJson = { teamId: input.awayTeamId };
  }

  if (input.oversLimit !== undefined && input.oversLimit > 0) {
    const prevRules = (existing.rulesJson ?? {}) as Record<string, unknown>;
    patch.rulesJson = {
      ...prevRules,
      overs: input.oversLimit,
    };
  }

  await db
    .update(scoringMatchesTable)
    .set(patch)
    .where(eq(scoringMatchesTable.id, matchId));

  // Re-run runtime prepare to freeze/refresh rules & sessions
  await prepareRuntimeMatch(tournamentId, matchId, null);

  const [refreshed] = await db
    .select()
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.id, matchId))
    .limit(1);

  const targetMatch = refreshed ?? existing;
  const events = await loadMatchEvents(matchId);

  // If match already has events (toss done or scoring done), re-project state so we don't wipe innings/balls!
  let refreshedState: CricketScoreboardState;
  if (events.length > 0) {
    refreshedState = await projectMatchState(targetMatch);
  } else {
    refreshedState = createInitialCricketState(
      matchMetaFromRow(targetMatch),
    );
  }

  await db
    .update(scoringSessionsTable)
    .set({ stateJson: refreshedState, updatedAt: new Date() })
    .where(eq(scoringSessionsTable.matchId, matchId));

  const summary = summaryFromMatch(targetMatch, refreshedState);

  // Broadcast updated match and state to all live scoreboards, LED displays, and OBS overlays
  broadcastScoringState(tournamentId, {
    type: "scoring_state",
    matchId: targetMatch.id,
    match: {
      id: targetMatch.id,
      status: targetMatch.status,
      homeTeamId: targetMatch.homeTeamId,
      awayTeamId: targetMatch.awayTeamId,
      winnerTeamId: targetMatch.winnerTeamId,
      resultSummary: targetMatch.resultSummary,
    },
    state: refreshedState,
    summary,
  });

  return { match: targetMatch, state: refreshedState };
}

/**
 * Organizer-level match deletion.
 *
 * Safe to delete when:
 *  - Match is still in "scheduled" state (toss not done), OR
 *  - Match has been started/tossed BUT 0 balls have been recorded
 *    (stuck in "live"/"paused" with no actual play — e.g. toss setup abandoned).
 *
 * Blocked when:
 *  - Match is completed or abandoned (use result correction flows), OR
 *  - Match has at least 1 ball recorded (real play has happened).
 */
export async function deleteCricketMatch(
  tournamentId: number,
  matchId: number,
  _actor?: ScoringActor,
) {
  await ensureTournamentScoring(tournamentId);

  const [match] = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, CRICKET_SPORT_SLUG),
      ),
    )
    .limit(1);

  if (!match) {
    throw new ScoringServiceError("Match not found", 404, "MATCH_NOT_FOUND");
  }

  // Completed / abandoned matches cannot be deleted via this API
  if (match.status === "completed" || match.status === "abandoned") {
    throw new ScoringServiceError(
      "Cannot delete a match that has been completed or abandoned.",
      409,
      "MATCH_ALREADY_COMPLETED",
    );
  }

  // For matches that have started (toss/live/paused), only allow deletion if 0 balls recorded
  const events = await loadMatchEvents(matchId);
  const hasBallRecorded = events.some(
    (e) => e.eventType === CricketEventType.BALL_RECORDED,
  );
  if (hasBallRecorded) {
    throw new ScoringServiceError(
      "Cannot delete a match where balls have already been recorded. Matches can only be deleted if no balls have been bowled.",
      409,
      "BALLS_ALREADY_RECORDED",
    );
  }

  // Transactionally delete all dependent rows and the match row itself
  await db.transaction(async (tx) => {
    await tx.delete(scoringEventsTable).where(eq(scoringEventsTable.matchId, matchId));
    await tx.delete(scoringSessionsTable).where(eq(scoringSessionsTable.matchId, matchId));
    await tx.delete(scoringMatchSquadsTable).where(eq(scoringMatchSquadsTable.matchId, matchId));
    await tx.delete(scoringMatchPlayerStatsTable).where(eq(scoringMatchPlayerStatsTable.matchId, matchId));
    await tx.delete(scoringPlayerAwardsTable).where(eq(scoringPlayerAwardsTable.matchId, matchId));
    await tx.delete(scoringDlsCalculationsTable).where(eq(scoringDlsCalculationsTable.matchId, matchId));
    await tx.delete(matchConfigurationHistoryTable).where(eq(matchConfigurationHistoryTable.matchId, matchId));
    await tx.delete(runtimeMatchHistoryTable).where(eq(runtimeMatchHistoryTable.matchId, matchId));
    await tx.delete(scorerMatchLocksTable).where(eq(scorerMatchLocksTable.matchId, matchId));

    await tx
      .delete(scoringMatchesTable)
      .where(
        and(
          eq(scoringMatchesTable.id, matchId),
          eq(scoringMatchesTable.tournamentId, tournamentId),
        ),
      );
  });

  return { ok: true, deletedMatchId: matchId };
}

function summaryFromMatch(
  match: typeof scoringMatchesTable.$inferSelect,
  state: CricketScoreboardState,
): CricketMatchSummary {
  if (match.summaryJson && typeof match.summaryJson === "object") {
    return match.summaryJson as CricketMatchSummary;
  }
  return buildCricketMatchSummary(state);
}

/** Live, paused, or most recently finished match for LED / public display. */
export async function getLiveScoringDisplay(tournamentId: number) {
  await ensureTournamentScoring(tournamentId);

  const [activeMatch] = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, CRICKET_SPORT_SLUG),
        inArray(scoringMatchesTable.status, ["live", "paused"]),
      ),
    )
    .orderBy(
      sql`CASE WHEN ${scoringMatchesTable.status} = 'live' THEN 1 ELSE 2 END`,
      desc(scoringMatchesTable.startedAt),
    )
    .limit(1);

  let match = activeMatch;
  if (!match) {
    const [recent] = await db
      .select()
      .from(scoringMatchesTable)
      .where(
        and(
          eq(scoringMatchesTable.tournamentId, tournamentId),
          eq(scoringMatchesTable.sportSlug, CRICKET_SPORT_SLUG),
          inArray(scoringMatchesTable.status, ["completed", "abandoned"]),
        ),
      )
      .orderBy(desc(scoringMatchesTable.completedAt))
      .limit(1);
    match = recent;
  }

  if (!match) {
    return { match: null, state: null, summary: null };
  }

  const state = await projectMatchState(match);
  const summary = summaryFromMatch(match, state);
  return { match, state, summary };
}

export async function listScoringMatches(tournamentId: number) {
  await ensureTournamentScoring(tournamentId);
  // Fetch ordered by id ASC so sequence numbers reflect creation order
  const rows = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, CRICKET_SPORT_SLUG),
      ),
    )
    .orderBy(scoringMatchesTable.id); // ascending for numbering

  // Assign tournament-scoped sequential match numbers (1-based)
  const numbered = rows.map((m, idx) => ({ ...m, tournamentMatchNumber: idx + 1 }));

  // Return newest-first for the match list UI
  return numbered.reverse();
}

export async function getScoringMatch(tournamentId: number, matchId: number) {
  await ensureTournamentScoring(tournamentId);

  const [match] = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, CRICKET_SPORT_SLUG),
      ),
    )
    .limit(1);

  if (!match) {
    throw new ScoringServiceError("Match not found", 404, "MATCH_NOT_FOUND");
  }

  const state = await projectMatchState(match);
  const events = await loadMatchEvents(matchId);

  return { match, state, events };
}

export async function appendScoringEvent(
  tournamentId: number,
  matchId: number,
  input: {
    eventType: string;
    payload: Record<string, unknown>;
    expectedSequence: number;
    actor: ScoringActor;
    correlationId?: string | null;
  },
) {
  await ensureTournamentScoring(tournamentId);

  const [match] = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, CRICKET_SPORT_SLUG),
      ),
    )
    .limit(1);

  if (!match) {
    throw new ScoringServiceError("Match not found", 404, "MATCH_NOT_FOUND");
  }

  // EPIC-11 Phase 1 — Match Start verifies Prepare bind only; never RuleEngine.resolve().
  // EPIC-12 Phase 1 — also verifies presentation bind; never PresentationEngine.resolve().
  if (input.eventType === CricketEventType.MATCH_STARTED) {
    const verified = verifyMatchStartContract({
      currentRuntimeVersion: match.currentRuntimeVersion,
      runtimePrepMetadata: match.runtimePrepMetadataJson as Record<
        string,
        unknown
      > | null,
    });
    if (!verified.ok) {
      throw new ScoringServiceError(verified.error, 409, verified.code);
    }
    const presentationVerified = verifyPresentationMatchStartContract({
      currentRuntimeVersion: match.currentRuntimeVersion,
      runtimePrepMetadata: match.runtimePrepMetadataJson as Record<
        string,
        unknown
      > | null,
    });
    if (!presentationVerified.ok) {
      throw new ScoringServiceError(
        presentationVerified.error,
        409,
        presentationVerified.code,
      );
    }
  }

  const matchMeta = matchMetaFromRow(match);

  // EPIC-11 Phase 2 — MATCH_STARTED overs (and policy identity) from MatchMeta, not UI defaults.
  let payload = input.payload;
  if (input.eventType === CricketEventType.MATCH_STARTED) {
    if (matchMeta.executionRulesSource !== RUNTIME_EXECUTION_POLICY_SOURCE) {
      throw new ScoringServiceError(
        "Match Start requires RuntimeExecutionPolicy-derived rules. Complete Runtime Prepare first.",
        409,
        "RUNTIME_EXECUTION_POLICY_REQUIRED",
      );
    }
    payload = {
      ...input.payload,
      oversLimit: matchMeta.oversLimit,
    };
  }

  // Authoritative innings totals / match result — never trust client-computed scoreboard maths.
  if (
    input.eventType === CricketEventType.INNINGS_ENDED ||
    input.eventType === CricketEventType.MATCH_COMPLETED
  ) {
    const currentState = await projectMatchState(match);
    if (input.eventType === CricketEventType.INNINGS_ENDED) {
      const inn = currentState.innings.find(
        (i) => i.innings === currentState.currentInnings,
      );
      if (!inn) {
        throw new ScoringServiceError(
          "No active innings to end",
          400,
          "INVALID_INNINGS",
        );
      }
      payload = {
        ...input.payload,
        innings: currentState.currentInnings,
        runs: inn.runs,
        wickets: inn.wickets,
        overs: `${inn.over}.${inn.ball}`,
      };
    } else {
      // Ensure second innings is marked completed before deriving result when chase finished.
      const derived = deriveCricketMatchResult(currentState);
      payload = {
        ...input.payload,
        winnerTeamId: derived.winnerTeamId,
        margin: derived.margin,
        resultText: derived.resultText,
        isTie: derived.isTie,
      };
    }
  }

  if (input.eventType === CricketEventType.LINEUP_SET) {
    const playerIds = Array.isArray(payload.playerIds)
      ? (payload.playerIds as unknown[])
      : [];
    if (
      matchMeta.executionRulesSource === RUNTIME_EXECUTION_POLICY_SOURCE &&
      typeof matchMeta.playingSquadSize !== "number"
    ) {
      throw new ScoringServiceError(
        "Playing XI requires playingSquadSize from RuntimeExecutionPolicy.",
        409,
        "RUNTIME_EXECUTION_POLICY_REQUIRED",
      );
    }
    const maxXi = matchMeta.playingSquadSize;
    if (
      typeof maxXi === "number" &&
      matchMeta.playingXiEnforced &&
      playerIds.length !== maxXi
    ) {
      throw new ScoringServiceError(
        `Playing XI must have exactly playingSquadSize (${maxXi}) from RuntimeExecutionPolicy.`,
        400,
        "INVALID_XI",
      );
    }
    if (
      typeof maxXi === "number" &&
      !matchMeta.playingXiEnforced &&
      playerIds.length > maxXi
    ) {
      throw new ScoringServiceError(
        `Playing XI cannot exceed playingSquadSize (${maxXi}) from RuntimeExecutionPolicy.`,
        400,
        "PLAYING_SQUAD_SIZE_EXCEEDED",
      );
    }
  }

  return mapPlatformError(() =>
    appendSingleMatchEvent(
      {
        tournamentId,
        matchId,
        sportSlug: CRICKET_SPORT_SLUG,
        eventType: input.eventType,
        payload,
        expectedSequence: input.expectedSequence,
        actor: input.actor,
        correlationId: input.correlationId,
        matchMeta,
      },
      match,
    ),
  );
}

export async function undoLastScoringEvent(
  tournamentId: number,
  matchId: number,
  input: { expectedSequence: number; actor: ScoringActor },
) {
  const { match } = await getScoringMatch(tournamentId, matchId);

  const events = await loadMatchEvents(matchId);
  const undoneSequences = new Set(
    events
      .filter((e) => e.eventType === CricketEventType.BALL_UNDONE)
      .map((e) => (e.payload as { undoesSequence: number }).undoesSequence),
  );

  const lastBall = [...events]
    .reverse()
    .find(
      (e) =>
        e.eventType === CricketEventType.BALL_RECORDED &&
        !undoneSequences.has(e.sequence),
    );

  if (!lastBall) {
    throw new ScoringServiceError("No ball to undo", 400, "NOTHING_TO_UNDO");
  }

  return appendScoringEvent(tournamentId, matchId, {
    eventType: CricketEventType.BALL_UNDONE,
    payload: {
      undoesEventId: lastBall.id ?? 0,
      undoesSequence: lastBall.sequence,
    },
    expectedSequence: input.expectedSequence,
    actor: input.actor,
  });
}

/**
 * Resets a match back to "scheduled" pre-toss state when 0 runs and 0 balls have been recorded.
 */
export async function resetCricketMatchSetup(
  tournamentId: number,
  matchId: number,
  actor: ScoringActor,
) {
  const { match, state } = await getScoringMatch(tournamentId, matchId);

  if (match.status === "completed" || match.status === "abandoned") {
    throw new ScoringServiceError(
      "Cannot reset a completed or abandoned match",
      400,
      "MATCH_CLOSED",
    );
  }

  // Calculate total balls and runs across all innings
  const totalBalls = (state.innings ?? []).reduce(
    (acc, inn) => acc + (inn.over ?? 0) * 6 + (inn.ball ?? 0),
    0,
  );
  const totalRuns = (state.innings ?? []).reduce(
    (acc, inn) => acc + (inn.runs ?? 0),
    0,
  );

  if (totalBalls > 0 || totalRuns > 0) {
    throw new ScoringServiceError(
      "Cannot reset toss after balls or runs have been recorded. Please undo balls or pause the match instead.",
      400,
      "BALLS_ALREADY_RECORDED",
    );
  }

  const initialState = createInitialCricketState(matchMetaFromRow(match));

  const [updatedMatch] = await db.transaction(async (tx) => {
    // 1. Delete setup events for this match
    await tx
      .delete(scoringEventsTable)
      .where(eq(scoringEventsTable.matchId, matchId));

    // 2. Reset session state
    await tx
      .update(scoringSessionsTable)
      .set({
        status: "idle",
        stateJson: initialState as unknown as Record<string, unknown>,
        lastEventSeq: 0,
      })
      .where(eq(scoringSessionsTable.matchId, matchId));

    // 3. Reset match status
    return tx
      .update(scoringMatchesTable)
      .set({
        status: "scheduled",
        startedAt: null,
        completedAt: null,
        winnerTeamId: null,
        resultSummary: null,
        summaryJson: null,
        currentProjectionVersion: 0,
      })
      .where(eq(scoringMatchesTable.id, matchId))
      .returning();
  });

  // Broadcast reset state to SSE clients
  broadcastScoringState(tournamentId, {
    type: "scoring_state",
    matchId: updatedMatch.id,
    match: {
      id: updatedMatch.id,
      status: updatedMatch.status,
      homeTeamId: updatedMatch.homeTeamId,
      awayTeamId: updatedMatch.awayTeamId,
      winnerTeamId: updatedMatch.winnerTeamId,
      resultSummary: updatedMatch.resultSummary,
    },
    state: initialState,
    summary: null,
  });

  return {
    match: updatedMatch,
    state: initialState,
  };
}
