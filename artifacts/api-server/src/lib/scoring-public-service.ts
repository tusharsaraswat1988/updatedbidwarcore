import { db } from "@workspace/db";
import {
  globalPlayersTable,
  playersTable,
  scoringMatchPlayerStatsTable,
  scoringMatchesTable,
  scoringPlayerAwardsTable,
  scoringStandingsTable,
  teamsTable,
  tournamentsTable,
} from "@workspace/db";
import {
  aggregateTournamentPlayerStats,
  type TournamentPlayerAggregate,
} from "@workspace/scoring-core";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ScoringServiceError } from "./scoring-service";
import { ensureScoringEnabled } from "./scoring-standings";
import type { BattingStatsJson, BowlingStatsJson, FieldingStatsJson } from "@workspace/db";

function statRowsToAggregates(
  statRows: Array<{
    matchId: number;
    playerId: number;
    teamId: number;
    innings: number;
    battingJson: BattingStatsJson | null;
    bowlingJson: BowlingStatsJson | null;
    fieldingJson: FieldingStatsJson | null;
  }>,
) {
  return aggregateTournamentPlayerStats(
    statRows.map((row) => ({
      matchId: row.matchId,
      playerId: row.playerId,
      teamId: row.teamId,
      innings: row.innings,
      batting: row.battingJson
        ? {
            playerId: row.playerId,
            runs: row.battingJson.runs,
            balls: row.battingJson.balls,
            fours: row.battingJson.fours,
            sixes: row.battingJson.sixes,
            strikeRate: row.battingJson.strikeRate,
            notOut: row.battingJson.notOut,
            dismissalType: row.battingJson.dismissalType as never,
            dismissedByPlayerId: null,
            fielderId: null,
          }
        : null,
      bowling: row.bowlingJson
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
        : null,
      fielding: row.fieldingJson ?? { catches: 0, runOuts: 0, stumpings: 0 },
    })),
  );
}

function aggregateToJson(agg: TournamentPlayerAggregate) {
  const strikeRate = agg.balls > 0 ? Math.round((agg.runs / agg.balls) * 1000) / 10 : 0;
  const economy =
    agg.oversBowled > 0 ? Math.round((agg.runsConceded / agg.oversBowled) * 100) / 100 : 0;
  return {
    matches: agg.matches,
    runs: agg.runs,
    balls: agg.balls,
    fours: agg.fours,
    sixes: agg.sixes,
    fifties: agg.fifties,
    hundreds: agg.hundreds,
    strikeRate,
    wickets: agg.wickets,
    oversBowled: agg.oversBowled,
    runsConceded: agg.runsConceded,
    economy,
    catches: agg.catches,
    runOuts: agg.runOuts,
    stumpings: agg.stumpings,
  };
}

