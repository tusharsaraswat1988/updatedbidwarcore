/**
 * Global cricket career statistics and cross-tournament leaderboards.
 * Materializes into player_statistics (tournament_id NULL = career).
 */

import { db } from "@workspace/db";
import {
  playerStatisticsTable,
  playerTeamAssignmentsTable,
  scoringMatchPlayerStatsTable,
  scoringMatchesTable,
} from "@workspace/db";
import {
  aggregateTournamentPlayerStats,
  buildLeaderboard,
  type LeaderboardCategory,
  type PlayerMatchStatsInput,
  type TournamentPlayerAggregate,
  type BattingCardRow,
  type BowlingCardRow,
} from "@workspace/scoring-core";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";

export type CricketStatsJson = {
  matches: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  wickets: number;
  oversBowled: number;
  runsConceded: number;
  catches: number;
  runOuts: number;
  stumpings: number;
};

function aggregateToStatsJson(agg: TournamentPlayerAggregate): CricketStatsJson {
  return {
    matches: agg.matches,
    runs: agg.runs,
    balls: agg.balls,
    fours: agg.fours,
    sixes: agg.sixes,
    fifties: agg.fifties,
    hundreds: agg.hundreds,
    wickets: agg.wickets,
    oversBowled: agg.oversBowled,
    runsConceded: agg.runsConceded,
    catches: agg.catches,
    runOuts: agg.runOuts,
    stumpings: agg.stumpings,
  };
}

function statRowToInput(row: typeof scoringMatchPlayerStatsTable.$inferSelect): PlayerMatchStatsInput {
  const batting: BattingCardRow | null = row.battingJson
    ? {
        playerId: row.playerId,
        runs: row.battingJson.runs,
        balls: row.battingJson.balls,
        fours: row.battingJson.fours,
        sixes: row.battingJson.sixes,
        strikeRate: row.battingJson.strikeRate,
        notOut: row.battingJson.notOut,
        dismissalType: row.battingJson.dismissalType as BattingCardRow["dismissalType"],
        dismissedByPlayerId: null,
        fielderId: null,
      }
    : null;

  const bowling: BowlingCardRow | null = row.bowlingJson
    ? {
        playerId: row.playerId,
        overs: row.bowlingJson.overs,
        maidens: row.bowlingJson.maidens,
        runs: row.bowlingJson.runs,
        wickets: row.bowlingJson.wickets,
        wides: row.bowlingJson.wides,
        noBalls: row.bowlingJson.noBalls,
        economy: row.bowlingJson.economy,
      }
    : null;

  return {
    matchId: row.matchId,
    playerId: row.playerId,
    teamId: row.teamId,
    innings: row.innings,
    batting,
    bowling,
    fielding: row.fieldingJson ?? { catches: 0, runOuts: 0, stumpings: 0 },
  /**
 * Rebuild cricket statistics from completed match-player projections. The
 * canonical input is scoring_match_player_stats; player_statistics is a
 * replaceable projection, never an increment-only ledger.
 *
 * Repeated calls therefore produce the same result, and scorecard repairs
 * remove stale runs/wickets from both tournament and career totals.
 */
export async function rebuildCricketPlayerStatistics(): Promise<void> {
  const assignmentRows = await db
    .select({
      tournamentId: scoringMatchPlayerStatsTable.tournamentId,
      opaquePlayerId: scoringMatchPlayerStatsTable.playerId,
      masterPlayerId: playerTeamAssignmentsTable.playerId,
      assignedAt: playerTeamAssignmentsTable.assignedAt,
    })
    .from(scoringMatchPlayerStatsTable)
    .innerJoin(
      scoringMatchesTable,
      eq(scoringMatchesTable.id, scoringMatchPlayerStatsTable.matchId),
    )
    .innerJoin(
      playerTeamAssignmentsTable,
      and(
        eq(playerTeamAssignmentsTable.tournamentId, scoringMatchPlayerStatsTable.tournamentId),
        eq(playerTeamAssignmentsTable.auctionPlayerId, scoringMatchPlayerStatsTable.playerId),
        eq(playerTeamAssignmentsTable.sport, "cricket"),
      ),
    )
    .where(eq(scoringMatchesTable.status, "completed"))
    .orderBy(desc(playerTeamAssignmentsTable.assignedAt));

  // Match the registry's historical resolution rule: latest assignment wins
  // for a tournament-scoped opaque player ID.
  const masterByOpaque = new Map<string, string>();
  const sourceRows = new Map<string, PlayerMatchStatsInput[]>();
  const playerKeys = new Map<string, { masterPlayerId: string; tournamentId: number | null }>();

  for (const row of assignmentRows) {
    const key = `${row.tournamentId}:${row.opaquePlayerId}`;
    if (!masterByOpaque.has(key)) masterByOpaque.set(key, row.masterPlayerId);
  }

  const rawRows = await db
    .select({
      matchId: scoringMatchPlayerStatsTable.matchId,
      tournamentId: scoringMatchPlayerStatsTable.tournamentId,
      playerId: scoringMatchPlayerStatsTable.playerId,
      teamId: scoringMatchPlayerStatsTable.teamId,
      innings: scoringMatchPlayerStatsTable.innings,
      battingJson: scoringMatchPlayerStatsTable.battingJson,
      bowlingJson: scoringMatchPlayerStatsTable.bowlingJson,
      fieldingJson: scoringMatchPlayerStatsTable.fieldingJson,
      status: scoringMatchesTable.status,
    })
    .from(scoringMatchPlayerStatsTable)
    .innerJoin(
      scoringMatchesTable,
      eq(scoringMatchesTable.id, scoringMatchPlayerStatsTable.matchId),
    )
    .where(eq(scoringMatchesTable.status, "completed"));

  const stableIdByScope = new Map<string, number>();
  let nextStableId = 1;
  for (const row of rawRows) {
    const masterPlayerId = masterByOpaque.get(`${row.tournamentId}:${row.playerId}`);
    if (!masterPlayerId) continue;

    const inputRow = statRowToInput({
      ...row,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as typeof scoringMatchPlayerStatsTable.$inferSelect);

    const tournamentKey = `${masterPlayerId}:tournament:${row.tournamentId}`;
    const careerKey = `${masterPlayerId}:career`;
    for (const scopeKey of [tournamentKey, careerKey]) {
      const existing = sourceRows.get(scopeKey) ?? [];
      const stableKey = `${scopeKey}`;
      if (!stableIdByScope.has(stableKey)) stableIdByScope.set(stableKey, nextStableId++);
      existing.push({
        ...inputRow,
        playerId: stableIdByScope.get(stableKey)!,
      });
      sourceRows.set(scopeKey, existing);
      playerKeys.set(scopeKey, {
        masterPlayerId,
        tournamentId: scopeKey === careerKey ? null : row.tournamentId,
      });
    }
  }

  const rebuilt = new Map<string, CricketStatsJson>();
  for (const [scopeKey, rows] of sourceRows) {
    const [agg] = aggregateTournamentPlayerStats(rows).values();
    if (agg) rebuilt.set(scopeKey, aggregateToStatsJson(agg));
  }

  // Clear only cricket projections then write their canonical aggregate.
  // Non-cricket player_statistics records are never touched.
  await db
    .delete(playerStatisticsTable)
    .where(eq(playerStatisticsTable.sport, "cricket"));

  if (rebuilt.size === 0) return;

  const values = [...rebuilt.entries()].map(([scopeKey, stats]) => {
    const identity = playerKeys.get(scopeKey)!;
    return {
      playerId: identity.masterPlayerId,
      sport: "cricket",
      tournamentId: identity.tournamentId,
      matchesPlayed: stats.matches,
      pointsScored: stats.runs,
      statsJson: stats,
    };
  });
  await db.insert(playerStatisticsTable).values(values);
}

/** Rebuild the aggregate projection after any completed-match stats change. */
export async function projectGlobalCricketStatsForMatch(matchId: number): Promise<void> {
  const [match] = await db
    .select()
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.id, matchId))
    .limit(1);

  if (!match || match.status !== "completed") return;
  await rebuildCricketPlayerStatistics();
}

 }
}

