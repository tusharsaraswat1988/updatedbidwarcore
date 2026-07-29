/**
 * Badminton league groups — groups, fixture generation, pair standings.
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import {
  buildPairStandingsFromMatches,
  planTeamTieGroupFixtures,
  type PairStandingsMatchInput,
} from "@workspace/badminton-core";
import {
  db,
  badmintonCategoriesTable,
  badmintonDrawsTable,
  badmintonFixturesTable,
  badmintonGroupMembersTable,
  badmintonGroupsTable,
  badmintonMatchDetailsTable,
  badmintonPairStandingsTable,
  badmintonPlayersTable,
  badmintonRegistrationsTable,
  globalPlayersTable,
  playerTeamAssignmentsTable,
  playersTable,
  scoringMatchesTable,
  teamsTable,
  tournamentsTable,
} from "@workspace/db";
import type { BadmintonGameState, BadmintonMatchState } from "@workspace/badminton-core";
import { createFixtureCollection } from "./fixture-collection-writer";
import {
  getBadmintonSettings,
  resolveMasterPlayerId,
  resolveRegistrySourceTournamentId,
} from "./master-sports/badminton";

export type LeagueGroupInput = {
  name: string;
  sortOrder?: number;
  teamIds: number[];
};

export type LeagueGroupView = {
  id: number;
  name: string;
  sortOrder: number;
  teams: Array<{ teamId: number; teamName: string; seed: number | null }>;
};

async function registryTournamentId(tournamentId: number): Promise<number> {
  const [tournament] = await db
    .select({ scoringSettingsJson: tournamentsTable.scoringSettingsJson })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  const settings = getBadmintonSettings(
    tournament?.scoringSettingsJson as Record<string, unknown> | null,
  );
  return resolveRegistrySourceTournamentId(tournamentId, settings);
}

async function resolveTeamIdForBadmintonPlayer(
  tournamentId: number,
  badmintonPlayerId: number,
): Promise<number | null> {
  const [bp] = await db
    .select()
    .from(badmintonPlayersTable)
    .where(
      and(
        eq(badmintonPlayersTable.id, badmintonPlayerId),
        eq(badmintonPlayersTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);
  if (!bp) return null;

  const masterPlayerId = await resolveMasterPlayerId(bp);
  if (!masterPlayerId) return null;

  const lookupTournamentId = await registryTournamentId(tournamentId);

  const [assignment] = await db
    .select({ auctionTeamId: playerTeamAssignmentsTable.auctionTeamId })
    .from(playerTeamAssignmentsTable)
    .where(
      and(
        eq(playerTeamAssignmentsTable.playerId, masterPlayerId),
        eq(playerTeamAssignmentsTable.tournamentId, lookupTournamentId),
        eq(playerTeamAssignmentsTable.isActive, true),
      ),
    )
    .orderBy(asc(playerTeamAssignmentsTable.assignedAt))
    .limit(1);

  if (assignment?.auctionTeamId) return assignment.auctionTeamId;

  const [mp] = await db
    .select({ auctionPlayerId: globalPlayersTable.auctionPlayerId })
    .from(globalPlayersTable)
    .where(eq(globalPlayersTable.id, masterPlayerId))
    .limit(1);

  if (mp?.auctionPlayerId) {
    const [auctionPlayer] = await db
      .select({ teamId: playersTable.teamId })
      .from(playersTable)
      .where(
        and(
          eq(playersTable.id, mp.auctionPlayerId),
          eq(playersTable.tournamentId, lookupTournamentId),
        ),
      )
      .limit(1);
    return auctionPlayer?.teamId ?? null;
  }

  return null;
}

async function resolveRegistrationTeamId(
  tournamentId: number,
  registration: { player1Id: number; metaJson?: Record<string, unknown> | null },
): Promise<number | null> {
  const metaTeamId = registration.metaJson?.teamId;
  if (typeof metaTeamId === "number") return metaTeamId;

  return resolveTeamIdForBadmintonPlayer(tournamentId, registration.player1Id);
}

export async function listLeagueGroups(
  tournamentId: number,
  categoryId: number,
): Promise<LeagueGroupView[]> {
  const groups = await db
    .select()
    .from(badmintonGroupsTable)
    .where(
      and(
        eq(badmintonGroupsTable.tournamentId, tournamentId),
        eq(badmintonGroupsTable.categoryId, categoryId),
      ),
    )
    .orderBy(asc(badmintonGroupsTable.sortOrder), asc(badmintonGroupsTable.id));

  if (groups.length === 0) return [];

  const groupIds = groups.map((g) => g.id);
  const members = await db
    .select()
    .from(badmintonGroupMembersTable)
    .where(inArray(badmintonGroupMembersTable.groupId, groupIds));

  const teamIds = [...new Set(members.map((m) => m.teamId))];
  const teamRows =
    teamIds.length > 0
      ? await db
          .select({ id: teamsTable.id, name: teamsTable.name })
          .from(teamsTable)
          .where(inArray(teamsTable.id, teamIds))
      : [];
  const teamNameById = new Map(teamRows.map((t) => [t.id, t.name]));

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    sortOrder: g.sortOrder,
    teams: members
      .filter((m) => m.groupId === g.id)
      .map((m) => ({
        teamId: m.teamId,
        teamName: teamNameById.get(m.teamId) ?? `Team #${m.teamId}`,
        seed: m.seed,
      })),
  }));
}

export async function replaceLeagueGroups(
  tournamentId: number,
  categoryId: number,
  groups: LeagueGroupInput[],
): Promise<LeagueGroupView[]> {
  const existing = await db
    .select({ id: badmintonGroupsTable.id })
    .from(badmintonGroupsTable)
    .where(
      and(
        eq(badmintonGroupsTable.tournamentId, tournamentId),
        eq(badmintonGroupsTable.categoryId, categoryId),
      ),
    );

  if (existing.length > 0) {
    const ids = existing.map((g) => g.id);
    await db
      .delete(badmintonGroupMembersTable)
      .where(inArray(badmintonGroupMembersTable.groupId, ids));
    await db.delete(badmintonGroupsTable).where(inArray(badmintonGroupsTable.id, ids));
  }

  for (const [idx, group] of groups.entries()) {
    const [inserted] = await db
      .insert(badmintonGroupsTable)
      .values({
        tournamentId,
        categoryId,
        name: group.name,
        sortOrder: group.sortOrder ?? idx,
      })
      .returning();

    if (group.teamIds.length > 0) {
      await db.insert(badmintonGroupMembersTable).values(
        group.teamIds.map((teamId, seedIdx) => ({
          groupId: inserted!.id,
          teamId,
          seed: seedIdx + 1,
        })),
      );
    }
  }

  return listLeagueGroups(tournamentId, categoryId);
}

export async function generateLeagueFixtures(
  tournamentId: number,
  categoryId: number,
): Promise<{ collections: number; fixtures: number }> {
  const [category] = await db
    .select()
    .from(badmintonCategoriesTable)
    .where(
      and(
        eq(badmintonCategoriesTable.id, categoryId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!category) throw Object.assign(new Error("Category not found"), { status: 404 });
  if (category.drawType !== "round_robin" && category.drawType !== "group_knockout") {
    throw Object.assign(
      new Error("Category must use round_robin or group_knockout draw type for league generation"),
      { status: 400 },
    );
  }

  const groups = await listLeagueGroups(tournamentId, categoryId);
  if (groups.length === 0) {
    throw Object.assign(new Error("Define at least one group with teams before generating"), {
      status: 400,
    });
  }

  const registrations = await db
    .select()
    .from(badmintonRegistrationsTable)
    .where(
      and(
        eq(badmintonRegistrationsTable.categoryId, categoryId),
        eq(badmintonRegistrationsTable.tournamentId, tournamentId),
        eq(badmintonRegistrationsTable.status, "accepted"),
      ),
    );

  const regTeamMap = new Map<number, number>();
  for (const reg of registrations) {
    const teamId = await resolveRegistrationTeamId(tournamentId, reg);
    if (teamId != null) regTeamMap.set(reg.id, teamId);
  }

  let totalFixtures = 0;
  let totalCollections = 0;

  for (const group of groups) {
    const teamIdsInGroup = group.teams.map((t) => t.teamId);
    const teamNameById = new Map(group.teams.map((t) => [t.teamId, t.teamName]));

    const teamInputs = teamIdsInGroup.map((teamId) => {
      const pairRegs = registrations
        .filter((r) => regTeamMap.get(r.id) === teamId)
        .sort(
          (a, b) =>
            (a.seedNumber ?? 999) - (b.seedNumber ?? 999) || a.id - b.id,
        )
        .map((r) => r.id);

      return {
        teamId,
        teamName: teamNameById.get(teamId) ?? `Team #${teamId}`,
        registrationIds: pairRegs,
      };
    });

    const planned = planTeamTieGroupFixtures(group.name, teamInputs);
    if (planned.length === 0) continue;

    const { fixtures } = await createFixtureCollection({
      tournamentId,
      categoryId,
      roundName: `${group.name} — League`,
      drawKind: "generated",
      groupId: String(group.id),
      metaJson: {
        adapter: "league_generate",
        algorithm: "team_tie",
        groupId: group.id,
        groupName: group.name,
      },
      fixtures: planned.map((f) => ({
        slotNumber: f.slotNumber,
        registrationAId: f.registrationAId,
        registrationBId: f.registrationBId,
        status: "unscheduled",
        metaJson: f.metaJson,
      })),
      markCategoryLive: totalCollections === 0,
    });

    totalFixtures += fixtures.length;
    totalCollections += 1;
  }

  if (totalFixtures === 0) {
    throw Object.assign(
      new Error(
        "No fixtures generated. Ensure pairs are registered and assigned to franchise teams in each group.",
      ),
      { status: 400 },
    );
  }

  await db
    .update(badmintonCategoriesTable)
    .set({ phase: "draw_generated", updatedAt: new Date() })
    .where(
      and(
        eq(badmintonCategoriesTable.id, categoryId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    );

  return { collections: totalCollections, fixtures: totalFixtures };
}

function parseMatchState(snapshot: unknown): BadmintonMatchState | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const s = snapshot as BadmintonMatchState;
  if (!Array.isArray(s.games)) return null;
  return s;
}

export async function rebuildCategoryPairStandings(
  tournamentId: number,
  categoryId: number,
): Promise<void> {
  const registrations = await db
    .select({ id: badmintonRegistrationsTable.id })
    .from(badmintonRegistrationsTable)
    .where(
      and(
        eq(badmintonRegistrationsTable.categoryId, categoryId),
        eq(badmintonRegistrationsTable.tournamentId, tournamentId),
        eq(badmintonRegistrationsTable.status, "accepted"),
      ),
    );

  const registrationIds = registrations.map((r) => r.id);
  if (registrationIds.length === 0) return;

  const fixtures = await db
    .select()
    .from(badmintonFixturesTable)
    .where(
      and(
        eq(badmintonFixturesTable.categoryId, categoryId),
        eq(badmintonFixturesTable.tournamentId, tournamentId),
      ),
    );

  const completedFixtures = fixtures.filter(
    (f) =>
      f.status === "completed" ||
      f.status === "walkover" ||
      f.winnerRegistrationId != null,
  );

  const scoringMatchIds = completedFixtures
    .map((f) => f.scoringMatchId)
    .filter((id): id is number => id != null);

  const detailsByMatchId = new Map<number, { state: BadmintonMatchState | null }>();
  if (scoringMatchIds.length > 0) {
    const details = await db
      .select({
        scoringMatchId: badmintonMatchDetailsTable.scoringMatchId,
        stateSnapshotJson: badmintonMatchDetailsTable.stateSnapshotJson,
      })
      .from(badmintonMatchDetailsTable)
      .where(
        and(
          eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
          inArray(badmintonMatchDetailsTable.scoringMatchId, scoringMatchIds),
        ),
      );

    for (const d of details) {
      detailsByMatchId.set(d.scoringMatchId, {
        state: parseMatchState(d.stateSnapshotJson),
      });
    }
  }

  const matchInputs: PairStandingsMatchInput[] = [];

  for (const fixture of completedFixtures) {
    if (!fixture.registrationAId || !fixture.registrationBId) continue;

    let games: BadmintonGameState[] = [];
    let winnerSide: "left" | "right" | null = null;
    let status = fixture.status;

    if (fixture.scoringMatchId) {
      const [match] = await db
        .select({ status: scoringMatchesTable.status })
        .from(scoringMatchesTable)
        .where(eq(scoringMatchesTable.id, fixture.scoringMatchId))
        .limit(1);

      if (match) status = match.status;

      const detail = detailsByMatchId.get(fixture.scoringMatchId);
      if (detail?.state) {
        games = detail.state.games;
        winnerSide = detail.state.winnerSide ?? null;
      }
    }

    matchInputs.push({
      matchId: fixture.scoringMatchId ?? fixture.id,
      registrationAId: fixture.registrationAId,
      registrationBId: fixture.registrationBId,
      winnerRegistrationId: fixture.winnerRegistrationId,
      winnerSide,
      games,
      status,
    });
  }

  const computed = buildPairStandingsFromMatches(registrationIds, matchInputs);

  await db
    .delete(badmintonPairStandingsTable)
    .where(
      and(
        eq(badmintonPairStandingsTable.tournamentId, tournamentId),
        eq(badmintonPairStandingsTable.categoryId, categoryId),
      ),
    );

  if (computed.length > 0) {
    await db.insert(badmintonPairStandingsTable).values(
      computed.map((row) => ({
        tournamentId,
        categoryId,
        registrationId: row.registrationId,
        played: row.played,
        won: row.won,
        lost: row.lost,
        marginPoints: row.marginPoints,
      })),
    );
  }
}

export async function getCategoryPairStandings(
  tournamentId: number,
  categoryId: number,
  limit?: number,
) {
  await rebuildCategoryPairStandings(tournamentId, categoryId);

  const rows = await db
    .select()
    .from(badmintonPairStandingsTable)
    .where(
      and(
        eq(badmintonPairStandingsTable.tournamentId, tournamentId),
        eq(badmintonPairStandingsTable.categoryId, categoryId),
      ),
    )
    .orderBy(
      asc(badmintonPairStandingsTable.marginPoints),
      asc(badmintonPairStandingsTable.won),
    );

  rows.sort((a, b) => {
    if (b.marginPoints !== a.marginPoints) return b.marginPoints - a.marginPoints;
    if (b.won !== a.won) return b.won - a.won;
    return a.registrationId - b.registrationId;
  });

  const sliced = limit ? rows.slice(0, limit) : rows;

  const regIds = sliced.map((r) => r.registrationId);
  const regs =
    regIds.length > 0
      ? await db
          .select()
          .from(badmintonRegistrationsTable)
          .where(inArray(badmintonRegistrationsTable.id, regIds))
      : [];

  const playerIds = [
    ...new Set(regs.flatMap((r) => [r.player1Id, r.player2Id].filter(Boolean) as number[])),
  ];
  const players =
    playerIds.length > 0
      ? await db
          .select({
            id: badmintonPlayersTable.id,
            displayName: badmintonPlayersTable.displayName,
            firstName: badmintonPlayersTable.firstName,
            lastName: badmintonPlayersTable.lastName,
          })
          .from(badmintonPlayersTable)
          .where(inArray(badmintonPlayersTable.id, playerIds))
      : [];

  const playerLabel = (id: number) => {
    const p = players.find((x) => x.id === id);
    return p?.displayName ?? [p?.firstName, p?.lastName].filter(Boolean).join(" ") ?? `#${id}`;
  };

  return sliced.map((row, index) => {
    const reg = regs.find((r) => r.id === row.registrationId);
    const label = reg
      ? reg.player2Id
        ? `${playerLabel(reg.player1Id)} / ${playerLabel(reg.player2Id)}`
        : playerLabel(reg.player1Id)
      : `Entry #${row.registrationId}`;

    return {
      rank: index + 1,
      registrationId: row.registrationId,
      label,
      played: row.played,
      won: row.won,
      lost: row.lost,
      marginPoints: row.marginPoints,
    };
  });
}
