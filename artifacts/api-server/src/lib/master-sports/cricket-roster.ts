/**
 * Cricket roster — Player Registry is the live source of truth for scoring.
 *
 * Auction → Registry sync adapters below write PTA when auction runs; cricket
 * scoring read paths use `cricket-franchise-registry` only (no auction tables).
 */

import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  playersTable,
  teamsTable,
  playerTeamAssignmentsTable,
  type Player,
} from "@workspace/db";
import { logSync } from "@workspace/player-registry/sync-helpers";
import {
  assignPlayerToFranchiseRoster,
  endActiveRosterAssignment,
  type RosterAssignmentType,
} from "@workspace/player-registry/roster-assignments";
import {
  syncAuctionPlayerToMaster,
  syncAuctionTeamToMaster,
} from "./sync";
import { ensureCricketStatisticsBaseline } from "./cricket-stats";
import {
  listCricketFranchisePlayers,
  listCricketFranchiseTeams,
} from "@workspace/player-registry/cricket-franchise";

export type { RosterAssignmentType };

export type CricketMasterTeamItem = {
  auctionTeamId: number;
  masterTeamId: string | null;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  squadCount: number;
  syncedToMaster: boolean;
};

export type CricketMasterPlayerItem = {
  auctionPlayerId: number;
  masterPlayerId: string | null;
  tournamentPlayerProfileId: number | null;
  tournamentPlayerInitials: string | null;
  displayName: string;
  photoUrl: string | null;
  role: string | null;
  status: string;
  auctionTeamId: number | null;
  masterTeamId: string | null;
  teamName: string | null;
  teamLogoUrl: string | null;
  syncedToMaster: boolean;
  onRoster: boolean;
};

/** End the current active franchise assignment for a master player in a tournament. */
export { endActiveRosterAssignment, assignPlayerToFranchiseRoster } from "@workspace/player-registry/roster-assignments";

function rosterTypeFromPlayer(player: Player): RosterAssignmentType {
  if (player.status === "retained") return "retained";
  if (player.status === "sold") return "auction_sale";
  return "transfer";
}

/** Sync one auction player's current team into master roster assignments. */
export async function syncAuctionPlayerRosterAssignment(
  auctionPlayer: Player,
  tournamentId: number,
  assignmentType?: RosterAssignmentType,
): Promise<string | null> {
  if (!auctionPlayer.teamId) return null;
  if (auctionPlayer.status !== "sold" && auctionPlayer.status !== "retained") {
    const syncResult = await syncAuctionPlayerToMaster(auctionPlayer.id, tournamentId);
    if (syncResult?.masterPlayerId) {
      await endActiveRosterAssignment(syncResult.masterPlayerId, tournamentId, "cricket");
    }
    return null;
  }

  const syncResult = await syncAuctionPlayerToMaster(auctionPlayer.id, tournamentId);
  if (!syncResult) return null;

  const masterTeamId = await syncAuctionTeamToMaster(auctionPlayer.teamId, tournamentId);
  if (!masterTeamId) return syncResult.masterPlayerId;

  const [active] = await db
    .select()
    .from(playerTeamAssignmentsTable)
    .where(
      and(
        eq(playerTeamAssignmentsTable.playerId, syncResult.masterPlayerId),
        eq(playerTeamAssignmentsTable.tournamentId, tournamentId),
        eq(playerTeamAssignmentsTable.sport, "cricket"),
        eq(playerTeamAssignmentsTable.isActive, true),
      ),
    )
    .limit(1);

  const type = assignmentType ?? rosterTypeFromPlayer(auctionPlayer);

  if (
    active &&
    active.teamId === masterTeamId &&
    active.auctionTeamId === auctionPlayer.teamId
  ) {
    return syncResult.masterPlayerId;
  }

  await assignPlayerToFranchiseRoster({
    masterPlayerId: syncResult.masterPlayerId,
    masterTeamId,
    tournamentId,
    auctionPlayerId: auctionPlayer.id,
    auctionTeamId: auctionPlayer.teamId,
    assignmentType: type,
    sport: "cricket",
  });

  await ensureCricketStatisticsBaseline(syncResult.masterPlayerId, tournamentId);

  return syncResult.masterPlayerId;
}

