import { db } from "@workspace/db";
import {
  playersTable,
  scoringEventsTable,
  scoringLeaderboardSnapshotsTable,
  scoringMatchPlayerStatsTable,
  scoringMatchesTable,
  scoringPlayerAwardsTable,
  teamsTable,
} from "@workspace/db";
import {
  buildCricketScorecardFromEvents,
  buildLeaderboard,
  scorecardToPlayerStats,
  aggregateTournamentPlayerStats,
  pickManOfTheMatch,
  type BattingCardRow,
  type BowlingCardRow,
  type CricketFullScorecard,
  type LeaderboardCategory,
  type LeaderboardRow,
  type PlayerMatchStatsInput,
  type ScoringEventEnvelope,
} from "@workspace/scoring-core";
import { and, eq, inArray } from "drizzle-orm";
import { ScoringServiceError } from "./scoring-service";
import { ensureScoringEnabled } from "./scoring-standings";

const LEADERBOARD_CATEGORIES: LeaderboardCategory[] = [
  "runs",
  "wickets",
  "sixes",
  "fours",
  "strike_rate",
  "economy",
  "catches",
  "stumpings",
];

function rowToEnvelope(row: typeof scoringEventsTable.$inferSelect): ScoringEventEnvelope {
  return {
    id: row.id,
    matchId: row.matchId,
    tournamentId: row.tournamentId,
    fixtureId: row.fixtureId,
    sportSlug: row.sportSlug as "cricket",
    eventType: row.eventType,
    eventVersion: row.eventVersion,
    sequence: row.sequence,
    occurredAt: row.occurredAt,
    actorType: row.actorType as ScoringEventEnvelope["actorType"],
    actorId: row.actorId,
    correlationId: row.correlationId,
    causationId: row.causationId,
    payload: row.payloadJson ?? {},
  };
}

async function loadMatchEvents(matchId: number): Promise<ScoringEventEnvelope[]> {
  const rows = await db
    .select()
    .from(scoringEventsTable)
    .where(eq(scoringEventsTable.matchId, matchId))
    .orderBy(scoringEventsTable.sequence);
  return rows.map(rowToEnvelope);
}

export async function buildMatchScorecard(
  match: typeof scoringMatchesTable.$inferSelect,
): Promise<CricketFullScorecard> {
  const events = await loadMatchEvents(match.id);
  return buildCricketScorecardFromEvents(match.id, events, {
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
  });
}

/** Project and persist per-player stats for a completed match. */
export async function projectMatchPlayerStats(matchId: number): Promise<void> {
  const [match] = await db
    .select()
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.id, matchId))
    .limit(1);

  if (!match || match.status !== "completed") return;

  const scorecard = await buildMatchScorecard(match);
  const playerRows = scorecardToPlayerStats(scorecard);

  await db
    .delete(scoringMatchPlayerStatsTable)
    .where(eq(scoringMatchPlayerStatsTable.matchId, matchId));

  if (playerRows.length === 0) return;

  await db.insert(scoringMatchPlayerStatsTable).values(
    playerRows.map((row) => ({
      matchId: match.id,
      tournamentId: match.tournamentId,
      playerId: row.playerId,
      teamId: row.teamId,
      innings: row.innings,
      battingJson: row.batting
        ? {
            runs: row.batting.runs,
            balls: row.batting.balls,
            fours: row.batting.fours,
            sixes: row.batting.sixes,
            strikeRate: row.batting.strikeRate,
            notOut: row.batting.notOut,
            dismissalType: row.batting.dismissalType,
          }
        : null,
      bowlingJson: row.bowling
        ? {
            overs: row.bowling.overs,
            maidens: row.bowling.maidens,
            runs: row.bowling.runs,
            wickets: row.bowling.wickets,
            wides: row.bowling.wides,
            noBalls: row.bowling.noBalls,
            economy: row.bowling.economy,
          }
        : null,
      fieldingJson: row.fielding,
    })),
  );
}

/** Project Man of the Match award for a completed match. */
export async function projectMatchAwards(matchId: number): Promise<void> {
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

  const playerStats: PlayerMatchStatsInput[] = statRows.map((row) => {
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
  });

  const mom = pickManOfTheMatch(playerStats, match.winnerTeamId);
  await db
    .delete(scoringPlayerAwardsTable)
    .where(eq(scoringPlayerAwardsTable.matchId, matchId));

  if (!mom) return;

  await db.insert(scoringPlayerAwardsTable).values({
    matchId: match.id,
    tournamentId: match.tournamentId,
    playerId: mom.playerId,
    teamId: mom.teamId,
    awardType: "man_of_the_match",
    selectionMethod: "auto",
    score: mom.score,
    reason: mom.reason,
  });
}

