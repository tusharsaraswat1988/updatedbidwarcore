/**
 * Cricket franchise identity from Player Registry (PTA + master teams + profiles).
 *
 * Opaque integer IDs used by scoring (`homeTeamId`, playing XI player ids) are the
 * PTA `auctionTeamId` / `auctionPlayerId` columns — legacy names for tournament-scoped
 * integers. Read paths must not touch auction `players` / `teams` tables.
 */

import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  globalPlayersTable,
  masterTeamsTable,
  playerTeamAssignmentsTable,
  tournamentPlayerProfilesTable,
} from "@workspace/db";

const CRICKET_SPORT = "cricket" as const;

export type CricketFranchiseTeam = {
  /** Opaque tournament team id used by scoring (PTA.auctionTeamId). */
  teamId: number;
  masterTeamId: string;
  name: string;
  shortCode: string;
  logoUrl: string | null;
  color: string | null;
  squadCount: number;
};

export type CricketFranchisePlayer = {
  /** Opaque tournament player id used by scoring (PTA.auctionPlayerId). */
  playerId: number;
  masterPlayerId: string;
  tournamentPlayerProfileId: number | null;
  initials: string | null;
  displayName: string;
  photoUrl: string | null;
  role: string | null;
  /** Mapped from PTA.assignmentType for API compatibility (sold | retained | …). */
  status: string;
  teamId: number | null;
  masterTeamId: string | null;
  teamName: string | null;
  teamLogoUrl: string | null;
  assignmentType: string;
};

function statusFromAssignmentType(assignmentType: string): string {
  if (assignmentType === "retained") return "retained";
  if (assignmentType === "auction_sale") return "sold";
  return assignmentType;
}

/** Active cricket PTA rows for a tournament (with opaque integer ids). */
export async function listActiveCricketAssignments(tournamentId: number) {
  return db
    .select({
      id: playerTeamAssignmentsTable.id,
      playerId: playerTeamAssignmentsTable.playerId,
      teamId: playerTeamAssignmentsTable.teamId,
      auctionPlayerId: playerTeamAssignmentsTable.auctionPlayerId,
      auctionTeamId: playerTeamAssignmentsTable.auctionTeamId,
      assignmentType: playerTeamAssignmentsTable.assignmentType,
      assignedAt: playerTeamAssignmentsTable.assignedAt,
    })
    .from(playerTeamAssignmentsTable)
    .where(
      and(
        eq(playerTeamAssignmentsTable.tournamentId, tournamentId),
        eq(playerTeamAssignmentsTable.sport, CRICKET_SPORT),
        eq(playerTeamAssignmentsTable.isActive, true),
        isNotNull(playerTeamAssignmentsTable.auctionTeamId),
        isNotNull(playerTeamAssignmentsTable.auctionPlayerId),
      ),
    )
    .orderBy(desc(playerTeamAssignmentsTable.assignedAt));
}

/** Distinct opaque franchise team ids present on the active cricket roster. */
export async function listCricketFranchiseTeamIds(tournamentId: number): Promise<number[]> {
  const rows = await listActiveCricketAssignments(tournamentId);
  const ids = new Set<number>();
  for (const row of rows) {
    if (row.auctionTeamId != null) ids.add(row.auctionTeamId);
  }
  return [...ids].sort((a, b) => a - b);
}