export async function getTournamentPlayerPublicProfile(tournamentId: number, playerId: number) {
  await ensureScoringEnabled(tournamentId);

  const [player] = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.tournamentId, tournamentId), eq(playersTable.id, playerId)))
    .limit(1);

  if (!player) {
    throw new ScoringServiceError("Player not found", 404, "PLAYER_NOT_FOUND");
  }

  const [team] = player.teamId
    ? await db
        .select({ id: teamsTable.id, name: teamsTable.name, shortCode: teamsTable.shortCode, color: teamsTable.color })
        .from(teamsTable)
        .where(eq(teamsTable.id, player.teamId))
        .limit(1)
    : [null];

  const statRows = await db
    .select()
    .from(scoringMatchPlayerStatsTable)
    .where(
      and(
        eq(scoringMatchPlayerStatsTable.tournamentId, tournamentId),
        eq(scoringMatchPlayerStatsTable.playerId, playerId),
      ),
    );

  const aggregates = statRowsToAggregates(statRows);
  const stats = aggregates.get(playerId);

  const momAwards = await db
    .select({
      matchId: scoringPlayerAwardsTable.matchId,
      reason: scoringPlayerAwardsTable.reason,
      createdAt: scoringPlayerAwardsTable.createdAt,
    })
    .from(scoringPlayerAwardsTable)
    .where(
      and(
        eq(scoringPlayerAwardsTable.tournamentId, tournamentId),
        eq(scoringPlayerAwardsTable.playerId, playerId),
        eq(scoringPlayerAwardsTable.awardType, "man_of_the_match"),
      ),
    )
    .orderBy(desc(scoringPlayerAwardsTable.createdAt))
    .limit(10);

  const matchIds = [...new Set(statRows.map((r) => r.matchId))];
  const matches =
    matchIds.length > 0
      ? await db
          .select({
            id: scoringMatchesTable.id,
            homeTeamId: scoringMatchesTable.homeTeamId,
            awayTeamId: scoringMatchesTable.awayTeamId,
            status: scoringMatchesTable.status,
            resultSummary: scoringMatchesTable.resultSummary,
            completedAt: scoringMatchesTable.completedAt,
          })
          .from(scoringMatchesTable)
          .where(inArray(scoringMatchesTable.id, matchIds))
          .orderBy(desc(scoringMatchesTable.completedAt))
      : [];

  let globalPlayer: { id: string; displayName: string | null; photoUrl: string | null } | null = null;
  if (player.globalPlayerId) {
    const [gp] = await db
      .select({
        id: globalPlayersTable.id,
        displayName: globalPlayersTable.displayName,
        photoUrl: globalPlayersTable.photoUrl,
      })
      .from(globalPlayersTable)
      .where(eq(globalPlayersTable.id, player.globalPlayerId))
      .limit(1);
    globalPlayer = gp ?? null;
  }

  return {
    player: {
      id: player.id,
      name: player.name,
      role: player.role,
      photoUrl: player.photoUrl ?? globalPlayer?.photoUrl ?? null,
      globalPlayerId: player.globalPlayerId,
    },
    team,
    stats: stats ? aggregateToJson(stats) : null,
    manOfTheMatchAwards: momAwards.map((a) => ({
      matchId: a.matchId,
      reason: a.reason,
      awardedAt: a.createdAt.toISOString(),
    })),
    recentMatches: matches.slice(0, 8).map((m) => ({
      id: m.id,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      status: m.status,
      resultSummary: m.resultSummary,
      completedAt: m.completedAt?.toISOString() ?? null,
    })),
  };
}

export async function getTournamentTeamPublicProfile(tournamentId: number, teamId: number) {
  await ensureScoringEnabled(tournamentId);

  const [team] = await db
    .select()
    .from(teamsTable)
    .where(and(eq(teamsTable.tournamentId, tournamentId), eq(teamsTable.id, teamId)))
    .limit(1);

  if (!team) {
    throw new ScoringServiceError("Team not found", 404, "TEAM_NOT_FOUND");
  }

  const [standing] = await db
    .select()
    .from(scoringStandingsTable)
    .where(
      and(
        eq(scoringStandingsTable.tournamentId, tournamentId),
        eq(scoringStandingsTable.teamId, teamId),
      ),
    )
    .limit(1);

  const squad = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      role: playersTable.role,
      status: playersTable.status,
      soldPrice: playersTable.soldPrice,
    })
    .from(playersTable)
    .where(and(eq(playersTable.tournamentId, tournamentId), eq(playersTable.teamId, teamId)))
    .orderBy(playersTable.name);

  const teamMatches = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.status, "completed"),
      ),
    )
    .orderBy(desc(scoringMatchesTable.completedAt))
    .limit(30);

  const results = teamMatches
    .filter((m) => m.homeTeamId === teamId || m.awayTeamId === teamId)
    .slice(0, 10)
    .map((m) => ({
      id: m.id,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      winnerTeamId: m.winnerTeamId,
      resultSummary: m.resultSummary,
      completedAt: m.completedAt?.toISOString() ?? null,
      won: m.winnerTeamId === teamId,
    }));

  const statRows = await db
    .select()
    .from(scoringMatchPlayerStatsTable)
    .where(
      and(
        eq(scoringMatchPlayerStatsTable.tournamentId, tournamentId),
        eq(scoringMatchPlayerStatsTable.teamId, teamId),
      ),
    );

  const aggregates = statRowsToAggregates(statRows);
  const topBatsmen = [...aggregates.values()]
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 5)
    .map((agg) => ({
      playerId: agg.playerId,
      ...aggregateToJson(agg),
    }));

  const playerIds = topBatsmen.map((r) => r.playerId);
  const playerNames =
    playerIds.length > 0
      ? await db
          .select({ id: playersTable.id, name: playersTable.name })
          .from(playersTable)
          .where(inArray(playersTable.id, playerIds))
      : [];
  const nameMap = new Map(playerNames.map((p) => [p.id, p.name]));

  return {
    team: {
      id: team.id,
      name: team.name,
      shortCode: team.shortCode,
      color: team.color,
      logoUrl: team.logoUrl,
    },
    standing: standing
      ? {
          played: standing.played,
          won: standing.won,
          lost: standing.lost,
          tied: standing.tied,
          noResult: standing.noResult,
          points: standing.points,
          netRunRate: standing.netRunRate,
        }
      : null,
    squad,
    recentResults: results,
    topBatsmen: topBatsmen.map((r) => ({
      playerId: r.playerId,
      playerName: nameMap.get(r.playerId) ?? `Player ${r.playerId}`,
      runs: r.runs,
      matches: r.matches,
      strikeRate: r.strikeRate,
    })),
  };
}

