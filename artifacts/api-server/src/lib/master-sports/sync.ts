/**
 * Master Sports sync layer — AuctionPlayer → MasterPlayer, team assignments.
 */

import { eq, and, sql, or, ilike } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  globalPlayersTable,
  playersTable,
  teamsTable,
  masterTeamsTable,
  masterSponsorsTable,
  type Player,
  type Team,
} from "@workspace/db";
import { parseIndianMobile } from "@workspace/api-base/mobile";
import { parseOptionalEmail } from "@workspace/api-base/email";
import { logSync } from "./sync-helpers";
import {
  assignPlayerToFranchiseRoster,
  endActiveRosterAssignment,
} from "./roster-assignments";
import { ensureCricketStatisticsBaseline } from "./cricket-stats";

export type SyncResult = {
  masterPlayerId: string;
  created: boolean;
  updated: boolean;
};

function generateMasterId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Find existing master player by auction id, mobile, email, or name similarity. */
async function findExistingMasterPlayer(
  auctionPlayer: Player,
): Promise<typeof globalPlayersTable.$inferSelect | null> {
  if (auctionPlayer.globalPlayerId) {
    const [byLink] = await db
      .select()
      .from(globalPlayersTable)
      .where(eq(globalPlayersTable.id, auctionPlayer.globalPlayerId))
      .limit(1);
    if (byLink) return byLink;
  }

  const [byAuctionId] = await db
    .select()
    .from(globalPlayersTable)
    .where(eq(globalPlayersTable.auctionPlayerId, auctionPlayer.id))
    .limit(1);
  if (byAuctionId) return byAuctionId;

  if (auctionPlayer.mobileNumber) {
    const mobileParsed = parseIndianMobile(auctionPlayer.mobileNumber);
    if (mobileParsed.ok) {
      const [byMobile] = await db
        .select()
        .from(globalPlayersTable)
        .where(eq(globalPlayersTable.mobileNumber, mobileParsed.normalized))
        .limit(1);
      if (byMobile) return byMobile;
    }
  }

  if (auctionPlayer.email) {
    const emailParsed = parseOptionalEmail(auctionPlayer.email);
    if (emailParsed.ok && emailParsed.email) {
      const [byEmail] = await db
        .select()
        .from(globalPlayersTable)
        .where(sql`lower(${globalPlayersTable.email}) = lower(${emailParsed.email})`)
        .limit(1);
      if (byEmail) return byEmail;
    }
  }

  const normalized = normalizeName(auctionPlayer.name);
  if (normalized.length >= 3) {
    const candidates = await db
      .select()
      .from(globalPlayersTable)
      .where(
        or(
          ilike(globalPlayersTable.canonicalName, auctionPlayer.name),
          ilike(globalPlayersTable.displayName, auctionPlayer.name),
          sql`lower(${globalPlayersTable.canonicalName}) = ${normalized}`,
        ),
      )
      .limit(5);

    for (const c of candidates) {
      if (normalizeName(c.canonicalName) === normalized) return c;
      if (c.displayName && normalizeName(c.displayName) === normalized) return c;
    }
  }

  return null;
}

function buildMasterPlayerFields(auctionPlayer: Player) {
  const { firstName, lastName } = splitName(auctionPlayer.name);
  const mobileParsed = auctionPlayer.mobileNumber
    ? parseIndianMobile(auctionPlayer.mobileNumber)
    : null;
  const emailParsed = auctionPlayer.email ? parseOptionalEmail(auctionPlayer.email) : null;

  return {
    canonicalName: auctionPlayer.name,
    firstName,
    lastName,
    displayName: auctionPlayer.name,
    mobileNumber: mobileParsed?.ok ? mobileParsed.normalized : auctionPlayer.mobileNumber || null,
    email: emailParsed?.ok ? emailParsed.email : null,
    city: auctionPlayer.city,
    age: auctionPlayer.age,
    gender: auctionPlayer.gender,
    photoUrl: auctionPlayer.photoUrl,
    auctionPlayerId: auctionPlayer.id,
    defaultRole: auctionPlayer.role,
    sport: "cricket",
  };
}

/**
 * Sync a single auction player to MasterPlayer (global_players).
 * Links players.global_player_id when newly created or matched.
 */