export type GlobalLeaderboardRow = {
  rank: number;
  globalPlayerId: string;
  playerName: string;
  value: number;
};

export async function getGlobalCricketLeaderboard(
  category: LeaderboardCategory,
  limit = 20,
): Promise<GlobalLeaderboardRow[]> {
  const rows = await db
    .select({
      playerId: playerStatisticsTable.playerId,
      statsJson: playerStatisticsTable.statsJson,
    })
    .from(playerStatisticsTable)
    .where(
      and(eq(playerStatisticsTable.sport, "cricket"), isNull(playerStatisticsTable.tournamentId)),
    );

  const aggregates = new Map<number, TournamentPlayerAggregate>();
  const globalIdByKey = new Map<number, string>();

  rows.forEach((row, index) => {
    const key = index + 1;
    const s = (row.statsJson ?? {}) as Partial<CricketStatsJson>;
    globalIdByKey.set(key, row.playerId);
    aggregates.set(key, {
      playerId: key,
      teamId: 0,
      matches: s.matches ?? 0,
      runs: s.runs ?? 0,
      balls: s.balls ?? 0,
      fours: s.fours ?? 0,
      sixes: s.sixes ?? 0,
      fifties: s.fifties ?? 0,
      hundreds: s.hundreds ?? 0,
      wickets: s.wickets ?? 0,
      oversBowled: s.oversBowled ?? 0,
      runsConceded: s.runsConceded ?? 0,
      catches: s.catches ?? 0,
      runOuts: s.runOuts ?? 0,
      stumpings: s.stumpings ?? 0,
    });
  });

  const board = buildLeaderboard(aggregates, category, limit);
  if (board.length === 0) return [];

  const globalIds = board.map((r) => globalIdByKey.get(r.playerId)!).filter(Boolean);
  const players = await db
    .select({
      id: globalPlayersTable.id,
      displayName: globalPlayersTable.displayName,
      canonicalName: globalPlayersTable.canonicalName,
    })
    .from(globalPlayersTable)
    .where(inArray(globalPlayersTable.id, globalIds));

  const nameMap = new Map(
    players.map((p) => [p.id, p.displayName ?? p.canonicalName ?? p.id]),
  );

  return board.map((r) => {
    const globalPlayerId = globalIdByKey.get(r.playerId)!;
    return {
      rank: r.rank,
      globalPlayerId,
      playerName: nameMap.get(globalPlayerId) ?? "Player",
      value: r.value,
    };
  });
}

/** Full rebuild of career rows from all completed match stats (admin/recovery). */
export async function rebuildGlobalCricketCareerStats(): Promise<void> {
  await db
    .delete(playerStatisticsTable)
    .where(and(eq(playerStatisticsTable.sport, "cricket"), isNull(playerStatisticsTable.tournamentId)));

  const completedMatches = await db
    .select({ id: scoringMatchesTable.id })
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.status, "completed"));

  for (const m of completedMatches) {
    await projectGlobalCricketStatsForMatch(m.id);
  }
}
