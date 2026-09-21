import { db } from "@workspace/db";
import {
  scoringEventsTable,
  scoringFixturesTable,
  scoringGroupMembersTable,
  scoringGroupsTable,
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
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { ScoringPlatformError } from "./scoring-platform/errors";
import {
  listCricketFranchisePlayers,
  listCricketFranchiseTeamIds,
  listCricketFranchiseTeams,
  resolveCricketFranchiseTeamsByIds,
} from "./master-sports/cricket-franchise-registry";

/** Soft floor only — match Playing XI size comes from RuntimeExecutionPolicy after Prepare. */
const MIN_SQUAD_ELIGIBLE = 2;
const CRICKET_SPORT_SLUG = "cricket" as const;

export function isKnockoutMatch(m: {
  matchTypeId?: string | null;
  roundName?: string | null;
}): boolean {
  if (m.matchTypeId === "knockout") return true;
  const round = (m.roundName ?? "").toLowerCase();
  if (
    round.includes("semi") ||
    round.includes("final") ||
    round.includes("quarter") ||
    round.includes("eliminator") ||
    round.includes("playoff") ||
    round.includes("qualifier")
  ) {
    return true;
  }
  return false;
}

/** Rebuild and persist standings from all finished league matches in a tournament. */
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

  // Exclude knockout matches (Semis, Finals, etc.) from league points tables
  const leagueFinished = finished.filter((m) => !isKnockoutMatch(m));

  const teamIdSet = new Set(registryTeamIds);
  for (const m of finished) {
    teamIdSet.add(m.homeTeamId);
    teamIdSet.add(m.awayTeamId);
  }
  const teamIds = [...teamIdSet].sort((a, b) => a - b);
  if (teamIds.length === 0) return [];

  const matchIds = leagueFinished.map((m) => m.id);
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

  const inputs: StandingsMatchInput[] = leagueFinished.map((m) => ({
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

  invalidateTournamentStandingsCache(tournamentId);

  return computed;
}

export type ScoringGroupResult = {
  id: number;
  name: string;
  sortOrder: number;
  rows: Array<{
    teamId: number;
    teamName: string;
    shortCode: string;
    color: string | null;
    played: number;
    won: number;
    lost: number;
    tied: number;
    noResult: number;
    points: number;
    netRunRate: number;
    extrasJson: Record<string, unknown> | null;
  }>;
};

type CacheItem<T> = {
  data: T;
  expiresAt: number;
};

const standingsCache = new Map<number, CacheItem<Awaited<ReturnType<typeof getScoringStandingsRaw>>>>();
const squadReadinessCache = new Map<number, CacheItem<SquadReadinessRow[]>>();
const scoringGateCache = new Map<number, CacheItem<{ scoringEnabled: boolean; sport: string | null }>>();

const STANDINGS_CACHE_TTL_MS = 30_000;
const SQUAD_CACHE_TTL_MS = 30_000;
const SCORING_GATE_CACHE_TTL_MS = 60_000;

export function invalidateTournamentStandingsCache(tournamentId: number) {
  standingsCache.delete(tournamentId);
}

export function invalidateTournamentSquadCache(tournamentId: number) {
  squadReadinessCache.delete(tournamentId);
}

export function invalidateTournamentScoringGateCache(tournamentId: number) {
  scoringGateCache.delete(tournamentId);
}

async function getScoringStandingsRaw(tournamentId: number) {
  await ensureScoringEnabled(tournamentId);

  const [rows, groups, groupMembers, fixtures, finishedMatches] = await Promise.all([
    db
      .select()
      .from(scoringStandingsTable)
      .where(eq(scoringStandingsTable.tournamentId, tournamentId)),
    db
      .select()
      .from(scoringGroupsTable)
      .where(eq(scoringGroupsTable.tournamentId, tournamentId))
      .orderBy(asc(scoringGroupsTable.sortOrder), asc(scoringGroupsTable.name)),
    db
      .select()
      .from(scoringGroupMembersTable),
    db
      .select({
        id: scoringFixturesTable.id,
        groupId: scoringFixturesTable.groupId,
      })
      .from(scoringFixturesTable)
      .where(eq(scoringFixturesTable.tournamentId, tournamentId)),
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

  const allTeamIdsSet = new Set<number>();
  for (const r of rows) allTeamIdsSet.add(r.teamId);
  for (const m of finishedMatches) {
    allTeamIdsSet.add(m.homeTeamId);
    allTeamIdsSet.add(m.awayTeamId);
  }
  for (const gm of groupMembers) allTeamIdsSet.add(gm.teamId);

  const teamMeta = await resolveCricketFranchiseTeamsByIds(tournamentId, [...allTeamIdsSet]);

  const globalRows = rows
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
        extrasJson: (r.extrasJson as Record<string, unknown> | null) ?? null,
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.netRunRate !== a.netRunRate) return b.netRunRate - a.netRunRate;
      return a.teamId - b.teamId;
    });

  // Calculate Group-Wise Standings if groups exist
  const groupResults: ScoringGroupResult[] = [];
  if (groups.length > 0) {
    const fixtureGroupMap = new Map<number, number>();
    for (const f of fixtures) {
      if (f.groupId != null) fixtureGroupMap.set(f.id, f.groupId);
    }

    const leagueFinishedMatches = finishedMatches.filter((m) => !isKnockoutMatch(m));
    const leagueMatchIds = leagueFinishedMatches.map((m) => m.id);
    const tieFlags = new Map<number, boolean>();

    if (leagueMatchIds.length > 0) {
      const completedEvents = await db
        .select({
          matchId: scoringEventsTable.matchId,
          payload: scoringEventsTable.payloadJson,
        })
        .from(scoringEventsTable)
        .where(
          and(
            inArray(scoringEventsTable.matchId, leagueMatchIds),
            eq(scoringEventsTable.eventType, CricketEventType.MATCH_COMPLETED),
          ),
        );

      for (const row of completedEvents) {
        const payload = row.payload as { isTie?: boolean } | null;
        if (payload?.isTie) tieFlags.set(row.matchId, true);
      }
    }

    for (const g of groups) {
      const members = groupMembers.filter((gm) => gm.groupId === g.id);
      const groupTeamIds = members.map((gm) => gm.teamId);
      const groupTeamSet = new Set(groupTeamIds);

      // Matches for this group: matches with fixture.groupId === g.id OR both teams in group
      const groupMatches = leagueFinishedMatches.filter((m) => {
        if (m.fixtureId && fixtureGroupMap.get(m.fixtureId) === g.id) return true;
        return groupTeamSet.has(m.homeTeamId) && groupTeamSet.has(m.awayTeamId);
      });

      const inputs: StandingsMatchInput[] = groupMatches.map((m) => ({
        matchId: m.id,
        status: m.status as "completed" | "abandoned",
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        summary: (m.summaryJson as CricketMatchSummary | null) ?? null,
        isTie: tieFlags.get(m.id),
      }));

      const computed = buildStandingsFromMatches(groupTeamIds, inputs);
      const groupRows = computed.map((r) => {
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
          netRunRate: r.netRunRate,
          extrasJson: {
            runsScored: r.runsScored,
            oversFaced: r.oversFaced,
            runsConceded: r.runsConceded,
            oversBowled: r.oversBowled,
          },
        };
      });

      groupResults.push({
        id: g.id,
        name: g.name,
        sortOrder: g.sortOrder,
        rows: groupRows,
      });
    }
  }

  type AugmentedStandings = typeof globalRows & {
    hasGroups: boolean;
    groups: ScoringGroupResult[];
  };

  const result = [...globalRows] as AugmentedStandings;
  result.hasGroups = groupResults.length > 0;
  result.groups = groupResults;

  return result;
}

export async function getScoringStandings(tournamentId: number) {
  const now = Date.now();
  const cached = standingsCache.get(tournamentId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const result = await getScoringStandingsRaw(tournamentId);
  standingsCache.set(tournamentId, {
    data: result,
    expiresAt: now + STANDINGS_CACHE_TTL_MS,
  });
  return result;
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
  const now = Date.now();
  const cached = squadReadinessCache.get(tournamentId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  await ensureScoringEnabled(tournamentId);

  const [teams, players] = await Promise.all([
    listCricketFranchiseTeams(tournamentId),
    listCricketFranchisePlayers(tournamentId),
  ]);

  const result = teams.map((team) => {
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
      ready: eligibleCount >= MIN_SQUAD_ELIGIBLE,
    };
  });

  squadReadinessCache.set(tournamentId, {
    data: result,
    expiresAt: now + SQUAD_CACHE_TTL_MS,
  });

  return result;
}

export async function ensureScoringEnabled(tournamentId: number) {
  const now = Date.now();
  const cached = scoringGateCache.get(tournamentId);
  let tournament: { scoringEnabled: boolean; sport: string | null } | undefined;

  if (cached && cached.expiresAt > now) {
    tournament = cached.data;
  } else {
    const [row] = await db
      .select({
        scoringEnabled: tournamentsTable.scoringEnabled,
        sport: tournamentsTable.sport,
      })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId))
      .limit(1);

    if (row) {
      tournament = { scoringEnabled: Boolean(row.scoringEnabled), sport: row.sport ?? null };
      scoringGateCache.set(tournamentId, {
        data: tournament,
        expiresAt: now + SCORING_GATE_CACHE_TTL_MS,
      });
    }
  }

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
