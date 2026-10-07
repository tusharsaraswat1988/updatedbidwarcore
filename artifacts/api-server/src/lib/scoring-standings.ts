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
  applyQualification,
  buildStandingsFromMatches,
  rankPersistedCricketStandings,
  type CricketMatchSummary,
  type HeadToHeadMatch,
  type StandingsMatchInput,
} from "@workspace/scoring-core";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { ScoringPlatformError } from "./scoring-platform/errors";
import {
  assertSportModule,
  ModuleAuthorizationError,
} from "../middleware/require-module";
import { InvalidTournamentModuleStateError } from "@workspace/platform-core";
import {
  listCricketFranchisePlayers,
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

export async function loadTieFlags(matchIds: number[]) {
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

export type CompetitionFixtureRef = {
  id: number;
  drawId: number | null;
  groupId: number | null;
  matchTypeId?: string | null;
  roundName?: string | null;
};

export type CompetitionMatchRef = StandingsMatchInput & {
  fixtureId: number | null;
};

/**
 * A cricket competition match counts only when its fixture belongs to this draw
 * and this group. Team membership is not a substitute for that lineage.
 * Fixture-less matches are excluded.
 */
export function fixtureBelongsToDrawGroup(
  fixture: CompetitionFixtureRef | undefined,
  group: { id: number; drawId: number },
): boolean {
  if (!fixture) return false;
  if (fixture.drawId == null || fixture.groupId == null) return false;
  if (fixture.drawId !== group.drawId || fixture.groupId !== group.id) return false;
  return !isKnockoutMatch(fixture);
}

export function selectLeagueMatchesForGroup<T extends { fixtureId: number | null }>(
  matches: T[],
  fixturesById: Map<number, CompetitionFixtureRef>,
  group: { id: number; drawId: number },
): T[] {
  return matches.filter((match) => {
    if (match.fixtureId == null) return false;
    return fixtureBelongsToDrawGroup(fixturesById.get(match.fixtureId), group);
  });
}

/**
 * League matches whose fixture is in this draw. Knockout and fixture-less matches stay out.
 * When the draw has groups, only those groups' fixtures count. A draw with no groups uses
 * its own non-knockout fixtures.
 */
export function selectLeagueMatchesForDraw<T extends { fixtureId: number | null }>(
  matches: T[],
  fixtures: CompetitionFixtureRef[],
  drawId: number,
  groupIds: Set<number>,
): T[] {
  const allowed = new Set(
    fixtures
      .filter((fixture) => {
        if (fixture.drawId !== drawId || isKnockoutMatch(fixture)) return false;
        if (groupIds.size > 0) {
          return fixture.groupId != null && groupIds.has(fixture.groupId);
        }
        return fixture.groupId == null;
      })
      .map((fixture) => fixture.id),
  );
  return matches.filter((match) => match.fixtureId != null && allowed.has(match.fixtureId));
}

/**
 * Draw-scoped points table. Ranking is the existing engine; this function only
 * chooses the matches and teams that belong to one draw.
 */
export function projectDrawStandings(input: {
  drawId: number;
  groups: Array<{ id: number; teamIds: number[] }>;
  fixtures: CompetitionFixtureRef[];
  matches: CompetitionMatchRef[];
}) {
  const groupIds = new Set(input.groups.map((group) => group.id));
  const leagueMatches = selectLeagueMatchesForDraw(
    input.matches,
    input.fixtures,
    input.drawId,
    groupIds,
  );
  const memberIds = input.groups.flatMap((group) => group.teamIds);
  const matchTeamIds = leagueMatches.flatMap((match) => [match.homeTeamId, match.awayTeamId]);
  const teamIds = [...new Set([...memberIds, ...matchTeamIds])].sort((a, b) => a - b);
  return buildStandingsFromMatches(teamIds, leagueMatches).map((row) => ({
    ...row,
    drawId: input.drawId,
  }));
}

export function projectGroupStandings(input: {
  drawId: number;
  groupId: number;
  teamIds: number[];
  fixtures: CompetitionFixtureRef[];
  matches: CompetitionMatchRef[];
}) {
  const fixturesById = new Map(input.fixtures.map((fixture) => [fixture.id, fixture]));
  const leagueMatches = selectLeagueMatchesForGroup(input.matches, fixturesById, {
    id: input.groupId,
    drawId: input.drawId,
  });
  return buildStandingsFromMatches(input.teamIds, leagueMatches);
}

export function toHeadToHeadMatch(
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

function finishedCricketMatchFilter(tournamentId: number) {
  return and(
    eq(scoringMatchesTable.tournamentId, tournamentId),
    eq(scoringMatchesTable.sportSlug, CRICKET_SPORT_SLUG),
    or(
      eq(scoringMatchesTable.status, "completed"),
      eq(scoringMatchesTable.status, "abandoned"),
      eq(scoringMatchesTable.status, "no_result"),
      eq(scoringMatchesTable.status, "walkover"),
    ),
  );
}

async function loadDrawCompetitionInputs(tournamentId: number, drawId: number) {
  const [groups, fixtures, finished] = await Promise.all([
    db
      .select()
      .from(scoringGroupsTable)
      .where(
        and(eq(scoringGroupsTable.tournamentId, tournamentId), eq(scoringGroupsTable.drawId, drawId)),
      ),
    db
      .select({
        id: scoringFixturesTable.id,
        drawId: scoringFixturesTable.drawId,
        groupId: scoringFixturesTable.groupId,
        roundName: scoringFixturesTable.roundName,
      })
      .from(scoringFixturesTable)
      .where(
        and(
          eq(scoringFixturesTable.tournamentId, tournamentId),
          eq(scoringFixturesTable.drawId, drawId),
        ),
      ),
    db.select().from(scoringMatchesTable).where(finishedCricketMatchFilter(tournamentId)),
  ]);

  const groupIds = groups.map((group) => group.id);
  const members =
    groupIds.length === 0
      ? []
      : await db
          .select()
          .from(scoringGroupMembersTable)
          .where(inArray(scoringGroupMembersTable.groupId, groupIds));

  const membersByGroup = new Map<number, number[]>();
  for (const member of members) {
    const list = membersByGroup.get(member.groupId) ?? [];
    list.push(member.teamId);
    membersByGroup.set(member.groupId, list);
  }

  const leagueFixtures = fixtures.filter((fixture) => {
    if (isKnockoutMatch(fixture)) return false;
    if (groups.length > 0) return fixture.groupId != null;
    return fixture.groupId == null;
  });
  const leagueFixtureIds = new Set(leagueFixtures.map((fixture) => fixture.id));
  const drawMatches = finished.filter(
    (match) => match.fixtureId != null && leagueFixtureIds.has(match.fixtureId),
  );
  const tieFlags = await loadTieFlags(drawMatches.map((match) => match.id));
  const matchInputs: CompetitionMatchRef[] = drawMatches.map((match) => ({
    matchId: match.id,
    fixtureId: match.fixtureId,
    status: match.status as "completed" | "abandoned" | "walkover",
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    summary: (match.summaryJson as CricketMatchSummary | null) ?? null,
    isTie: tieFlags.get(match.id),
  }));

  return {
    groups: groups.map((group) => ({
      id: group.id,
      teamIds: membersByGroup.get(group.id) ?? [],
    })),
    fixtures,
    matches: matchInputs,
  };
}

/** Rebuild one draw from that draw's league fixtures only. */
export async function rebuildDrawStandings(tournamentId: number, drawId: number) {
  const inputs = await loadDrawCompetitionInputs(tournamentId, drawId);
  const computed = projectDrawStandings({
    drawId,
    groups: inputs.groups,
    fixtures: inputs.fixtures,
    matches: inputs.matches,
  });

  await db
    .delete(scoringStandingsTable)
    .where(
      and(eq(scoringStandingsTable.tournamentId, tournamentId), eq(scoringStandingsTable.drawId, drawId)),
    );

  if (computed.length > 0) {
    await db.insert(scoringStandingsTable).values(
      computed.map((row) => ({
        tournamentId,
        drawId,
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

/**
 * Rebuild every draw in the tournament as its own competition.
 * Legacy rows with no draw are removed. They are not assigned to a draw.
 */
export async function rebuildTournamentStandings(tournamentId: number) {
  const draws = await db
    .select({ id: scoringDrawsTable.id })
    .from(scoringDrawsTable)
    .where(eq(scoringDrawsTable.tournamentId, tournamentId));

  const computed = [];
  for (const draw of draws) {
    computed.push(...(await rebuildDrawStandings(tournamentId, draw.id)));
  }

  if (draws.length > 0) {
    await db
      .delete(scoringStandingsTable)
      .where(and(eq(scoringStandingsTable.tournamentId, tournamentId), isNull(scoringStandingsTable.drawId)));
  }

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
    /** Server qualification for this group's configured cutoff. */
    qualified: boolean;
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
        drawId: scoringFixturesTable.drawId,
        groupId: scoringFixturesTable.groupId,
        roundName: scoringFixturesTable.roundName,
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

  const fixturesById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const lineageMatches = finishedMatches.filter((match) => {
    if (match.fixtureId == null) return false;
    const fixture = fixturesById.get(match.fixtureId);
    return fixture?.drawId != null && !isKnockoutMatch(fixture);
  });
  const tieFlags = await loadTieFlags(lineageMatches.map((match) => match.id));

  const groupIdsByDraw = new Map<number, Set<number>>();
  for (const group of groups) {
    if (group.drawId == null) continue;
    const ids = groupIdsByDraw.get(group.drawId) ?? new Set<number>();
    ids.add(group.id);
    groupIdsByDraw.set(group.drawId, ids);
  }

  const drawOrder = [...draws].sort((a, b) => a.id - b.id);
  const globalRows = drawOrder.flatMap((draw) => {
    const drawRows = rows.filter((row) => row.drawId === draw.id);
    const drawMatches = selectLeagueMatchesForDraw(
      lineageMatches,
      fixtures,
      draw.id,
      groupIdsByDraw.get(draw.id) ?? new Set(),
    );
    return rankPersistedCricketStandings(
      drawRows.map((row) => {
        const team = teamMeta.get(row.teamId);
        return {
          teamId: row.teamId,
          drawId: draw.id,
          teamName: team?.name ?? `Team ${row.teamId}`,
          shortCode: team?.shortCode ?? "—",
          color: team?.color ?? null,
          played: row.played,
          won: row.won,
          lost: row.lost,
          tied: row.tied,
          noResult: row.noResult,
          points: row.points,
          netRunRate: row.netRunRate,
          extras: row.extrasJson,
          extrasJson: (row.extrasJson as Record<string, unknown> | null) ?? null,
        };
      }),
      drawMatches.map((match) => toHeadToHeadMatch(match, tieFlags)),
    );
  });

  // Calculate Group-Wise Standings if groups exist
  const groupResults: ScoringGroupResult[] = [];
  if (groups.length > 0) {
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

      const groupMatches = selectLeagueMatchesForGroup(lineageMatches, fixturesById, {
        id: g.id,
        drawId: g.drawId,
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
      const qualifiersPerGroup = g.drawId != null ? (qualifiersByDraw.get(g.drawId) ?? 2) : 2;
      const groupRows = applyQualification(
        computed.map((r) => {
          const team = teamMeta.get(r.teamId);
          return {
            teamId: r.teamId,
            drawId: g.drawId,
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
        }),
        qualifiersPerGroup,
      );

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
        qualifiersPerGroup,
        rows: groupRows,
      });
    }
  }

  let tableRows = globalRows;
  if (globalRows.length === 0) {
    const legacyRows = rows.filter((row) => row.drawId == null);
    if (legacyRows.length > 0) {
      tableRows = rankPersistedCricketStandings(
        legacyRows.map((row) => {
          const team = teamMeta.get(row.teamId);
          return {
            teamId: row.teamId,
            drawId: null,
            teamName: team?.name ?? `Team ${row.teamId}`,
            shortCode: team?.shortCode ?? "—",
            color: team?.color ?? null,
            played: row.played,
            won: row.won,
            lost: row.lost,
            tied: row.tied,
            noResult: row.noResult,
            points: row.points,
            netRunRate: row.netRunRate,
            extras: row.extrasJson,
            extrasJson: (row.extrasJson as Record<string, unknown> | null) ?? null,
          };
        }),
        lineageMatches.map((match) => toHeadToHeadMatch(match, tieFlags)),
      );
    }
  }

  const drawNameById = new Map(draws.map((draw) => [draw.id, draw.name?.trim() || null]));
  const namedRows = tableRows.map((row) => ({
    ...row,
    drawName: row.drawId != null ? (drawNameById.get(row.drawId) ?? null) : null,
  }));

  type AugmentedStandings = typeof namedRows & {
    hasGroups: boolean;
    groups: ScoringGroupResult[];
  };

  const result = [...namedRows] as AugmentedStandings;
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