/** Rebuild all leaderboard snapshots for a tournament. */
export async function rebuildTournamentLeaderboards(tournamentId: number): Promise<void> {
  await ensureScoringEnabled(tournamentId);

  const statRows = await db
    .select()
    .from(scoringMatchPlayerStatsTable)
    .where(eq(scoringMatchPlayerStatsTable.tournamentId, tournamentId));

  const playerStats: PlayerMatchStatsInput[] = statRows.map((row) => {
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
  });

  const aggregates = aggregateTournamentPlayerStats(playerStats);

  await db
    .delete(scoringLeaderboardSnapshotsTable)
    .where(eq(scoringLeaderboardSnapshotsTable.tournamentId, tournamentId));

  const snapshots = LEADERBOARD_CATEGORIES.map((category) => ({
    tournamentId,
    category,
    rowsJson: buildLeaderboard(aggregates, category, 50),
  }));

  if (snapshots.length > 0) {
    await db.insert(scoringLeaderboardSnapshotsTable).values(snapshots);
  }
}

export type EnrichedLeaderboardRow = LeaderboardRow & {
  playerName: string;
  teamName: string;
  shortCode: string;
};

export async function getTournamentLeaderboard(
  tournamentId: number,
  category: LeaderboardCategory,
  limit = 20,
): Promise<EnrichedLeaderboardRow[]> {
  await ensureScoringEnabled(tournamentId);

  const [snapshot] = await db
    .select()
    .from(scoringLeaderboardSnapshotsTable)
    .where(
      and(
        eq(scoringLeaderboardSnapshotsTable.tournamentId, tournamentId),
        eq(scoringLeaderboardSnapshotsTable.category, category),
      ),
    )
    .limit(1);

  const rows = (snapshot?.rowsJson ?? []).slice(0, limit);
  if (rows.length === 0) return [];

  const playerIds: number[] = [...new Set(rows.map((r) => r.playerId))];
  const teamIds: number[] = [...new Set(rows.map((r) => r.teamId))];

  const [players, teams] = await Promise.all([
    db
      .select({ id: playersTable.id, name: playersTable.name })
      .from(playersTable)
      .where(
        and(
          eq(playersTable.tournamentId, tournamentId),
          inArray(playersTable.id, playerIds),
        ),
      ),
    db
      .select({ id: teamsTable.id, name: teamsTable.name, shortCode: teamsTable.shortCode })
      .from(teamsTable)
      .where(
        and(eq(teamsTable.tournamentId, tournamentId), inArray(teamsTable.id, teamIds)),
      ),
  ]);

  const playerMap = new Map(players.map((p) => [p.id, p.name]));
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  return rows.map((row: LeaderboardRow) => {
    const team = teamMap.get(row.teamId);
    return {
      ...row,
      playerName: playerMap.get(row.playerId) ?? `Player ${row.playerId}`,
      teamName: team?.name ?? "Team",
      shortCode: team?.shortCode ?? "—",
    };
  });
}

export async function getPublicMatchScorecard(tournamentId: number, matchId: number) {
  await ensureScoringEnabled(tournamentId);

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

  if (!match) {
    throw new ScoringServiceError("Match not found", 404, "MATCH_NOT_FOUND");
  }

  const scorecard = await buildMatchScorecard(match);

  const [homeTeam, awayTeam] = await Promise.all([
    db
      .select({ id: teamsTable.id, name: teamsTable.name, shortCode: teamsTable.shortCode })
      .from(teamsTable)
      .where(eq(teamsTable.id, match.homeTeamId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ id: teamsTable.id, name: teamsTable.name, shortCode: teamsTable.shortCode })
      .from(teamsTable)
      .where(eq(teamsTable.id, match.awayTeamId))
      .limit(1)
      .then((r) => r[0]),
  ]);

  const playerIds = new Set<number>();
  for (const inn of scorecard.innings) {
    for (const b of inn.batting) playerIds.add(b.playerId);
    for (const b of inn.bowling) playerIds.add(b.playerId);
  }

  const players =
    playerIds.size > 0
      ? await db
          .select({ id: playersTable.id, name: playersTable.name })
          .from(playersTable)
          .where(
            and(
              eq(playersTable.tournamentId, tournamentId),
              inArray(playersTable.id, [...playerIds]),
            ),
          )
      : [];

  const playerMap = new Map(players.map((p) => [p.id, p.name]));

  const [momAward] = await db
    .select()
    .from(scoringPlayerAwardsTable)
    .where(
      and(
        eq(scoringPlayerAwardsTable.matchId, matchId),
        eq(scoringPlayerAwardsTable.awardType, "man_of_the_match"),
      ),
    )
    .limit(1);

  let manOfTheMatch: {
    playerId: number;
    playerName: string;
    teamId: number;
    reason: string | null;
  } | null = null;

  if (momAward) {
    manOfTheMatch = {
      playerId: momAward.playerId,
      playerName: playerMap.get(momAward.playerId) ?? `Player ${momAward.playerId}`,
      teamId: momAward.teamId,
      reason: momAward.reason,
    };
  }

  return {
    match: {
      id: match.id,
      status: match.status,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeTeam: homeTeam ?? null,
      awayTeam: awayTeam ?? null,
      winnerTeamId: match.winnerTeamId,
      resultSummary: match.resultSummary,
      roundName: match.roundName,
      completedAt: match.completedAt?.toISOString() ?? null,
    },
    scorecard,
    players: Object.fromEntries(playerMap),
    manOfTheMatch,
  };
}
