/**
 * Career cricket leaderboards.
 *
 * Totals are the cricket cache in `player_statistics` (tournament_id NULL).
 * Writers live in `cricket-player-statistics.ts` and replace those rows from
 * the completed-match ledger. This module does not add a match onto a total.
 */

import { db } from "@workspace/db";
import {
  globalPlayersTable,
  playerStatisticsTable,
} from "@workspace/db";
import {
  buildLeaderboard,
  type CricketCareerStats,
  type LeaderboardCategory,
  type TournamentPlayerAggregate,
} from "@workspace/scoring-core";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  rebuildCricketPlayerStatistics,
  syncCricketMatchStatistics,
} from "./cricket-player-statistics";

export type { CricketCareerStats };

/** @deprecated Use syncCricketMatchStatistics. Kept so existing callers stay correct. */
export async function projectGlobalCricketStatsForMatch(matchId: number): Promise<void> {
  await syncCricketMatchStatistics(matchId);
}

/** Replace every cricket tournament and career cache row from the match ledger. */
export async function rebuildGlobalCricketCareerStats(): Promise<void> {
  await rebuildCricketPlayerStatistics();
}

export { rebuildCricketPlayerStatistics };

export type GlobalLeaderboardRow = {
  rank: number;
  globalPlayerId: string;
  playerName: string;
  value: number;
};

function storedToAggregate(
  playerKey: number,
  stats: Partial<CricketCareerStats>,
): TournamentPlayerAggregate {
  return {
    playerId: playerKey,
    teamId: 0,
    matches: stats.matches ?? 0,
    innings: stats.innings ?? 0,
    notOuts: stats.notOuts ?? 0,
    runs: stats.runs ?? 0,
    balls: stats.balls ?? 0,
    fours: stats.fours ?? 0,
    sixes: stats.sixes ?? 0,
    fifties: stats.fifties ?? 0,
    hundreds: stats.hundreds ?? 0,
    ducks: stats.ducks ?? 0,
    highestScore: stats.highestScore ?? null,
    highestScoreNotOut: stats.highestScoreNotOut ?? false,
    wickets: stats.wickets ?? 0,
    oversBowled: stats.oversBowled ?? 0,
    legalBalls: stats.legalBalls ?? 0,
    runsConceded: stats.runsConceded ?? 0,
    maidens: stats.maidens ?? 0,
    wides: stats.wides ?? 0,
    noBalls: stats.noBalls ?? 0,
    bestBowlingWickets: stats.bestBowlingWickets ?? null,
    bestBowlingRuns: stats.bestBowlingRuns ?? null,
    catches: stats.catches ?? 0,
    runOuts: stats.runOuts ?? 0,
    stumpings: stats.stumpings ?? 0,
    oversNotation: stats.oversNotation ?? "assumed-six-ball",
  };
}

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
    .where(and(eq(playerStatisticsTable.sport, "cricket"), isNull(playerStatisticsTable.tournamentId)));

  const aggregates = new Map<number, TournamentPlayerAggregate>();
  const globalIdByKey = new Map<number, string>();

  rows.forEach((row, index) => {
    const key = index + 1;
    globalIdByKey.set(key, row.playerId);
    aggregates.set(key, storedToAggregate(key, (row.statsJson ?? {}) as Partial<CricketCareerStats>));
  });

  const board = buildLeaderboard(aggregates, category, limit);
  if (board.length === 0) return [];

  const globalIds = board.map((row) => globalIdByKey.get(row.playerId)!).filter(Boolean);
  const players = await db
    .select({
      id: globalPlayersTable.id,
      displayName: globalPlayersTable.displayName,
      canonicalName: globalPlayersTable.canonicalName,
    })
    .from(globalPlayersTable)
    .where(inArray(globalPlayersTable.id, globalIds));

  const nameMap = new Map(players.map((player) => [player.id, player.displayName ?? player.canonicalName ?? player.id]));

  return board.map((row) => {
    const globalPlayerId = globalIdByKey.get(row.playerId)!;
    return {
      rank: row.rank,
      globalPlayerId,
      playerName: nameMap.get(globalPlayerId) ?? "Player",
      value: row.value,
    };
  });
}
