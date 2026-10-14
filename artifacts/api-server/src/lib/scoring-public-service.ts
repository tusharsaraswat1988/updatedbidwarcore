import { db } from "@workspace/db";
import {
  globalPlayersTable,
  playerTeamAssignmentsTable,
  scoringMatchesTable,
  scoringPlayerAwardsTable,
  tournamentsTable,
} from "@workspace/db";
import {
  derivedCricketStats,
  rankInDraw,
  resolveTeamStanding,
  teamGroupQualifications,
  type TournamentPlayerAggregate,
} from "@workspace/scoring-core";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { ScoringServiceError } from "./scoring-service";
import { TERMINAL_SCORING_MATCH_STATUSES } from "./scoring-match-terminal";
import { ensureScoringEnabled, getScoringStandings } from "./scoring-standings";
import {
  listCricketFranchisePlayers,
  resolveCricketFranchisePlayersByIds,
  resolveCricketFranchiseTeamsByIds,
} from "./master-sports/cricket-franchise-registry";
import {
  aggregateCompletedTournamentPlayers,
  loadCanonicalCricketStats,
} from "./cricket-player-statistics";

function aggregateToJson(agg: TournamentPlayerAggregate) {
  const stats = derivedCricketStats(agg);
  return {
    ...stats,
    // Older clients read a number. Null means the rate is undefined.
    strikeRate: stats.strikeRate ?? 0,
    economy: stats.economy ?? 0,
  };
}

/**
 * Tournament profile for one scoring registration.
 * Totals include playing-XI appearances in completed matches.
 * A career profile combines every registration that resolves to the same
 * canonical player. Two registrations stay separate on this page.
 */
export async function getTournamentPlayerPublicProfile(tournamentId: number, playerId: number) {
  await ensureScoringEnabled(tournamentId);

  const playerMap = await resolveCricketFranchisePlayersByIds(tournamentId, [playerId]);
  const player = playerMap.get(playerId);

  if (!player) {
    throw new ScoringServiceError("Player not found", 404, "PLAYER_NOT_FOUND");
  }

  const team =
    player.teamId != null
      ? (await resolveCricketFranchiseTeamsByIds(tournamentId, [player.teamId])).get(player.teamId)
      : null;

  const { aggregates, matchIdsByPlayer } = await aggregateCompletedTournamentPlayers(
    tournamentId,
    { playerId },
  );
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

  const matchIds = matchIdsByPlayer.get(playerId) ?? [];
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

  return {
    player: {
      id: player.playerId,
      name: player.displayName,
      role: player.role,
      photoUrl: player.photoUrl,
      globalPlayerId: player.masterPlayerId,
    },
    team: team
      ? {
          id: team.teamId,
          name: team.name,
          shortCode: team.shortCode,
          color: team.color,
        }
      : null,
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

export async function getTournamentTeamPublicProfile(
  tournamentId: number,
  teamId: number,
  drawId?: number | null,
) {
  await ensureScoringEnabled(tournamentId);

  const team = (await resolveCricketFranchiseTeamsByIds(tournamentId, [teamId])).get(teamId);

  if (!team) {
    throw new ScoringServiceError("Team not found", 404, "TEAM_NOT_FOUND");
  }

  const standings = await getScoringStandings(tournamentId);
  const rows = [...standings];
  const groups = standings.groups ?? [];
  const drawNameById = new Map<number, string>();
  for (const row of rows) {
    if (row.drawId != null && row.drawName) drawNameById.set(row.drawId, row.drawName);
  }
  for (const group of groups) {
    if (group.drawId != null && group.drawName) drawNameById.set(group.drawId, group.drawName);
  }
  const scopedRows = rows.filter((row) => row.teamId === teamId && row.drawId != null);
  const legacyRow = scopedRows.length === 0 ? resolveTeamStanding(rows, teamId, null) : null;
  const competitionRows = scopedRows.length > 0 ? scopedRows : legacyRow ? [legacyRow] : [];
  const competitions = competitionRows.map((row) => {
    const scopedGroups =
      row.drawId == null ? groups : groups.filter((group) => group.drawId === row.drawId);
    const qualification = teamGroupQualifications(scopedGroups, teamId);
    return {
      drawId: row.drawId ?? null,
      drawName: row.drawId != null ? (drawNameById.get(row.drawId) ?? null) : null,
      rank: rankInDraw(rows, teamId, row.drawId ?? null),
      played: row.played,
      won: row.won,
      lost: row.lost,
      tied: row.tied,
      noResult: row.noResult,
      points: row.points,
      pointsPercentage: row.pointsPercentage,
      netRunRate: row.netRunRate,
      qualified: qualification.qualified,
      groupQualifications: qualification.groups,
    };
  });
  const standing =
    drawId != null
      ? (competitions.find((row) => row.drawId === drawId) ?? null)
      : competitions.length === 1
        ? competitions[0]!
        : null;

  const squadPlayers = await listCricketFranchisePlayers(tournamentId, teamId);
  const squad = squadPlayers.map((p) => ({
    id: p.playerId,
    name: p.displayName,
    role: p.role,
    status: p.status,
    soldPrice: null as number | null,
  }));

  const teamMatches = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        inArray(scoringMatchesTable.status, [...TERMINAL_SCORING_MATCH_STATUSES]),
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

  const { aggregates } = await aggregateCompletedTournamentPlayers(tournamentId, { teamId });
  const topBatsmen = [...aggregates.values()]
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 5)
    .map((agg) => ({
      playerId: agg.playerId,
      ...aggregateToJson(agg),
    }));

  const playerIds = topBatsmen.map((r) => r.playerId);
  const nameMap = await resolveCricketFranchisePlayersByIds(tournamentId, playerIds);

  return {
    team: {
      id: team.teamId,
      name: team.name,
      shortCode: team.shortCode,
      color: team.color,
      logoUrl: team.logoUrl,
    },
    standing,
    competitions,
    squad,
    recentResults: results,
    topBatsmen: topBatsmen.map((r) => ({
      playerId: r.playerId,
      playerName: nameMap.get(r.playerId)?.displayName ?? `Player ${r.playerId}`,
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
      playerId: playerTeamAssignmentsTable.auctionPlayerId,
      tournamentId: playerTeamAssignmentsTable.tournamentId,
      teamId: playerTeamAssignmentsTable.auctionTeamId,
    })
    .from(playerTeamAssignmentsTable)
    .where(
      and(
        eq(playerTeamAssignmentsTable.playerId, globalPlayerId),
        eq(playerTeamAssignmentsTable.sport, "cricket"),
        isNotNull(playerTeamAssignmentsTable.auctionPlayerId),
      ),
    );

  const tournamentIds = [
    ...new Set(
      rosterRows
        .map((r) => r.tournamentId)
        .filter((id): id is number => id != null),
    ),
  ];
  const tournaments =
    tournamentIds.length > 0
      ? await db
          .select({ id: tournamentsTable.id, name: tournamentsTable.name, sport: tournamentsTable.sport })
          .from(tournamentsTable)
          .where(inArray(tournamentsTable.id, tournamentIds))
      : [];

  const playerIds = [
    ...new Set(
      rosterRows
        .map((r) => r.playerId)
        .filter((id): id is number => id != null),
    ),
  ];
  const canonical = await loadCanonicalCricketStats(globalPlayerId);

  const momCount =
    playerIds.length === 0
      ? []
      : await db
          .select({
            id: scoringPlayerAwardsTable.id,
            tournamentId: scoringPlayerAwardsTable.tournamentId,
            playerId: scoringPlayerAwardsTable.playerId,
          })
          .from(scoringPlayerAwardsTable)
          .where(
            and(
              inArray(scoringPlayerAwardsTable.playerId, playerIds),
              eq(scoringPlayerAwardsTable.awardType, "man_of_the_match"),
            ),
          );
  const rosterPairs = new Set(
    rosterRows
      .filter((row) => row.tournamentId != null && row.playerId != null)
      .map((row) => `${row.tournamentId}:${row.playerId}`),
  );
  const scopedAwards = momCount.filter((award) =>
    rosterPairs.has(`${award.tournamentId}:${award.playerId}`),
  );

  return {
    globalPlayer: {
      id: gp.id,
      name: gp.displayName ?? gp.canonicalName,
      photoUrl: gp.photoUrl,
      city: gp.city,
      role: gp.defaultRole,
    },
    careerStats: canonical.career,
    tournamentStats: canonical.tournaments,
    manOfTheMatchCount: scopedAwards.length,
    tournaments: tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      sport: t.sport,
    })),
  };
}

