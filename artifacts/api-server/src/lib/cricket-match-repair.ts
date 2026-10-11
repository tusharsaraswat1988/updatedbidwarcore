import {
  db,
  scorerMatchLocksTable,
  scoringDlsCalculationsTable,
  scoringEventsTable,
  scoringFixturesTable,
  scoringMatchPlayerStatsTable,
  scoringMatchesTable,
  scoringPlayerAwardsTable,
  scoringSessionsTable,
} from "@workspace/db";
import {
  buildMatchMetaFromRules,
  createInitialCricketState,
  deriveCricketMatchResult,
  type CricketMatchRulesJson,
  type CricketScoreboardState,
  type MatchMeta,
} from "@workspace/scoring-core";
import { and, eq } from "drizzle-orm";
import { broadcastScoringState } from "./scoring-broadcast";
import { loadMatchEvents } from "./scoring-platform/event-store";
import { getScoringAdapter } from "./scoring-platform/projections";
import { replayScoringMatchState } from "./scoring-platform";
import { ScoringServiceError } from "./scoring-service";
import {
  projectMatchAwards,
  projectMatchPlayerStats,
  rebuildTournamentLeaderboards,
} from "./scoring-stats-service";
import { ensureScoringEnabled, rebuildTournamentStandings } from "./scoring-standings";
import { advanceTournamentProgression } from "./tournament-progression-service";

const CRICKET_SPORT_SLUG = "cricket" as const;
const REPAIRABLE_STATUSES = new Set(["completed", "abandoned", "walkover"]);
const MAX_MATCHES = 40;

export type CricketMatchRepairMode = "rebuild" | "reset";

export type CricketMatchRepairResult = {
  mode: CricketMatchRepairMode;
  repaired: Array<{
    matchId: number;
    status: string;
    winnerTeamId: number | null;
    resultSummary: string | null;
  }>;
  skipped: Array<{ matchId: number; reason: string }>;
  tableRefreshError: string | null;
};

function matchMetaFromRow(match: typeof scoringMatchesTable.$inferSelect): MatchMeta {
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

async function loadRepairMatch(tournamentId: number, matchId: number) {
  const [match] = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!match || match.sportSlug !== CRICKET_SPORT_SLUG) {
    throw new ScoringServiceError("Match not found", 404, "MATCH_NOT_FOUND");
  }
  if (!REPAIRABLE_STATUSES.has(match.status)) {
    throw new ScoringServiceError(
      "Only completed, abandoned, or walkover matches can be repaired",
      409,
      "MATCH_NOT_FINISHED",
    );
  }
  return match;
}

async function writeSession(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  match: typeof scoringMatchesTable.$inferSelect,
  state: CricketScoreboardState | Record<string, unknown>,
  status: string,
  lastEventSeq: number,
) {
  const [session] = await tx
    .select({ id: scoringSessionsTable.id })
    .from(scoringSessionsTable)
    .where(eq(scoringSessionsTable.matchId, match.id))
    .limit(1);

  if (session) {
    await tx
      .update(scoringSessionsTable)
      .set({
        status,
        stateJson: state as Record<string, unknown>,
        lastEventSeq,
      })
      .where(eq(scoringSessionsTable.matchId, match.id));
    return;
  }

  await tx.insert(scoringSessionsTable).values({
    matchId: match.id,
    tournamentId: match.tournamentId,
    status,
    stateJson: state as Record<string, unknown>,
    lastEventSeq,
  });
}

function publish(
  tournamentId: number,
  match: {
    id: number;
    status: string;
    homeTeamId: number;
    awayTeamId: number;
    winnerTeamId: number | null;
    resultSummary: string | null;
  },
  state: unknown,
  summary: unknown,
) {
  broadcastScoringState(tournamentId, {
    type: "scoring_state",
    matchId: match.id,
    match: {
      id: match.id,
      status: match.status,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      winnerTeamId: match.winnerTeamId,
      resultSummary: match.resultSummary,
    },
    state,
    summary,
  });
}

