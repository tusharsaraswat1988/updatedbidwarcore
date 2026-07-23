import { db } from "@workspace/db";
import {
  scoringEventsTable,
  scoringMatchesTable,
  scoringStandingsTable,
  tournamentsTable,
} from "@workspace/db";
import {
  CricketEventType,
  buildStandingsFromMatches,
  type CricketMatchSummary,
  type StandingsMatchInput,
} from "@workspace/scoring-core";
import { and, eq, inArray, or } from "drizzle-orm";
import { ScoringPlatformError } from "./scoring-platform/errors";
import {
  listCricketFranchisePlayers,
  listCricketFranchiseTeamIds,
  listCricketFranchiseTeams,
  resolveCricketFranchiseTeamsByIds,
} from "./master-sports/cricket-franchise-registry";

const MIN_PLAYING_XI = 11;
const CRICKET_SPORT_SLUG = "cricket" as const;

/** Rebuild and persist standings from all finished matches in a tournament. */
export async function rebuildTournamentStandings(tournamentId: number) {
  const [registryTeamIds, finished] = await Promise.all([
    listCricketFranchiseTeamIds(tournamentId),
    db
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
      ),
  ]);

  const teamIdSet = new Set(registryTeamIds);
  for (const m of finished) {
    teamIdSet.add(m.homeTeamId);
    teamIdSet.add(m.awayTeamId);
  }
  const teamIds = [...teamIdSet].sort((a, b) => a - b);
  if (teamIds.length === 0) return [];

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
    .select()
    .from(scoringStandingsTable)
    .where(eq(scoringStandingsTable.tournamentId, tournamentId));

  const teamIds = rows.map((r) => r.teamId);
  const teamMeta = await resolveCricketFranchiseTeamsByIds(tournamentId, teamIds);

  return rows
    .map((r) => {
      const team = teamMeta.get(r.teamId);
      return {
        teamId: r.teamId,
        teamName: team?.name ?? `Team ${r.teamId}`,
        shortCode: team?.shortCode ?? "—",
        color: team?.color ?? null,
        played: r.played,
        won: r.won,
        lost: r.lost,
        tied: r.tied,
        noResult: r.noResult,
        points: r.points,
        netRunRate: r.netRunRate ? Number(r.netRunRate) : 0,
      };
    })
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

  const [teams, players] = await Promise.all([
    listCricketFranchiseTeams(tournamentId),
    listCricketFranchisePlayers(tournamentId),
  ]);

  return teams.map((team) => {
    const squad = players.filter((p) => p.teamId === team.teamId);
    const soldCount = squad.filter(
      (p) => p.status === "sold" || p.assignmentType === "auction_sale",
    ).length;
    const retainedCount = squad.filter((p) => p.status === "retained").length;
    const eligibleCount = squad.length;
    return {
      teamId: team.teamId,
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
    throw new ScoringPlatformError("Tournament not found", 404, "TOURNAMENT_NOT_FOUND");
  }
  if (!tournament.scoringEnabled) {
    throw new ScoringPlatformError("Scoring is not enabled for this tournament", 403, "SCORING_DISABLED");
  }
  if (tournament.sport !== CRICKET_SPORT_SLUG) {
    throw new ScoringPlatformError("Only cricket scoring is supported in V1", 400, "UNSUPPORTED_SPORT");
  }
}