/** Tournament awards board — reads existing scoring_player_awards rows. */
export async function listTournamentAwards(tournamentId: number) {
  await ensureScoringEnabled(tournamentId);

  const rows = await db
    .select({
      id: scoringPlayerAwardsTable.id,
      matchId: scoringPlayerAwardsTable.matchId,
      playerId: scoringPlayerAwardsTable.playerId,
      teamId: scoringPlayerAwardsTable.teamId,
      awardType: scoringPlayerAwardsTable.awardType,
      reason: scoringPlayerAwardsTable.reason,
      score: scoringPlayerAwardsTable.score,
      createdAt: scoringPlayerAwardsTable.createdAt,
    })
    .from(scoringPlayerAwardsTable)
    .where(eq(scoringPlayerAwardsTable.tournamentId, tournamentId))
    .orderBy(desc(scoringPlayerAwardsTable.createdAt));

  if (rows.length === 0) return [];

  const playerIds = [...new Set(rows.map((r) => r.playerId))];
  const teamIds = [...new Set(rows.map((r) => r.teamId))];
  const [playerMap, teamMap] = await Promise.all([
    resolveCricketFranchisePlayersByIds(tournamentId, playerIds),
    resolveCricketFranchiseTeamsByIds(tournamentId, teamIds),
  ]);

  return rows.map((row) => ({
    id: row.id,
    matchId: row.matchId,
    awardType: row.awardType,
    reason: row.reason,
    score: row.score,
    awardedAt: row.createdAt,
    playerId: row.playerId,
    playerName: playerMap.get(row.playerId)?.displayName ?? `Player #${row.playerId}`,
    teamId: row.teamId,
    teamName: teamMap.get(row.teamId)?.name ?? `Team #${row.teamId}`,
    shortCode: teamMap.get(row.teamId)?.shortCode ?? "",
  }));
}
