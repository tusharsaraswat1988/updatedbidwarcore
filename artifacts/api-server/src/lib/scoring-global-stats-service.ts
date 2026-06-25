/**
 * Global cricket career statistics and cross-tournament leaderboards.
 * Materializes into player_statistics (tournament_id NULL = career).
 */

import { db } from "@workspace/db";
import {
  globalPlayersTable,
  playerStatisticsTable,
  playersTable,
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
import { and, eq, inArray, isNull } from "drizzle-orm";

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

function mergeStatsJson(base: CricketStatsJson, add: CricketStatsJson): CricketStatsJson {
  return {
    matches: base.matches + add.matches,
    runs: base.runs + add.runs,
    balls: base.balls + add.balls,
    fours: base.fours + add.fours,
    sixes: base.sixes + add.sixes,
    fifties: base.fifties + add.fifties,
    hundreds: base.hundreds + add.hundreds,
    wickets: base.wickets + add.wickets,
    oversBowled: base.oversBowled + add.oversBowled,
    runsConceded: base.runsConceded + add.runsConceded,
    catches: base.catches + add.catches,
    runOuts: base.runOuts + add.runOuts,
    stumpings: base.stumpings + add.stumpings,
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
  };
}

async function upsertPlayerStatistics(
  masterPlayerId: string,
  tournamentId: number | null,
  stats: CricketStatsJson,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(playerStatisticsTable)
    .where(
      and(
        eq(playerStatisticsTable.playerId, masterPlayerId),
        eq(playerStatisticsTable.sport, "cricket"),
        tournamentId === null
          ? isNull(playerStatisticsTable.tournamentId)
          : eq(playerStatisticsTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (existing) {
    const prev = (existing.statsJson ?? {}) as Partial<CricketStatsJson>;
    const merged = mergeStatsJson(
      {
        matches: prev.matches ?? 0,
        runs: prev.runs ?? 0,
        balls: prev.balls ?? 0,
        fours: prev.fours ?? 0,
        sixes: prev.sixes ?? 0,
        fifties: prev.fifties ?? 0,
        hundreds: prev.hundreds ?? 0,
        wickets: prev.wickets ?? 0,
        oversBowled: prev.oversBowled ?? 0,
        runsConceded: prev.runsConceded ?? 0,
        catches: prev.catches ?? 0,
        runOuts: prev.runOuts ?? 0,
        stumpings: prev.stumpings ?? 0,
      },
      stats,
    );
    await db
      .update(playerStatisticsTable)
      .set({
        statsJson: merged,
        matchesPlayed: merged.matches,
        pointsScored: merged.runs,
        updatedAt: new Date(),
      })
      .where(eq(playerStatisticsTable.id, existing.id));
    return;
  }

  await db.insert(playerStatisticsTable).values({
    playerId: masterPlayerId,
    sport: "cricket",
    tournamentId,
    matchesPlayed: stats.matches,
    pointsScored: stats.runs,
    statsJson: stats,
  });
}

/** Increment player_statistics from a completed match's projected stats. */
export async function projectGlobalCricketStatsForMatch(matchId: number): Promise<void> {
  const [match] = await db
    .select()
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.id, matchId))
    .limit(1);

  if (!match || match.status !== "completed") return;

  const statRows = await db
    .select()
    .from(scoringMatchPlayerStatsTable)
    .where(eq(scoringMatchPlayerStatsTable.matchId, matchId));

  if (statRows.length === 0) return;

  const playerStats = statRows.map(statRowToInput);
  const matchAggregates = aggregateTournamentPlayerStats(playerStats);

  const tournamentPlayerIds = [...matchAggregates.keys()];
  const roster = await db
    .select({
      id: playersTable.id,
      globalPlayerId: playersTable.globalPlayerId,
    })
    .from(playersTable)
    .where(
      and(
        eq(playersTable.tournamentId, match.tournamentId),
        inArray(playersTable.id, tournamentPlayerIds),
      ),
    );

  const globalByTournamentPlayer = new Map(
    roster.filter((p) => p.globalPlayerId).map((p) => [p.id, p.globalPlayerId!]),
  );

  for (const [playerId, agg] of matchAggregates) {
    const stats = aggregateToStatsJson(agg);
    const globalId = globalByTournamentPlayer.get(playerId);
    if (globalId) {
      await upsertPlayerStatistics(globalId, match.tournamentId, stats);
      await upsertPlayerStatistics(globalId, null, stats);
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
