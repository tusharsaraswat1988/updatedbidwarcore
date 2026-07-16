import { db } from "@workspace/db";
import {
  scoringDrawsTable,
  scoringFixturesTable,
  scoringGroupMembersTable,
  scoringGroupsTable,
  scoringMatchSquadsTable,
  scoringMatchesTable,
  scoringOfficialsTable,
  scoringSessionsTable,
  scoringVenuesTable,
  teamsTable,
  tournamentsTable,
  type MatchSquadJson,
  type ScoringDrawConfigJson,
  type ScoringDrawFormat,
} from "@workspace/db";
import {
  createInitialCricketState,
  distributeMatchDates,
  generateGroupStageSchedules,
  generateKnockoutSchedule,
  generateRoundRobinSchedule,
  type ScheduledFixture,
} from "@workspace/scoring-core";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ScoringServiceError } from "./scoring-service";

async function ensureScoringTournament(tournamentId: number) {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  if (!tournament) {
    throw new ScoringServiceError("Tournament not found", 404, "TOURNAMENT_NOT_FOUND");
  }
  if (!tournament.scoringEnabled) {
    throw new ScoringServiceError("Scoring is not enabled", 403, "SCORING_DISABLED");
  }
  if (tournament.sport !== "cricket") {
    throw new ScoringServiceError("Cricket scoring only", 400, "UNSUPPORTED_SPORT");
  }
  return tournament;
}

async function ensureTeamsInTournament(tournamentId: number, teamIds: number[]) {
  if (teamIds.length === 0) return;
  const rows = await db
    .select({ id: teamsTable.id })
    .from(teamsTable)
    .where(
      and(eq(teamsTable.tournamentId, tournamentId), inArray(teamsTable.id, teamIds)),
    );
  if (rows.length !== teamIds.length) {
    throw new ScoringServiceError("One or more teams not in tournament", 400, "INVALID_TEAM");
  }
}

// ─── Venues ───────────────────────────────────────────────────────────────────

export async function listScoringVenues(tournamentId: number) {
  await ensureScoringTournament(tournamentId);
  return db
    .select()
    .from(scoringVenuesTable)
    .where(eq(scoringVenuesTable.tournamentId, tournamentId))
    .orderBy(asc(scoringVenuesTable.sortOrder), asc(scoringVenuesTable.name));
}

