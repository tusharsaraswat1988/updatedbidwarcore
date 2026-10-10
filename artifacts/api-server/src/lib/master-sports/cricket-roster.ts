/**
 * Cricket roster — Player Registry is the live source of truth for scoring.
 *
 * Auction → Registry sync adapters below write PTA when auction runs. Scoring
 * reads the franchise registry, and repairs any team-assigned playing player
 * who is missing from that registry so the roster page and the scorer match.
 */

import { eq, and, ne, isNotNull } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  playersTable,
  teamsTable,
  tournamentsTable,
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
  syncAllAuctionPlayersToMaster,
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

/**
 * PTA assignment type for a franchise-assigned auction/Sports player.
 * Sold/retained keep auction semantics; any other status with a team is a direct assign.
 */
export function rosterTypeFromPlayer(
  player: Pick<Player, "status">,
): RosterAssignmentType {
  if (player.status === "retained") return "retained";
  if (player.status === "sold") return "auction_sale";
  return "transfer";
}

/** True when the player belongs on a Sports franchise squad (team assigned, playing). */
export function isFranchiseRosterEligible(
  player: Pick<Player, "teamId" | "isNonPlayingMember">,
): boolean {
  return player.teamId != null && !player.isNonPlayingMember;
}

/**
 * Active PTA already records this exact player on this exact franchise team.
 * Same master identity on the same team is not enough — another kid who shared
 * a parent email/mobile must still get their own roster row.
 */
export function rosterAssignmentCoversPlayer(
  active:
    | {
        teamId: string;
        auctionTeamId: number | null;
        auctionPlayerId: number | null;
      }
    | undefined,
  masterTeamId: string,
  player: { id: number; teamId: number | null },
): boolean {
  return Boolean(
    active &&
      active.auctionPlayerId === player.id &&
      active.teamId === masterTeamId &&
      active.auctionTeamId === player.teamId,
  );
}

async function masterIdsClaimedByOtherPlayers(
  tournamentId: number,
  auctionPlayerId: number,
): Promise<Set<string>> {
  const [linked, activeAssignments] = await Promise.all([
    db
      .select({ id: playersTable.globalPlayerId })
      .from(playersTable)
      .where(
        and(
          eq(playersTable.tournamentId, tournamentId),
          ne(playersTable.id, auctionPlayerId),
          isNotNull(playersTable.globalPlayerId),
        ),
      ),
    db
      .select({ id: playerTeamAssignmentsTable.playerId })
      .from(playerTeamAssignmentsTable)
      .where(
        and(
          eq(playerTeamAssignmentsTable.tournamentId, tournamentId),
          eq(playerTeamAssignmentsTable.sport, "cricket"),
          eq(playerTeamAssignmentsTable.isActive, true),
          isNotNull(playerTeamAssignmentsTable.auctionPlayerId),
          ne(playerTeamAssignmentsTable.auctionPlayerId, auctionPlayerId),
        ),
      ),
  ]);

  const ids = new Set<string>();
  for (const row of linked) {
    if (row.id) ids.add(row.id);
  }
  for (const row of activeAssignments) {
    if (row.id) ids.add(row.id);
  }
  return ids;
}

async function activeCricketAssignment(masterPlayerId: string, tournamentId: number) {
  const [active] = await db
    .select()
    .from(playerTeamAssignmentsTable)
    .where(
      and(
        eq(playerTeamAssignmentsTable.playerId, masterPlayerId),
        eq(playerTeamAssignmentsTable.tournamentId, tournamentId),
        eq(playerTeamAssignmentsTable.sport, "cricket"),
        eq(playerTeamAssignmentsTable.isActive, true),
      ),
    )
    .limit(1);
  return active;
}

