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
  globalPlayersTable,
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
  };
}

/**
 * Rebuild stats from authoritative completed-match player projections.
 * player_statistics is a materialized projection, never an additive ledger.
 * Replaying this function is safe and repairs stale tournament/career totals.
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

  // Historical roster rows can repeat an opaque player ID. Match the registry's
  // resolution rule by selecting the most recently assigned canonical identity.
  const masterByOpaque = new Map<string, string>();
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
    })
    .from(scoringMatchPlayerStatsTable)
    .innerJoin(
      scoringMatchesTable,
      eq(scoringMatchesTable.id, scoringMatchPlayerStatsTable.matchId),
    )
    .where(eq(scoringMatchesTable.status, "completed"));

  const grouped = new Map<string, PlayerMatchStatsInput[]>();
  const identityByScope = new Map<string, { masterPlayerId: string; tournamentId: number | null }>();
  const syntheticPlayerIds = new Map<string, number>();
  let nextSyntheticPlayerId = 1;

  for (const row of rawRows) {
    const masterPlayerId = masterByOpaque.get(`${row.tournamentId}:${row.playerId}`);
    if (!masterPlayerId) continue;

    const input = statRowToInput({
      ...row,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as typeof scoringMatchPlayerStatsTable.$inferSelect);

    const scopes = [
      { key: `${masterPlayerId}:tournament:${row.tournamentId}`, tournamentId: row.tournamentId },
      { key: `${masterPlayerId}:career`, tournamentId: null },
    ];

    for (const scope of scopes) {
      if (!syntheticPlayerIds.has(scope.key)) {
        syntheticPlayerIds.set(scope.key, nextSyntheticPlayerId++);
      }
      const rows = grouped.get(scope.key) ?? [];
      rows.push({ ...input, playerId: syntheticPlayerIds.get(scope.key)! });
      grouped.set(scope.key, rows);
      identityByScope.set(scope.key, { masterPlayerId, tournamentId: scope.tournamentId });
    }
  }

  const rebuilt: { playerId: string; sport: string; tournamentId: number | null; matchesPlayed: number; pointsScored: number; statsJson: CricketStatsJson }[] = [];
  for (const [scopeKey, rows] of grouped) {
    const aggregate = [...aggregateTournamentPlayerStats(rows).values()][0];
    if (!aggregate) continue;
    const identity = identityByScope.get(scopeKey)!;
    const stats = aggregateToStatsJson(aggregate);
    rebuilt.push({
      playerId: identity.masterPlayerId,
      sport: "cricket",
      tournamentId: identity.tournamentId,
      matchesPlayed: stats.matches,
      pointsScored: stats.runs,
      statsJson: stats,
    });
  }

  // Replace cricket projections atomically; other sports are not affected.
  await db.transaction(async (tx) => {
    await tx.delete(playerStatisticsTable).where(eq(playerStatisticsTable.sport, "cricket"));
    if (rebuilt.length > 0) await tx.insert(playerStatisticsTable).values(rebuilt);
  });
}

/** Reconcile the materialized global and tournament aggregates from match stats. */
export async function projectGlobalCricketStatsForMatch(matchId: number): Promise<void> {
  const [match] = await db
    .select({ id: scoringMatchesTable.id, status: scoringMatchesTable.status })
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.id, matchId))
    .limit(1);

  if (!match || match.status !== "completed") return;
  await rebuildCricketPlayerStatistics();
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

