import { db } from "@workspace/db";
import {
  playersTable,
  scoringEventsTable,
  scoringMatchesTable,
  scoringStandingsTable,
  teamsTable,
  tournamentsTable,
} from "@workspace/db";
import {
  CricketEventType,
  buildStandingsFromMatches,
  type CricketMatchSummary,
  type StandingsMatchInput,
} from "@workspace/scoring-core";
import { and, eq, inArray, or } from "drizzle-orm";
import { ScoringServiceError } from "./scoring-service";

const MIN_PLAYING_XI = 11;
const CRICKET_SPORT_SLUG = "cricket" as const;

/** Rebuild and persist standings from all finished matches in a tournament. */
export async function rebuildTournamentStandings(tournamentId: number) {
  const teams = await db
    .select({ id: teamsTable.id })
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId));

  const teamIds = teams.map((t) => t.id);
  if (teamIds.length === 0) return [];

  const finished = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, CRICKET_SPORT_SLUG),
        or(
          eq(scoringMatchesTable.status, "completed"),
          eq(scoringMatchesTable.status, "abandoned"),
        ),
      ),
    );

  const matchIds = finished.map((m) => m.id);
  const tieFlags = new Map<number, boolean>();

  if (matchIds.length > 0) {
    const completedEvents = await db
      .select({
        matchId: scoringEventsTable.matchId,
        payload: scoringEventsTable.payloadJson,
      })
      .from(scoringEventsTable)
      .where(
        and(
          inArray(scoringEventsTable.matchId, matchIds),
          eq(scoringEventsTable.eventType, CricketEventType.MATCH_COMPLETED),
        ),
      );

    for (const row of completedEvents) {
      const payload = row.payload as { isTie?: boolean } | null;
      if (payload?.isTie) tieFlags.set(row.matchId, true);
    }
  }

  const inputs: StandingsMatchInput[] = finished.map((m) => ({
    matchId: m.id,
    status: m.status as "completed" | "abandoned",
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    summary: (m.summaryJson as CricketMatchSummary | null) ?? null,
    isTie: tieFlags.get(m.id),
  }));

  const computed = buildStandingsFromMatches(teamIds, inputs);

  await db.delete(scoringStandingsTable).where(eq(scoringStandingsTable.tournamentId, tournamentId));

  if (computed.length > 0) {
    await db.insert(scoringStandingsTable).values(
      computed.map((row) => ({
        tournamentId,
        teamId: row.teamId,
        played: row.played,
        won: row.won,
        lost: row.lost,
        tied: row.tied,
        noResult: row.noResult,
        points: row.points,
        netRunRate: row.netRunRate.toFixed(3),
        extrasJson: {
          runsScored: row.runsScored,
          oversFaced: row.oversFaced,
          runsConceded: row.runsConceded,
          oversBowled: row.oversBowled,
        },
      })),
    );
  }

  return computed;
}

export async function getScoringStandings(tournamentId: number) {
  await ensureScoringEnabled(tournamentId);

  const rows = await db
    .select({
      standing: scoringStandingsTable,
      teamName: teamsTable.name,
      teamShortCode: teamsTable.shortCode,
      teamColor: teamsTable.color,
    })
    .from(scoringStandingsTable)
    .innerJoin(teamsTable, eq(scoringStandingsTable.teamId, teamsTable.id))
    .where(eq(scoringStandingsTable.tournamentId, tournamentId))
    .orderBy(scoringStandingsTable.points, scoringStandingsTable.netRunRate);

  return rows
    .map((r) => ({
      teamId: r.standing.teamId,
      teamName: r.teamName,
      shortCode: r.teamShortCode,
      color: r.teamColor,
      played: r.standing.played,
      won: r.standing.won,
      lost: r.standing.lost,
      tied: r.standing.tied,
      noResult: r.standing.noResult,
      points: r.standing.points,
      netRunRate: r.standing.netRunRate ? Number(r.standing.netRunRate) : 0,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.netRunRate !== a.netRunRate) return b.netRunRate - a.netRunRate;
      return a.teamId - b.teamId;
    });
}

export type SquadReadinessRow = {
  teamId: number;
  name: string;
  shortCode: string;
  soldCount: number;
  retainedCount: number;
  eligibleCount: number;
  ready: boolean;
};

export async function getSquadReadiness(tournamentId: number): Promise<SquadReadinessRow[]> {
  await ensureScoringEnabled(tournamentId);

  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId))
    .orderBy(teamsTable.id);

  const players = await db
    .select({
      teamId: playersTable.teamId,
      status: playersTable.status,
      isNonPlayingMember: playersTable.isNonPlayingMember,
    })
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tournamentId));

  return teams.map((team) => {
    const squad = players.filter(
      (p) =>
        p.teamId === team.id &&
        (p.status === "sold" || p.status === "retained") &&
        !p.isNonPlayingMember,
    );
    const soldCount = squad.filter((p) => p.status === "sold").length;
    const retainedCount = squad.filter((p) => p.status === "retained").length;
    const eligibleCount = squad.length;
    return {
      teamId: team.id,
      name: team.name,
      shortCode: team.shortCode,
      soldCount,
      retainedCount,
      eligibleCount,
      ready: eligibleCount >= MIN_PLAYING_XI,
    };
  });
}

export async function ensureScoringEnabled(tournamentId: number) {
  const [tournament] = await db
    .select({
      scoringEnabled: tournamentsTable.scoringEnabled,
      sport: tournamentsTable.sport,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) {
    throw new ScoringServiceError("Tournament not found", 404, "TOURNAMENT_NOT_FOUND");
  }
  if (!tournament.scoringEnabled) {
    throw new ScoringServiceError("Scoring is not enabled for this tournament", 403, "SCORING_DISABLED");
  }
  if (tournament.sport !== CRICKET_SPORT_SLUG) {
    throw new ScoringServiceError("Only cricket scoring is supported in V1", 400, "UNSUPPORTED_SPORT");
  }
}