/** Sync one auction player's current team into master roster assignments. */
export async function syncAuctionPlayerRosterAssignment(
  auctionPlayer: Player,
  tournamentId: number,
  assignmentType?: RosterAssignmentType,
): Promise<string | null> {
  const claimedMasterIds = await masterIdsClaimedByOtherPlayers(
    tournamentId,
    auctionPlayer.id,
  );

  // Unassigned / non-playing: clear this player's active PTA, then stop.
  // Never end a row that belongs to a different player sharing the same master id.
  if (!isFranchiseRosterEligible(auctionPlayer) || !auctionPlayer.teamId) {
    const syncResult = await syncAuctionPlayerToMaster(auctionPlayer.id, tournamentId, {
      claimedMasterIds,
    });
    if (syncResult?.masterPlayerId) {
      const active = await activeCricketAssignment(syncResult.masterPlayerId, tournamentId);
      if (!active || active.auctionPlayerId == null || active.auctionPlayerId === auctionPlayer.id) {
        await endActiveRosterAssignment(syncResult.masterPlayerId, tournamentId, "cricket");
      }
    }
    return null;
  }

  let syncResult = await syncAuctionPlayerToMaster(auctionPlayer.id, tournamentId, {
    claimedMasterIds,
  });
  if (!syncResult) return null;

  const masterTeamId = await syncAuctionTeamToMaster(auctionPlayer.teamId, tournamentId);
  if (!masterTeamId) return syncResult.masterPlayerId;

  let masterPlayerId = syncResult.masterPlayerId;
  let active = await activeCricketAssignment(masterPlayerId, tournamentId);
  if (active && active.auctionPlayerId != null && active.auctionPlayerId !== auctionPlayer.id) {
    const blocked = new Set(claimedMasterIds);
    blocked.add(masterPlayerId);
    const fresh = await syncAuctionPlayerToMaster(auctionPlayer.id, tournamentId, {
      claimedMasterIds: blocked,
    });
    if (!fresh || fresh.masterPlayerId === masterPlayerId) {
      console.error(
        "[cricket-roster] refused to reuse another player's roster identity",
        auctionPlayer.id,
      );
      return null;
    }
    syncResult = fresh;
    masterPlayerId = fresh.masterPlayerId;
    active = await activeCricketAssignment(masterPlayerId, tournamentId);
  }

  const type = assignmentType ?? rosterTypeFromPlayer(auctionPlayer);

  if (rosterAssignmentCoversPlayer(active, masterTeamId, auctionPlayer)) {
    return masterPlayerId;
  }

  await assignPlayerToFranchiseRoster({
    masterPlayerId,
    masterTeamId,
    tournamentId,
    auctionPlayerId: auctionPlayer.id,
    auctionTeamId: auctionPlayer.teamId,
    assignmentType: type,
    sport: "cricket",
  });

  await ensureCricketStatisticsBaseline(masterPlayerId, tournamentId);

  return masterPlayerId;
}

/**
 * Organizer team assignment (players.teamId) is what the roster page shows.
 * Scoring reads PTA, so a kid assigned on the team but missing a PTA row never
 * appears in the playing XI picker. Create those rows before returning the squad.
 */
async function repairMissingTeamRoster(
  tournamentId: number,
  auctionTeamId?: number,
): Promise<void> {
  const filters = [
    eq(playersTable.tournamentId, tournamentId),
    eq(playersTable.isNonPlayingMember, false),
    isNotNull(playersTable.teamId),
  ];
  if (auctionTeamId != null) {
    filters.push(eq(playersTable.teamId, auctionTeamId));
  }

  const roster = await db
    .select()
    .from(playersTable)
    .where(and(...filters));
  const eligible = roster.filter((player: Player) => isFranchiseRosterEligible(player));
  if (eligible.length === 0) return;

  const assigned = await listCricketFranchisePlayers(tournamentId, auctionTeamId);
  const teamByPlayer = new Map(assigned.map((player) => [player.playerId, player.teamId]));
  const missing = eligible.filter((player: Player) => teamByPlayer.get(player.id) !== player.teamId);
  if (missing.length === 0) return;

  for (const player of missing) {
    try {
      await syncAuctionPlayerRosterAssignment(player, tournamentId);
    } catch (err) {
      console.error("[cricket-roster] squad repair failed:", player.id, err);
    }
  }
}

/**
 * Full roster sync: all auction/Sports teams + franchise-assigned players → master layer.
 * Players with a teamId are Sports-ready even without auction sold/retained status
 * (corporate / manual assign paths).
 */
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
    const masterId = await syncAuctionPlayerRosterAssignment(p, tournamentId);
    if (masterId && isFranchiseRosterEligible(p)) playersSynced++;
  }

  await logSync("cricket_roster_sync", "tournament", String(tournamentId), null, null, {
    teamsSynced,
    playersSynced,
  });

  return { teamsSynced, playersSynced };
}

export type AuctionSportsHandoffResult = {
  /** Opaque organiser-facing counts (not internal sync jargon). */
  teamsReady: number;
  playersReady: number;
  sportId: string;
  /** True when Cricket Sports can create matches (≥2 franchise teams with squad). */
  readyForMatches: boolean;
};

/**
 * Canonical Auction → Sports participant handoff for a tournament.
 * Idempotent: safe to call repeatedly; does not duplicate PTA rows.
 * Cricket: full franchise roster rebuild. Other sports: master-player link only.
 */
export async function handoffAuctionParticipantsToSports(
  tournamentId: number,
): Promise<AuctionSportsHandoffResult> {
  const [tournament] = await db
    .select({ sport: tournamentsTable.sport })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) {
    throw new Error("Tournament not found");
  }

  const sportId = (tournament.sport ?? "cricket").trim().toLowerCase();

  if (sportId === "cricket") {
    const { teamsSynced, playersSynced } = await syncCricketRosterFromAuction(tournamentId);
    const franchise = await listCricketMasterTeams(tournamentId);
    const withSquad = franchise.filter((t) => t.squadCount > 0);
    return {
      teamsReady: teamsSynced,
      playersReady: playersSynced,
      sportId,
      readyForMatches: franchise.length >= 2 && withSquad.length >= 2,
    };
  }

  // Non-cricket: preserve prior conclude behaviour (identity link only).
  const playersReady = await syncAllAuctionPlayersToMaster(tournamentId);
  return {
    teamsReady: 0,
    playersReady,
    sportId,
    readyForMatches: false,
  };
}