export async function getGlobalPlayerCricketProfile(globalPlayerId: string) {
  const [gp] = await db
    .select()
    .from(globalPlayersTable)
    .where(eq(globalPlayersTable.id, globalPlayerId))
    .limit(1);

  if (!gp) {
    throw new ScoringServiceError("Player not found", 404, "PLAYER_NOT_FOUND");
  }

  const rosterRows = await db
    .select({
      playerId: playersTable.id,
      tournamentId: playersTable.tournamentId,
      name: playersTable.name,
      role: playersTable.role,
      teamId: playersTable.teamId,
    })
    .from(playersTable)
    .where(eq(playersTable.globalPlayerId, globalPlayerId));

  const tournamentIds = [...new Set(rosterRows.map((r) => r.tournamentId))];
  const tournaments =
    tournamentIds.length > 0
      ? await db
          .select({ id: tournamentsTable.id, name: tournamentsTable.name, sport: tournamentsTable.sport })
          .from(tournamentsTable)
          .where(inArray(tournamentsTable.id, tournamentIds))
      : [];

  const playerIds = rosterRows.map((r) => r.playerId);
  const statRows =
    playerIds.length > 0
      ? await db
          .select()
          .from(scoringMatchPlayerStatsTable)
          .where(inArray(scoringMatchPlayerStatsTable.playerId, playerIds))
      : [];

  const aggregates = statRowsToAggregates(statRows);
  let combined: TournamentPlayerAggregate | null = null;
  for (const row of aggregates.values()) {
    if (!combined) {
      combined = { ...row };
      continue;
    }
    combined.matches += row.matches;
    combined.runs += row.runs;
    combined.balls += row.balls;
    combined.fours += row.fours;
    combined.sixes += row.sixes;
    combined.fifties += row.fifties;
    combined.hundreds += row.hundreds;
    combined.wickets += row.wickets;
    combined.oversBowled += row.oversBowled;
    combined.runsConceded += row.runsConceded;
    combined.catches += row.catches;
    combined.runOuts += row.runOuts;
    combined.stumpings += row.stumpings;
  }

  const momCount = await db
    .select({ id: scoringPlayerAwardsTable.id })
    .from(scoringPlayerAwardsTable)
    .where(
      and(
        inArray(scoringPlayerAwardsTable.playerId, playerIds),
        eq(scoringPlayerAwardsTable.awardType, "man_of_the_match"),
      ),
    );

  return {
    globalPlayer: {
      id: gp.id,
      name: gp.displayName ?? gp.canonicalName,
      photoUrl: gp.photoUrl,
      city: gp.city,
      role: gp.defaultRole,
    },
    careerStats: combined ? aggregateToJson(combined) : null,
    manOfTheMatchCount: momCount.length,
    tournaments: tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      sport: t.sport,
    })),
  };
}