export async function createScoringVenue(
  tournamentId: number,
  input: {
    name: string;
    city?: string | null;
    address?: string | null;
    surfaceType?: string | null;
    sortOrder?: number;
  },
) {
  await ensureScoringTournament(tournamentId);
  const [row] = await db
    .insert(scoringVenuesTable)
    .values({
      tournamentId,
      name: input.name,
      city: input.city ?? null,
      address: input.address ?? null,
      surfaceType: input.surfaceType ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateScoringVenue(
  tournamentId: number,
  venueId: number,
  patch: Partial<{
    name: string;
    city: string | null;
    address: string | null;
    surfaceType: string | null;
    status: string;
    sortOrder: number;
  }>,
) {
  await ensureScoringTournament(tournamentId);
  const [row] = await db
    .update(scoringVenuesTable)
    .set(patch)
    .where(
      and(
        eq(scoringVenuesTable.id, venueId),
        eq(scoringVenuesTable.tournamentId, tournamentId),
      ),
    )
    .returning();
  if (!row) throw new ScoringServiceError("Venue not found", 404, "VENUE_NOT_FOUND");
  return row;
}

export async function deleteScoringVenue(tournamentId: number, venueId: number) {
  await ensureScoringTournament(tournamentId);
  const [row] = await db
    .delete(scoringVenuesTable)
    .where(
      and(
        eq(scoringVenuesTable.id, venueId),
        eq(scoringVenuesTable.tournamentId, tournamentId),
      ),
    )
    .returning();
  if (!row) throw new ScoringServiceError("Venue not found", 404, "VENUE_NOT_FOUND");
  return row;
}

// ─── Officials ────────────────────────────────────────────────────────────────

export async function listScoringOfficials(tournamentId: number) {
  await ensureScoringTournament(tournamentId);
  return db
    .select()
    .from(scoringOfficialsTable)
    .where(eq(scoringOfficialsTable.tournamentId, tournamentId))
    .orderBy(asc(scoringOfficialsTable.name));
}

export async function createScoringOfficial(
  tournamentId: number,
  input: { name: string; role?: string; mobile?: string | null; email?: string | null },
) {
  await ensureScoringTournament(tournamentId);
  const [row] = await db
    .insert(scoringOfficialsTable)
    .values({
      tournamentId,
      name: input.name,
      role: input.role ?? "scorer",
      mobile: input.mobile ?? null,
      email: input.email ?? null,
    })
    .returning();
  return row;
}

export async function updateScoringOfficial(
  tournamentId: number,
  officialId: number,
  patch: Partial<{ name: string; role: string; mobile: string | null; email: string | null }>,
) {
  await ensureScoringTournament(tournamentId);
  const [row] = await db
    .update(scoringOfficialsTable)
    .set(patch)
    .where(
      and(
        eq(scoringOfficialsTable.id, officialId),
        eq(scoringOfficialsTable.tournamentId, tournamentId),
      ),
    )
    .returning();
  if (!row) throw new ScoringServiceError("Official not found", 404, "OFFICIAL_NOT_FOUND");
  return row;
}

export async function deleteScoringOfficial(tournamentId: number, officialId: number) {
  await ensureScoringTournament(tournamentId);
  const [row] = await db
    .delete(scoringOfficialsTable)
    .where(
      and(
        eq(scoringOfficialsTable.id, officialId),
        eq(scoringOfficialsTable.tournamentId, tournamentId),
      ),
    )
    .returning();
  if (!row) throw new ScoringServiceError("Official not found", 404, "OFFICIAL_NOT_FOUND");
  return row;
}

// ─── Draws & schedule generation ──────────────────────────────────────────────

function buildFixturesForFormat(
  format: ScoringDrawFormat,
  config: ScoringDrawConfigJson,
): ScheduledFixture[] {
  const teamIds = config.teamIds ?? [];
  if (teamIds.length < 2) {
    throw new ScoringServiceError("At least 2 teams required", 400, "INVALID_TEAMS");
  }

  switch (format) {
    case "round_robin":
    case "league":
      return generateRoundRobinSchedule(teamIds);
    case "knockout":
      return generateKnockoutSchedule(teamIds);
    case "league_knockout": {
      const groups = config.groups;
      if (!groups?.length) {
        throw new ScoringServiceError("groups required for league_knockout", 400, "INVALID_GROUPS");
      }
      return generateGroupStageSchedules(groups);
    }
    default:
      throw new ScoringServiceError(`Unknown format: ${format}`, 400, "INVALID_FORMAT");
  }
}

export async function listScoringDraws(tournamentId: number) {
  await ensureScoringTournament(tournamentId);
  return db
    .select()
    .from(scoringDrawsTable)
    .where(eq(scoringDrawsTable.tournamentId, tournamentId))
    .orderBy(desc(scoringDrawsTable.createdAt));
}

export async function generateScoringDraw(input: {
  tournamentId: number;
  name: string;
  format: ScoringDrawFormat;
  teamIds: number[];
  groups?: Array<{ name: string; teamIds: number[] }>;
  oversLimit?: number;
  venueId?: number | null;
  startDate?: string | null;
  matchesPerDay?: number;
  createMatches?: boolean;
  officials?: { scorers?: number[]; matchReferee?: number | null };
}) {
  await ensureScoringTournament(input.tournamentId);
  await ensureTeamsInTournament(input.tournamentId, input.teamIds);

  const config: ScoringDrawConfigJson = {
    oversLimit: input.oversLimit ?? 20,
    teamIds: input.teamIds,
    groups: input.groups,
  };

  const rawFixtures = buildFixturesForFormat(input.format, config);
  const scheduled =
    input.startDate != null
      ? distributeMatchDates(rawFixtures, input.startDate, input.matchesPerDay ?? 2)
      : rawFixtures.map((f) => ({ ...f, scheduledAt: undefined as string | undefined }));

  const [draw] = await db
    .insert(scoringDrawsTable)
    .values({
      tournamentId: input.tournamentId,
      name: input.name,
      format: input.format,
      configJson: config,
      status: "published",
    })
    .returning();

  const groupIdByName = new Map<string, number>();
  if (input.format === "league_knockout" && input.groups?.length) {
    for (let i = 0; i < input.groups.length; i++) {
      const g = input.groups[i]!;
      const [groupRow] = await db
        .insert(scoringGroupsTable)
        .values({
          tournamentId: input.tournamentId,
          drawId: draw.id,
          name: g.name,
          sortOrder: i,
        })
        .returning();
      groupIdByName.set(g.name, groupRow.id);
      for (let s = 0; s < g.teamIds.length; s++) {
        await db.insert(scoringGroupMembersTable).values({
          groupId: groupRow.id,
          teamId: g.teamIds[s]!,
          seed: s + 1,
        });
      }
    }
  }

  let venueName: string | null = null;
  if (input.venueId) {
    const [venue] = await db
      .select()
      .from(scoringVenuesTable)
      .where(
        and(
          eq(scoringVenuesTable.id, input.venueId),
          eq(scoringVenuesTable.tournamentId, input.tournamentId),
        ),
      )
      .limit(1);
    venueName = venue?.name ?? null;
  }

  const fixtureRows = [];
  for (let i = 0; i < scheduled.length; i++) {
    const f = scheduled[i]!;
    const [fixture] = await db
      .insert(scoringFixturesTable)
      .values({
        tournamentId: input.tournamentId,
        drawId: draw.id,
        groupId: f.groupName ? (groupIdByName.get(f.groupName) ?? null) : null,
        bracketRound: f.bracketRound ?? null,
        bracketSlot: f.bracketSlot ?? null,
        fixtureNumber: i + 1,
        roundName: f.roundName,
        scheduledAt: f.scheduledAt ? new Date(f.scheduledAt) : null,
        venueId: input.venueId ?? null,
        venue: venueName,
        homeTeamId: f.homeTeamId,
        awayTeamId: f.awayTeamId,
        status: "scheduled",
      })
      .returning();
    fixtureRows.push(fixture);

    if (input.createMatches) {
      const [match] = await db
        .insert(scoringMatchesTable)
        .values({
          tournamentId: input.tournamentId,
          fixtureId: fixture.id,
          sportSlug: "cricket",
          homeTeamId: f.homeTeamId,
          awayTeamId: f.awayTeamId,
          homeSideJson: { teamId: f.homeTeamId },
          awaySideJson: { teamId: f.awayTeamId },
          rulesJson: { overs: config.oversLimit ?? 20, maxWickets: 10 },
          roundName: f.roundName,
          scheduledAt: f.scheduledAt ? new Date(f.scheduledAt) : null,
          venueId: input.venueId ?? null,
          venue: venueName,
          officialsJson: input.officials ?? null,
          status: "scheduled",
        })
        .returning();

      const initialState = createInitialCricketState({
        matchId: match.id,
        tournamentId: input.tournamentId,
        homeTeamId: f.homeTeamId,
        awayTeamId: f.awayTeamId,
        oversLimit: config.oversLimit ?? 20,
        maxWickets: 10,
      });

      await db.insert(scoringSessionsTable).values({
        matchId: match.id,
        tournamentId: input.tournamentId,
        status: "idle",
        stateJson: initialState,
        lastEventSeq: 0,
      });
    }
  }

  return { draw, fixtures: fixtureRows, fixtureCount: fixtureRows.length };
}

// ─── Fixtures (list) ──────────────────────────────────────────────────────────

export async function listScoringFixtures(tournamentId: number, drawId?: number) {
  await ensureScoringTournament(tournamentId);
  const conditions = [eq(scoringFixturesTable.tournamentId, tournamentId)];
  if (drawId != null) {
    conditions.push(eq(scoringFixturesTable.drawId, drawId));
  }
  return db
    .select()
    .from(scoringFixturesTable)
    .where(and(...conditions))
    .orderBy(asc(scoringFixturesTable.fixtureNumber), asc(scoringFixturesTable.id));
}

export async function listScoringGroups(tournamentId: number, drawId: number) {
  await ensureScoringTournament(tournamentId);
  const groups = await db
    .select()
    .from(scoringGroupsTable)
    .where(
      and(eq(scoringGroupsTable.tournamentId, tournamentId), eq(scoringGroupsTable.drawId, drawId)),
    )
    .orderBy(asc(scoringGroupsTable.sortOrder));

  const result = [];
  for (const group of groups) {
    const members = await db
      .select()
      .from(scoringGroupMembersTable)
      .where(eq(scoringGroupMembersTable.groupId, group.id))
      .orderBy(asc(scoringGroupMembersTable.seed));
    result.push({ ...group, members });
  }
  return result;
}

// ─── Match squads ─────────────────────────────────────────────────────────────

export async function getMatchSquads(tournamentId: number, matchId: number) {
  await ensureScoringTournament(tournamentId);
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
  if (!match) throw new ScoringServiceError("Match not found", 404, "MATCH_NOT_FOUND");

  const squads = await db
    .select()
    .from(scoringMatchSquadsTable)
    .where(eq(scoringMatchSquadsTable.matchId, matchId));

  return { match, squads };
}

export async function setMatchSquad(
  tournamentId: number,
  matchId: number,
  teamId: number,
  squad: MatchSquadJson,
) {
  await ensureScoringTournament(tournamentId);
  await ensureTeamsInTournament(tournamentId, [teamId]);

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
  if (!match) throw new ScoringServiceError("Match not found", 404, "MATCH_NOT_FOUND");
  if (match.homeTeamId !== teamId && match.awayTeamId !== teamId) {
    throw new ScoringServiceError("Team not in this match", 400, "INVALID_TEAM");
  }
  if (squad.playingXi.length < 1 || squad.playingXi.length > 11) {
    throw new ScoringServiceError("Playing XI must have 1–11 players", 400, "INVALID_XI");
  }

  const [existing] = await db
    .select()
    .from(scoringMatchSquadsTable)
    .where(
      and(
        eq(scoringMatchSquadsTable.matchId, matchId),
        eq(scoringMatchSquadsTable.teamId, teamId),
      ),
    )
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(scoringMatchSquadsTable)
      .set({ squadJson: squad })
      .where(eq(scoringMatchSquadsTable.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(scoringMatchSquadsTable)
    .values({ matchId, teamId, squadJson: squad })
    .returning();
  return row;
}

/** Public fixture + match list for tournament pages (no auth). */
export async function getPublicTournamentSchedule(tournamentId: number) {
  const [tournament] = await db
    .select({
      id: tournamentsTable.id,
      name: tournamentsTable.name,
      sport: tournamentsTable.sport,
      scoringEnabled: tournamentsTable.scoringEnabled,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament?.scoringEnabled || tournament.sport !== "cricket") {
    throw new ScoringServiceError("Scoring not available", 404, "SCORING_NOT_AVAILABLE");
  }

  const teams = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      shortCode: teamsTable.shortCode,
      color: teamsTable.color,
    })
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId));

  const fixtures = await listScoringFixtures(tournamentId);
  const matches = await db
    .select()
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.tournamentId, tournamentId))
    .orderBy(asc(scoringMatchesTable.scheduledAt), asc(scoringMatchesTable.id));

  const draws = await db
    .select()
    .from(scoringDrawsTable)
    .where(eq(scoringDrawsTable.tournamentId, tournamentId));

  return { tournament, teams, fixtures, matches, draws };
}