/** Fire-and-forget for Auction conclude / auto-complete. */
export function handoffAuctionParticipantsToSportsAsync(tournamentId: number): void {
  void handoffAuctionParticipantsToSports(tournamentId).catch((err) => {
    console.error("[auction→sports] handoffAuctionParticipantsToSports failed:", err);
  });
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

type CacheItem<T> = {
  data: T;
  expiresAt: number;
};

const masterTeamsCache = new Map<number, CacheItem<CricketMasterTeamItem[]>>();
const masterPlayersCache = new Map<string, CacheItem<CricketMasterPlayerItem[]>>();
const MASTER_CACHE_TTL_MS = 25_000;

export function invalidateCricketRosterCache(tournamentId: number) {
  masterTeamsCache.delete(tournamentId);
  for (const key of masterPlayersCache.keys()) {
    if (key.startsWith(`${tournamentId}:`)) {
      masterPlayersCache.delete(key);
    }
  }
}

async function listCricketMasterTeamsRaw(tournamentId: number): Promise<CricketMasterTeamItem[]> {
  const franchise = await listCricketFranchiseTeams(tournamentId);
  const byAuctionId = new Map<number, CricketMasterTeamItem>();

  for (const t of franchise) {
    byAuctionId.set(t.teamId, {
      auctionTeamId: t.teamId,
      masterTeamId: t.masterTeamId,
      name: t.name,
      shortName: t.shortCode,
      logoUrl: t.logoUrl,
      primaryColor: t.color,
      squadCount: t.squadCount,
      syncedToMaster: Boolean(t.masterTeamId),
    });
  }

  const tournamentTeams = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      shortCode: teamsTable.shortCode,
      logoUrl: teamsTable.logoUrl,
      color: teamsTable.color,
      masterTeamId: teamsTable.masterTeamId,
    })
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId));

  for (const t of tournamentTeams) {
    const existing = byAuctionId.get(t.id);
    if (existing) {
      byAuctionId.set(t.id, {
        ...existing,
        name: t.name || existing.name,
        shortName: t.shortCode || existing.shortName,
        logoUrl: t.logoUrl ?? existing.logoUrl,
        primaryColor: t.color ?? existing.primaryColor,
        masterTeamId: existing.masterTeamId ?? t.masterTeamId,
        syncedToMaster: Boolean(existing.masterTeamId ?? t.masterTeamId),
      });
      continue;
    }
    byAuctionId.set(t.id, {
      auctionTeamId: t.id,
      masterTeamId: t.masterTeamId,
      name: t.name,
      shortName: t.shortCode,
      logoUrl: t.logoUrl,
      primaryColor: t.color,
      squadCount: 0,
      syncedToMaster: Boolean(t.masterTeamId),
    });
  }

  return [...byAuctionId.values()].sort((a, b) => a.auctionTeamId - b.auctionTeamId);
}

/**
 * List franchise teams for cricket scorer UI (match create, fixtures, etc.).
 *
 * Includes every tournament team from Sports/Auction identity — not only teams that
 * already have active Player Registry (PTA) rows. Empty squads still appear so
 * organizers can pick all franchises; `squadCount` reflects PTA readiness.
 */
export async function listCricketMasterTeams(
  tournamentId: number,
): Promise<CricketMasterTeamItem[]> {
  const now = Date.now();
  const cached = masterTeamsCache.get(tournamentId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const result = await listCricketMasterTeamsRaw(tournamentId);
  masterTeamsCache.set(tournamentId, {
    data: result,
    expiresAt: now + MASTER_CACHE_TTL_MS,
  });
  return result;
}

/** List players for cricket scorer from Player Registry — optional filter by opaque team id. */
export async function listCricketMasterPlayers(
  tournamentId: number,
  auctionTeamId?: number,
): Promise<CricketMasterPlayerItem[]> {
  const cacheKey = `${tournamentId}:${auctionTeamId ?? "all"}`;
  const now = Date.now();
  const cached = masterPlayersCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  try {
    await repairMissingTeamRoster(tournamentId, auctionTeamId);
  } catch (err) {
    console.error("[cricket-roster] squad repair failed:", err);
  }

  const players = await listCricketFranchisePlayers(tournamentId, auctionTeamId);
  const result = players.map((p) => ({
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

  masterPlayersCache.set(cacheKey, {
    data: result,
    expiresAt: now + MASTER_CACHE_TTL_MS,
  });
  return result;
}

/** Squad eligible for playing XI (active Player Registry assignment on team). */
export async function listCricketSquadPlayers(
  tournamentId: number,
  auctionTeamId: number,
): Promise<CricketMasterPlayerItem[]> {
  return listCricketMasterPlayers(tournamentId, auctionTeamId);
}