/** Full roster sync: all auction teams + sold/retained players → master layer. */
export async function syncCricketRosterFromAuction(tournamentId: number): Promise<{
  teamsSynced: number;
  playersSynced: number;
}> {
  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId));

  let teamsSynced = 0;
  for (const team of teams) {
    const id = await syncAuctionTeamToMaster(team.id, tournamentId);
    if (id) teamsSynced++;
  }

  const rosterPlayers = await db
    .select()
    .from(playersTable)
    .where(
      and(
        eq(playersTable.tournamentId, tournamentId),
        eq(playersTable.isNonPlayingMember, false),
      ),
    );

  let playersSynced = 0;
  for (const p of rosterPlayers) {
    if (p.status === "sold" || p.status === "retained") {
      const masterId = await syncAuctionPlayerRosterAssignment(p, tournamentId);
      if (masterId) playersSynced++;
    }
  }

  await logSync("cricket_roster_sync", "tournament", String(tournamentId), null, null, {
    teamsSynced,
    playersSynced,
  });

  return { teamsSynced, playersSynced };
}

/** Called when auction player moves between teams (transfer / unsold replacement). */
export async function onAuctionPlayerRosterChanged(
  auctionPlayer: Player,
  previousTeamId: number | null,
  tournamentId: number,
  assignmentType: RosterAssignmentType = "transfer",
): Promise<void> {
  if (!auctionPlayer.teamId) {
    const syncResult = await syncAuctionPlayerToMaster(auctionPlayer.id, tournamentId);
    if (syncResult?.masterPlayerId) {
      await endActiveRosterAssignment(syncResult.masterPlayerId, tournamentId, "cricket");
    }
    return;
  }

  await syncAuctionPlayerRosterAssignment(auctionPlayer, tournamentId, assignmentType);

  void previousTeamId;
}

export function onAuctionPlayerRosterChangedAsync(
  auctionPlayer: Player,
  previousTeamId: number | null,
  tournamentId: number,
  assignmentType?: RosterAssignmentType,
): void {
  void onAuctionPlayerRosterChanged(
    auctionPlayer,
    previousTeamId,
    tournamentId,
    assignmentType,
  ).catch((err) => {
    console.error("[master-sports] onAuctionPlayerRosterChanged failed:", err);
  });
}

/** List Player Registry franchise teams with squad counts for cricket scorer UI. */
export async function listCricketMasterTeams(
  tournamentId: number,
): Promise<CricketMasterTeamItem[]> {
  const teams = await listCricketFranchiseTeams(tournamentId);
  return teams.map((t) => ({
    auctionTeamId: t.teamId,
    masterTeamId: t.masterTeamId,
    name: t.name,
    shortName: t.shortCode,
    logoUrl: t.logoUrl,
    primaryColor: t.color,
    squadCount: t.squadCount,
    syncedToMaster: Boolean(t.masterTeamId),
  }));
}

/** List players for cricket scorer from Player Registry — optional filter by opaque team id. */
export async function listCricketMasterPlayers(
  tournamentId: number,
  auctionTeamId?: number,
): Promise<CricketMasterPlayerItem[]> {
  const players = await listCricketFranchisePlayers(tournamentId, auctionTeamId);
  return players.map((p) => ({
    auctionPlayerId: p.playerId,
    masterPlayerId: p.masterPlayerId,
    tournamentPlayerProfileId: p.tournamentPlayerProfileId,
    tournamentPlayerInitials: p.initials,
    displayName: p.displayName,
    photoUrl: p.photoUrl,
    role: p.role,
    status: p.status,
    auctionTeamId: p.teamId,
    masterTeamId: p.masterTeamId,
    teamName: p.teamName,
    teamLogoUrl: p.teamLogoUrl,
    syncedToMaster: true,
    onRoster: true,
  }));
}

/** Squad eligible for playing XI (active Player Registry assignment on team). */
export async function listCricketSquadPlayers(
  tournamentId: number,
  auctionTeamId: number,
): Promise<CricketMasterPlayerItem[]> {
  return listCricketMasterPlayers(tournamentId, auctionTeamId);
}
