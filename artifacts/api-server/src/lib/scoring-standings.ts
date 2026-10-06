import {
  db,
  scoringDrawsTable,
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
  buildHeadToHeadIndex,
  buildStandingsFromMatches,
  rankCricketStandings,
  type CricketMatchSummary,
  type HeadToHeadMatch,
  type StandingsMatchInput,
} from "@workspace/scoring-core";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { ScoringPlatformError } from "./scoring-platform/errors";
import {
  assertSportModule,
  ModuleAuthorizationError,
} from "../middleware/require-module";
import { InvalidTournamentModuleStateError } from "@workspace/platform-core";
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

async function loadTieFlags(matchIds: number[]) {
  const tieFlags = new Map<number, boolean>();
  if (matchIds.length === 0) return tieFlags;

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
  return tieFlags;
}

function toHeadToHeadMatch(
  match: {
    id: number;
    status: string;
    homeTeamId: number;
    awayTeamId: number;
    winnerTeamId: number | null;
    summaryJson: unknown;
  },
  tieFlags: Map<number, boolean>,
): HeadToHeadMatch {
  const summary = match.summaryJson as { winnerTeamId?: number | null } | null;
  return {
    status: match.status,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    winnerTeamId: summary?.winnerTeamId ?? match.winnerTeamId ?? null,
    isTie: tieFlags.get(match.id),
  };
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
            eq(scoringMatchesTable.status, "no_result"),
            eq(scoringMatchesTable.status, "walkover"),
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

  const tieFlags = await loadTieFlags(leagueFinished.map((m) => m.id));

  const inputs: StandingsMatchInput[] = leagueFinished.map((m) => ({
    matchId: m.id,
    status: m.status as "completed" | "abandoned" | "walkover",
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
  drawId?: number;
  drawName?: string | null;
  displayName?: string;
  name: string;
  sortOrder: number;
  /** From the draw configuration. Display and highlight only; qualification still uses the progression service. */
  qualifiersPerGroup: number;
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
    pointsPercentage: number;
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
const scoringGateCache = new Map<
  number,
  CacheItem<{ auctionEnabled?: boolean | null; scoringEnabled?: boolean | null; sport: string | null }>
>();

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

  const [rows, groups, groupMembers, fixtures, finishedMatches, draws] = await Promise.all([
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
            eq(scoringMatchesTable.status, "no_result"),
            eq(scoringMatchesTable.status, "walkover"),
          ),
        ),
      ),
    db
      .select({
        id: scoringDrawsTable.id,
        name: scoringDrawsTable.name,
        configJson: scoringDrawsTable.configJson,
      })
      .from(scoringDrawsTable)
      .where(eq(scoringDrawsTable.tournamentId, tournamentId)),
  ]);

  const allTeamIdsSet = new Set<number>();
  for (const r of rows) allTeamIdsSet.add(r.teamId);
  for (const m of finishedMatches) {
    allTeamIdsSet.add(m.homeTeamId);
    allTeamIdsSet.add(m.awayTeamId);
  }
  for (const gm of groupMembers) allTeamIdsSet.add(gm.teamId);

  const teamMeta = await resolveCricketFranchiseTeamsByIds(tournamentId, [...allTeamIdsSet]);

  const leagueFinishedMatches = finishedMatches.filter((m) => !isKnockoutMatch(m));
  const tieFlags = await loadTieFlags(leagueFinishedMatches.map((m) => m.id));
  const headToHead = buildHeadToHeadIndex(
    leagueFinishedMatches.map((m) => toHeadToHeadMatch(m, tieFlags)),
  );

  const globalRows = rankCricketStandings(
    rows.map((r) => {
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
    }),
    headToHead,
  );

  // Calculate Group-Wise Standings if groups exist
  const groupResults: ScoringGroupResult[] = [];
  if (groups.length > 0) {
    const fixtureGroupMap = new Map<number, number>();
    for (const f of fixtures) {
      if (f.groupId != null) fixtureGroupMap.set(f.id, f.groupId);
    }

    const drawNameMap = new Map<number, string>();
    const qualifiersByDraw = new Map<number, number>();
    for (const d of draws) {
      if (d.name) drawNameMap.set(d.id, d.name);
      const configured = (d.configJson as { knockoutTeamsPerGroup?: number } | null)?.knockoutTeamsPerGroup;
      qualifiersByDraw.set(
        d.id,
        typeof configured === "number" && configured > 0 ? configured : 2,
      );
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
        status: m.status as "completed" | "abandoned" | "walkover",
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
          pointsPercentage: r.pointsPercentage,
          netRunRate: r.netRunRate,
          extrasJson: {
            runsScored: r.runsScored,
            oversFaced: r.oversFaced,
            runsConceded: r.runsConceded,
            oversBowled: r.oversBowled,
          },
        };
      });

      const drawName = g.drawId ? (drawNameMap.get(g.drawId) ?? null) : null;
      const displayName =
        drawName && !g.name.toLowerCase().includes(drawName.toLowerCase())
          ? `${drawName} — ${g.name}`
          : g.name;

      groupResults.push({
        id: g.id,
        drawId: g.drawId,
        drawName,
        displayName,
        name: g.name,
        sortOrder: g.sortOrder,
        qualifiersPerGroup: g.drawId != null ? (qualifiersByDraw.get(g.drawId) ?? 2) : 2,
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

export async function getScoringStandings(
  tournamentId: number,
  options?: { bypassCache?: boolean },
) {
  const now = Date.now();
  if (!options?.bypassCache) {
    const cached = standingsCache.get(tournamentId);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
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
  let tournament: { auctionEnabled?: boolean | null; scoringEnabled?: boolean | null; sport: string | null } | undefined;

  if (cached && cached.expiresAt > now) {
    tournament = cached.data;
  } else {
    const [row] = await db
      .select({
        id: tournamentsTable.id,
        auctionEnabled: tournamentsTable.auctionEnabled,
        scoringEnabled: tournamentsTable.scoringEnabled,
        sport: tournamentsTable.sport,
      })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId))
      .limit(1);

    if (row) {
      tournament = {
        auctionEnabled: row.auctionEnabled,
        scoringEnabled: row.scoringEnabled,
        sport: row.sport ?? null,
      };
      scoringGateCache.set(tournamentId, {
        data: tournament,
        expiresAt: now + SCORING_GATE_CACHE_TTL_MS,
      });
    }
  }

  try {
    assertSportModule(tournament, CRICKET_SPORT_SLUG);
  } catch (err) {
    if (err instanceof ModuleAuthorizationError) {
      throw new ScoringPlatformError(err.message, err.status, err.code);
    }
    if (err instanceof InvalidTournamentModuleStateError) {
      throw new ScoringPlatformError(
        "A tournament must have at least one enabled product module (auction or scoring).",
        400,
        "INVALID_MODULE_STATE",
      );
    }
    throw err;
  }
}