export async function syncAuctionPlayerToMaster(
  auctionPlayerId: number,
  tournamentId?: number,
): Promise<SyncResult | null> {
  const [auctionPlayer] = await db
    .select()
    .from(playersTable)
    .where(
      tournamentId
        ? and(eq(playersTable.id, auctionPlayerId), eq(playersTable.tournamentId, tournamentId))
        : eq(playersTable.id, auctionPlayerId),
    )
    .limit(1);

  if (!auctionPlayer) return null;

  const fields = buildMasterPlayerFields(auctionPlayer);
  const existing = await findExistingMasterPlayer(auctionPlayer);

  if (existing) {
    const [updated] = await db
      .update(globalPlayersTable)
      .set({
        ...fields,
        auctionPlayerId: auctionPlayer.id,
        updatedAt: new Date(),
      })
      .where(eq(globalPlayersTable.id, existing.id))
      .returning();

    if (!auctionPlayer.globalPlayerId) {
      await db
        .update(playersTable)
        .set({ globalPlayerId: updated.id })
        .where(eq(playersTable.id, auctionPlayer.id));
    }

    await logSync("auction_player_synced", "auction_player", String(auctionPlayer.id), updated.id, null, {
      matched: true,
      created: false,
    });

    return { masterPlayerId: updated.id, created: false, updated: true };
  }

  const gpId = generateMasterId("gp");
  const [created] = await db
    .insert(globalPlayersTable)
    .values({ id: gpId, ...fields })
    .returning();

  await db
    .update(playersTable)
    .set({ globalPlayerId: created.id })
    .where(eq(playersTable.id, auctionPlayer.id));

  await logSync("auction_player_synced", "auction_player", String(auctionPlayer.id), created.id, null, {
    matched: false,
    created: true,
  });

  return { masterPlayerId: created.id, created: true, updated: false };
}

/** Sync all players in an auction tournament (e.g. on conclude). */
export async function syncAllAuctionPlayersToMaster(tournamentId: number): Promise<number> {
  const players = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tournamentId));

  let synced = 0;
  for (const p of players) {
    const result = await syncAuctionPlayerToMaster(p.id, tournamentId);
    if (result) synced++;
  }
  return synced;
}

/** Sync auction team → MasterTeam; returns master team id. */
export async function syncAuctionTeamToMaster(
  auctionTeamId: number,
  tournamentId: number,
): Promise<string | null> {
  const [team] = await db
    .select()
    .from(teamsTable)
    .where(and(eq(teamsTable.id, auctionTeamId), eq(teamsTable.tournamentId, tournamentId)))
    .limit(1);

  if (!team) return null;

  if (team.masterTeamId) return team.masterTeamId;

  const existing = await db
    .select()
    .from(masterTeamsTable)
    .where(
      and(
        ilike(masterTeamsTable.name, team.name),
        team.ownerName ? ilike(masterTeamsTable.ownerName, team.ownerName) : sql`true`,
      ),
    )
    .limit(1);

  let masterTeamId: string;

  if (existing[0]) {
    masterTeamId = existing[0].id;
    await db
      .update(masterTeamsTable)
      .set({
        shortName: team.shortCode,
        logoUrl: team.logoUrl,
        primaryColor: team.color,
        ownerName: team.ownerName,
        updatedAt: new Date(),
      })
      .where(eq(masterTeamsTable.id, masterTeamId));
  } else {
    masterTeamId = generateMasterId("mt");
    await db.insert(masterTeamsTable).values({
      id: masterTeamId,
      name: team.name,
      shortName: team.shortCode,
      logoUrl: team.logoUrl,
      primaryColor: team.color ?? undefined,
      ownerName: team.ownerName,
    });
  }

  await db
    .update(teamsTable)
    .set({ masterTeamId })
    .where(eq(teamsTable.id, auctionTeamId));

  await logSync("auction_team_synced", "auction_team", String(auctionTeamId), null, masterTeamId);

  return masterTeamId;
}

/** Create player-team assignment when player is sold in auction. */
export async function createPlayerTeamAssignmentFromSale(
  auctionPlayer: Player,
  auctionTeam: Team,
  tournamentId: number,
): Promise<void> {
  const syncResult = await syncAuctionPlayerToMaster(auctionPlayer.id, tournamentId);
  if (!syncResult) return;

  const masterTeamId = await syncAuctionTeamToMaster(auctionTeam.id, tournamentId);
  if (!masterTeamId) return;

  const assignmentType =
    auctionPlayer.status === "retained" ? "retained" : "auction_sale";

  await assignPlayerToFranchiseRoster({
    masterPlayerId: syncResult.masterPlayerId,
    masterTeamId,
    tournamentId,
    auctionPlayerId: auctionPlayer.id,
    auctionTeamId: auctionTeam.id,
    assignmentType,
  });

  await ensureCricketStatisticsBaseline(syncResult.masterPlayerId, tournamentId);
}

/** Fire-and-forget wrapper for auction hooks. */
export function syncAuctionPlayerToMasterAsync(
  auctionPlayerId: number,
  tournamentId?: number,
): void {
  void syncAuctionPlayerToMaster(auctionPlayerId, tournamentId).catch((err) => {
    console.error("[master-sports] syncAuctionPlayerToMaster failed:", err);
  });
}

export function onAuctionPlayerSoldAsync(
  auctionPlayer: Player,
  auctionTeam: Team,
  tournamentId: number,
): void {
  void createPlayerTeamAssignmentFromSale(auctionPlayer, auctionTeam, tournamentId).catch((err) => {
    console.error("[master-sports] createPlayerTeamAssignmentFromSale failed:", err);
  });
}

export function syncAllAuctionPlayersAsync(tournamentId: number): void {
  void syncAllAuctionPlayersToMaster(tournamentId).catch((err) => {
    console.error("[master-sports] syncAllAuctionPlayersToMaster failed:", err);
  });
}