export async function cricketFranchiseTeamExists(
  tournamentId: number,
  teamId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: playerTeamAssignmentsTable.id })
    .from(playerTeamAssignmentsTable)
    .where(
      and(
        eq(playerTeamAssignmentsTable.tournamentId, tournamentId),
        eq(playerTeamAssignmentsTable.sport, CRICKET_SPORT),
        eq(playerTeamAssignmentsTable.isActive, true),
        eq(playerTeamAssignmentsTable.auctionTeamId, teamId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function listCricketFranchiseTeams(
  tournamentId: number,
): Promise<CricketFranchiseTeam[]> {
  const assignments = await listActiveCricketAssignments(tournamentId);
  if (assignments.length === 0) return [];

  const squadCountByTeam = new Map<number, number>();
  const masterByOpaque = new Map<number, string>();
  for (const row of assignments) {
    if (row.auctionTeamId == null) continue;
    squadCountByTeam.set(row.auctionTeamId, (squadCountByTeam.get(row.auctionTeamId) ?? 0) + 1);
    if (!masterByOpaque.has(row.auctionTeamId)) {
      masterByOpaque.set(row.auctionTeamId, row.teamId);
    }
  }

  const masterIds = [...new Set(masterByOpaque.values())];
  const masterTeams = masterIds.length
    ? await db
        .select({
          id: masterTeamsTable.id,
          name: masterTeamsTable.name,
          shortName: masterTeamsTable.shortName,
          logoUrl: masterTeamsTable.logoUrl,
          primaryColor: masterTeamsTable.primaryColor,
        })
        .from(masterTeamsTable)
        .where(inArray(masterTeamsTable.id, masterIds))
    : [];
  const masterById = new Map(masterTeams.map((t) => [t.id, t] as const));

  const teams: CricketFranchiseTeam[] = [];
  for (const [opaqueId, masterTeamId] of masterByOpaque) {
    const mt = masterById.get(masterTeamId);
    const short =
      mt?.shortName?.trim() ||
      (mt?.name ? mt.name.slice(0, 3).toUpperCase() : `T${opaqueId}`);
    teams.push({
      teamId: opaqueId,
      masterTeamId,
      name: mt?.name ?? `Team ${opaqueId}`,
      shortCode: short,
      logoUrl: mt?.logoUrl ?? null,
      color: mt?.primaryColor ?? null,
      squadCount: squadCountByTeam.get(opaqueId) ?? 0,
    });
  }

  return teams.sort((a, b) => a.teamId - b.teamId);
}

export async function resolveCricketFranchiseTeamsByIds(
  tournamentId: number,
  teamIds: number[],
): Promise<Map<number, CricketFranchiseTeam>> {
  if (teamIds.length === 0) return new Map();
  const all = await listCricketFranchiseTeams(tournamentId);
  const wanted = new Set(teamIds);
  const map = new Map<number, CricketFranchiseTeam>();
  for (const team of all) {
    if (wanted.has(team.teamId)) map.set(team.teamId, team);
  }

  // Historical match team ids may lack active PTA — still resolve master name if possible.
  const missing = teamIds.filter((id) => !map.has(id));
  if (missing.length === 0) return map;

  const historical = await db
    .select({
      auctionTeamId: playerTeamAssignmentsTable.auctionTeamId,
      teamId: playerTeamAssignmentsTable.teamId,
    })
    .from(playerTeamAssignmentsTable)
    .where(
      and(
        eq(playerTeamAssignmentsTable.tournamentId, tournamentId),
        eq(playerTeamAssignmentsTable.sport, CRICKET_SPORT),
        inArray(playerTeamAssignmentsTable.auctionTeamId, missing),
      ),
    )
    .orderBy(desc(playerTeamAssignmentsTable.assignedAt));

  const masterByOpaque = new Map<number, string>();
  for (const row of historical) {
    if (row.auctionTeamId == null) continue;
    if (!masterByOpaque.has(row.auctionTeamId)) {
      masterByOpaque.set(row.auctionTeamId, row.teamId);
    }
  }
  const masterIds = [...new Set(masterByOpaque.values())];
  const masterTeams = masterIds.length
    ? await db
        .select({
          id: masterTeamsTable.id,
          name: masterTeamsTable.name,
          shortName: masterTeamsTable.shortName,
          logoUrl: masterTeamsTable.logoUrl,
          primaryColor: masterTeamsTable.primaryColor,
        })
        .from(masterTeamsTable)
        .where(inArray(masterTeamsTable.id, masterIds))
    : [];
  const masterById = new Map(masterTeams.map((t) => [t.id, t] as const));

  for (const opaqueId of missing) {
    const masterTeamId = masterByOpaque.get(opaqueId);
    const mt = masterTeamId ? masterById.get(masterTeamId) : undefined;
    const short =
      mt?.shortName?.trim() ||
      (mt?.name ? mt.name.slice(0, 3).toUpperCase() : `T${opaqueId}`);
    map.set(opaqueId, {
      teamId: opaqueId,
      masterTeamId: masterTeamId ?? "",
      name: mt?.name ?? `Team ${opaqueId}`,
      shortCode: short,
      logoUrl: mt?.logoUrl ?? null,
      color: mt?.primaryColor ?? null,
      squadCount: 0,
    });
  }

  return map;
}

export async function listCricketFranchisePlayers(
  tournamentId: number,
  teamId?: number,
): Promise<CricketFranchisePlayer[]> {
  let assignments = await listActiveCricketAssignments(tournamentId);
  if (teamId != null) {
    assignments = assignments.filter((a) => a.auctionTeamId === teamId);
  }
  if (assignments.length === 0) return [];

  // Most recent active row wins per opaque player id.
  const byOpaquePlayer = new Map<number, (typeof assignments)[number]>();
  for (const row of assignments) {
    if (row.auctionPlayerId == null) continue;
    if (!byOpaquePlayer.has(row.auctionPlayerId)) {
      byOpaquePlayer.set(row.auctionPlayerId, row);
    }
  }
  const unique = [...byOpaquePlayer.values()];

  const masterPlayerIds = [...new Set(unique.map((r) => r.playerId))];
  const masterTeamIds = [...new Set(unique.map((r) => r.teamId))];

  const [players, profiles, masterTeams] = await Promise.all([
    db
      .select({
        id: globalPlayersTable.id,
        displayName: globalPlayersTable.displayName,
        photoUrl: globalPlayersTable.photoUrl,
        defaultRole: globalPlayersTable.defaultRole,
      })
      .from(globalPlayersTable)
      .where(inArray(globalPlayersTable.id, masterPlayerIds)),
    db
      .select({
        id: tournamentPlayerProfilesTable.id,
        masterPlayerId: tournamentPlayerProfilesTable.masterPlayerId,
        displayName: tournamentPlayerProfilesTable.displayName,
        initials: tournamentPlayerProfilesTable.initials,
        photoOverrideUrl: tournamentPlayerProfilesTable.photoOverrideUrl,
      })
      .from(tournamentPlayerProfilesTable)
      .where(
        and(
          eq(tournamentPlayerProfilesTable.tournamentId, tournamentId),
          inArray(tournamentPlayerProfilesTable.masterPlayerId, masterPlayerIds),
        ),
      ),
    db
      .select({
        id: masterTeamsTable.id,
        name: masterTeamsTable.name,
        logoUrl: masterTeamsTable.logoUrl,
      })
      .from(masterTeamsTable)
      .where(inArray(masterTeamsTable.id, masterTeamIds)),
  ]);

  const playerById = new Map(players.map((p) => [p.id, p] as const));
  const profileByMaster = new Map(profiles.map((p) => [p.masterPlayerId, p] as const));
  const teamById = new Map(masterTeams.map((t) => [t.id, t] as const));

  const items: CricketFranchisePlayer[] = [];
  for (const row of unique) {
    if (row.auctionPlayerId == null) continue;
    const gp = playerById.get(row.playerId);
    const profile = profileByMaster.get(row.playerId);
    const team = teamById.get(row.teamId);
    items.push({
      playerId: row.auctionPlayerId,
      masterPlayerId: row.playerId,
      tournamentPlayerProfileId: profile?.id ?? null,
      initials: profile?.initials ?? null,
      displayName: profile?.displayName ?? gp?.displayName ?? `Player ${row.auctionPlayerId}`,
      photoUrl: profile?.photoOverrideUrl ?? gp?.photoUrl ?? null,
      role: gp?.defaultRole ?? null,
      status: statusFromAssignmentType(row.assignmentType),
      teamId: row.auctionTeamId,
      masterTeamId: row.teamId,
      teamName: team?.name ?? null,
      teamLogoUrl: team?.logoUrl ?? null,
      assignmentType: row.assignmentType,
    });
  }

  return items.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function resolveCricketFranchisePlayersByIds(
  tournamentId: number,
  playerIds: number[],
): Promise<Map<number, CricketFranchisePlayer>> {
  if (playerIds.length === 0) return new Map();

  const allActive = await listCricketFranchisePlayers(tournamentId);
  const map = new Map<number, CricketFranchisePlayer>();
  const wanted = new Set(playerIds);
  for (const p of allActive) {
    if (wanted.has(p.playerId)) map.set(p.playerId, p);
  }

  const missing = playerIds.filter((id) => !map.has(id));
  if (missing.length === 0) return map;

  // Historical / inactive PTA rows for scorecard name resolution.
  const historical = await db
    .select({
      playerId: playerTeamAssignmentsTable.playerId,
      teamId: playerTeamAssignmentsTable.teamId,
      auctionPlayerId: playerTeamAssignmentsTable.auctionPlayerId,
      auctionTeamId: playerTeamAssignmentsTable.auctionTeamId,
      assignmentType: playerTeamAssignmentsTable.assignmentType,
    })
    .from(playerTeamAssignmentsTable)
    .where(
      and(
        eq(playerTeamAssignmentsTable.tournamentId, tournamentId),
        eq(playerTeamAssignmentsTable.sport, CRICKET_SPORT),
        inArray(playerTeamAssignmentsTable.auctionPlayerId, missing),
      ),
    )
    .orderBy(desc(playerTeamAssignmentsTable.assignedAt));

  const byOpaque = new Map<number, (typeof historical)[number]>();
  for (const row of historical) {
    if (row.auctionPlayerId == null) continue;
    if (!byOpaque.has(row.auctionPlayerId)) byOpaque.set(row.auctionPlayerId, row);
  }

  const masterPlayerIds = [...new Set([...byOpaque.values()].map((r) => r.playerId))];
  if (masterPlayerIds.length === 0) return map;

  const [players, profiles, masterTeams] = await Promise.all([
    db
      .select({
        id: globalPlayersTable.id,
        displayName: globalPlayersTable.displayName,
        photoUrl: globalPlayersTable.photoUrl,
        defaultRole: globalPlayersTable.defaultRole,
      })
      .from(globalPlayersTable)
      .where(inArray(globalPlayersTable.id, masterPlayerIds)),
    db
      .select({
        id: tournamentPlayerProfilesTable.id,
        masterPlayerId: tournamentPlayerProfilesTable.masterPlayerId,
        displayName: tournamentPlayerProfilesTable.displayName,
        initials: tournamentPlayerProfilesTable.initials,
        photoOverrideUrl: tournamentPlayerProfilesTable.photoOverrideUrl,
      })
      .from(tournamentPlayerProfilesTable)
      .where(
        and(
          eq(tournamentPlayerProfilesTable.tournamentId, tournamentId),
          inArray(tournamentPlayerProfilesTable.masterPlayerId, masterPlayerIds),
        ),
      ),
    db
      .select({
        id: masterTeamsTable.id,
        name: masterTeamsTable.name,
        logoUrl: masterTeamsTable.logoUrl,
      })
      .from(masterTeamsTable)
      .where(
        inArray(
          masterTeamsTable.id,
          [...new Set([...byOpaque.values()].map((r) => r.teamId))],
        ),
      ),
  ]);

  const playerById = new Map(players.map((p) => [p.id, p] as const));
  const profileByMaster = new Map(profiles.map((p) => [p.masterPlayerId, p] as const));
  const teamById = new Map(masterTeams.map((t) => [t.id, t] as const));

  for (const [opaqueId, row] of byOpaque) {
    const gp = playerById.get(row.playerId);
    const profile = profileByMaster.get(row.playerId);
    const team = teamById.get(row.teamId);
    map.set(opaqueId, {
      playerId: opaqueId,
      masterPlayerId: row.playerId,
      tournamentPlayerProfileId: profile?.id ?? null,
      initials: profile?.initials ?? null,
      displayName: profile?.displayName ?? gp?.displayName ?? `Player ${opaqueId}`,
      photoUrl: profile?.photoOverrideUrl ?? gp?.photoUrl ?? null,
      role: gp?.defaultRole ?? null,
      status: statusFromAssignmentType(row.assignmentType),
      teamId: row.auctionTeamId,
      masterTeamId: row.teamId,
      teamName: team?.name ?? null,
      teamLogoUrl: team?.logoUrl ?? null,
      assignmentType: row.assignmentType,
    });
  }

  return map;
}

export async function resolveCricketMasterPlayerIdsByOpaque(
  tournamentId: number,
  opaquePlayerIds: number[],
): Promise<Map<number, string>> {
  if (opaquePlayerIds.length === 0) return new Map();
  const rows = await db
    .select({
      auctionPlayerId: playerTeamAssignmentsTable.auctionPlayerId,
      playerId: playerTeamAssignmentsTable.playerId,
    })
    .from(playerTeamAssignmentsTable)
    .where(
      and(
        eq(playerTeamAssignmentsTable.tournamentId, tournamentId),
        eq(playerTeamAssignmentsTable.sport, CRICKET_SPORT),
        inArray(playerTeamAssignmentsTable.auctionPlayerId, opaquePlayerIds),
      ),
    )
    .orderBy(desc(playerTeamAssignmentsTable.assignedAt));

  const map = new Map<number, string>();
  for (const row of rows) {
    if (row.auctionPlayerId == null) continue;
    if (!map.has(row.auctionPlayerId)) map.set(row.auctionPlayerId, row.playerId);
  }
  return map;
}