async function rebuildOne(tournamentId: number, matchId: number) {
  const match = await loadRepairMatch(tournamentId, matchId);
  const events = await loadMatchEvents(match.id);
  if (events.length === 0) {
    throw new ScoringServiceError(
      "No ball-by-ball record to rebuild. Reset this match and score it again.",
      422,
      "NO_EVENTS",
    );
  }

  const adapter = getScoringAdapter(CRICKET_SPORT_SLUG);
  if (!adapter.projectMatchFromState) {
    throw new ScoringServiceError("Cricket scoring adapter is unavailable", 500, "ADAPTER_UNSUPPORTED");
  }

  let state: CricketScoreboardState;
  try {
    state = replayScoringMatchState<CricketScoreboardState>(
      CRICKET_SPORT_SLUG,
      matchMetaFromRow(match),
      events,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not replay ball-by-ball data";
    throw new ScoringServiceError(message, 422, "REPLAY_FAILED");
  }

  if (state.matchStatus === "completed") {
    const derived = deriveCricketMatchResult(state);
    const derivedIsUseful =
      derived.isTie || (typeof derived.winnerTeamId === "number" && derived.winnerTeamId > 0);
    if (derivedIsUseful) {
      state = {
        ...state,
        winnerTeamId: derived.winnerTeamId,
        resultText: derived.resultText,
      };
    }
  }

  const projection = adapter.projectMatchFromState(state);
  const terminal = projection.setCompletedAt === true;
  const winnerTeamId = terminal ? (projection.winnerTeamId ?? null) : null;
  const resultSummary = terminal ? (projection.resultSummary ?? null) : null;
  const summaryJson = terminal ? (projection.summaryJson ?? null) : null;

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(scoringMatchesTable)
      .set({
        status: projection.matchStatus,
        winnerTeamId,
        resultSummary,
        summaryJson,
        completedAt: terminal ? (match.completedAt ?? new Date()) : null,
        startedAt:
          projection.matchStatus === "scheduled" ? null : (match.startedAt ?? new Date()),
        currentProjectionVersion: projection.lastEventSeq ?? state.lastSequence ?? 0,
        updatedAt: new Date(),
      })
      .where(eq(scoringMatchesTable.id, match.id))
      .returning();

    if (match.fixtureId != null) {
      await tx
        .update(scoringFixturesTable)
        .set({
          status: projection.matchStatus,
          winnerTeamId,
          resultSummary,
        })
        .where(eq(scoringFixturesTable.id, match.fixtureId));
    }

    await writeSession(
      tx,
      match,
      state,
      projection.sessionStatus ?? "idle",
      projection.lastEventSeq ?? state.lastSequence ?? 0,
    );

    return row ?? match;
  });

  if (updated.status === "completed") {
    await projectMatchPlayerStats(updated.id);
    await projectMatchAwards(updated.id);
  } else {
    await db
      .delete(scoringMatchPlayerStatsTable)
      .where(eq(scoringMatchPlayerStatsTable.matchId, updated.id));
    await db
      .delete(scoringPlayerAwardsTable)
      .where(eq(scoringPlayerAwardsTable.matchId, updated.id));
  }

  publish(tournamentId, updated, state, summaryJson);
  return {
    matchId: updated.id,
    status: updated.status,
    winnerTeamId: updated.winnerTeamId,
    resultSummary: updated.resultSummary,
  };
}

async function resetOne(tournamentId: number, matchId: number) {
  const match = await loadRepairMatch(tournamentId, matchId);
  const initialState = createInitialCricketState(matchMetaFromRow(match));

  const updated = await db.transaction(async (tx) => {
    await tx.delete(scoringEventsTable).where(eq(scoringEventsTable.matchId, match.id));
    await tx
      .delete(scoringMatchPlayerStatsTable)
      .where(eq(scoringMatchPlayerStatsTable.matchId, match.id));
    await tx.delete(scoringPlayerAwardsTable).where(eq(scoringPlayerAwardsTable.matchId, match.id));
    await tx
      .delete(scoringDlsCalculationsTable)
      .where(eq(scoringDlsCalculationsTable.matchId, match.id));
    await tx.delete(scorerMatchLocksTable).where(eq(scorerMatchLocksTable.matchId, match.id));

    const [row] = await tx
      .update(scoringMatchesTable)
      .set({
        status: "scheduled",
        startedAt: null,
        completedAt: null,
        winnerTeamId: null,
        resultSummary: null,
        summaryJson: null,
        currentProjectionVersion: 0,
        lifecycleStatus: "ready",
        executionPhase: "participants_ready",
        updatedAt: new Date(),
      })
      .where(eq(scoringMatchesTable.id, match.id))
      .returning();

    if (match.fixtureId != null) {
      await tx
        .update(scoringFixturesTable)
        .set({
          status: "scheduled",
          winnerTeamId: null,
          resultSummary: null,
        })
        .where(eq(scoringFixturesTable.id, match.fixtureId));
    }

    await writeSession(tx, match, initialState, "idle", 0);
    return row ?? match;
  });

  publish(tournamentId, updated, initialState, null);
  return {
    matchId: updated.id,
    status: updated.status,
    winnerTeamId: updated.winnerTeamId,
    resultSummary: updated.resultSummary,
  };
}

/**
 * Repair finished cricket matches whose score, player card, or winner drifted.
 *
 * rebuild — keep the ball-by-ball log and rewrite score, winner, player stats,
 * awards, points, and leaderboards from that log.
 * reset — delete the ball-by-ball log and derived scores, return the match to
 * scheduled, and keep the playing squad so it can be scored again.
 *
 * Career (global) player totals are left untouched. They are additive and a
 * second write would double-count.
 */
export async function repairCompletedCricketMatches(
  tournamentId: number,
  matchIds: number[],
  mode: CricketMatchRepairMode,
): Promise<CricketMatchRepairResult> {
  await ensureScoringEnabled(tournamentId);

  const uniqueIds = [...new Set(matchIds)].slice(0, MAX_MATCHES);
  if (uniqueIds.length === 0) {
    throw new ScoringServiceError("Choose at least one match", 400, "NO_MATCHES");
  }

  const repaired: CricketMatchRepairResult["repaired"] = [];
  const skipped: CricketMatchRepairResult["skipped"] = [];

  for (const matchId of uniqueIds) {
    try {
      repaired.push(
        mode === "rebuild"
          ? await rebuildOne(tournamentId, matchId)
          : await resetOne(tournamentId, matchId),
      );
    } catch (err) {
      if (err instanceof ScoringServiceError && err.status < 500) {
        skipped.push({ matchId, reason: err.message });
        continue;
      }
      throw err;
    }
  }

  let tableRefreshError: string | null = null;
  if (repaired.length > 0) {
    try {
      await rebuildTournamentStandings(tournamentId);
      await rebuildTournamentLeaderboards(tournamentId);
      await advanceTournamentProgression(tournamentId);
    } catch (err) {
      tableRefreshError =
        err instanceof Error
          ? err.message
          : "Points table and leaderboards could not be refreshed";
    }
  }

  return { mode, repaired, skipped, tableRefreshError };
}
