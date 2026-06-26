import { db } from "@workspace/db";
import {
  auctionSessionsTable,
  playersTable,
  tournamentsTable,
  type Player,
} from "@workspace/db";
import { and, eq, ne, sql } from "drizzle-orm";
import { recalcTeamPurseUsed } from "./player-purse";
import { PLAYER_AUCTION_STATUSES, type PlayerAuctionStatus } from "./player-status";

export { PLAYER_AUCTION_STATUSES, type PlayerAuctionStatus };

export type PlayerWithdrawalResult =
  | { ok: true; player: Player }
  | { ok: false; status: number; error: string; code: string };

export type PlayerReinstateResult =
  | { ok: true; player: Player }
  | { ok: false; status: number; error: string; code: string };

const BLOCKED_WITHDRAW_STATUSES = new Set(["sold", "retained"]);

/**
 * Remove a player from deferred queue, random draw queue, and active auction block.
 */
export async function removePlayerFromAuctionPools(
  tournamentId: number,
  playerId: number,
): Promise<void> {
  const [session] = await db
    .select()
    .from(auctionSessionsTable)
    .where(eq(auctionSessionsTable.tournamentId, tournamentId))
    .limit(1);

  if (!session) return;

  const updates: Record<string, unknown> = {};

  if (session.deferredPlayerIds) {
    try {
      const deferred = JSON.parse(session.deferredPlayerIds) as number[];
      if (deferred.includes(playerId)) {
        const next = deferred.filter((id) => id !== playerId);
        updates.deferredPlayerIds = next.length > 0 ? JSON.stringify(next) : null;
      }
    } catch {
      // ignore malformed JSON
    }
  }

  if (session.randomDrawQueue) {
    try {
      const queue = JSON.parse(session.randomDrawQueue) as number[];
      if (queue.includes(playerId)) {
        const next = queue.filter((id) => id !== playerId);
        updates.randomDrawQueue = next.length > 0 ? JSON.stringify(next) : null;
      }
    } catch {
      // ignore malformed JSON
    }
  }

  if (session.currentPlayerId === playerId) {
    updates.currentPlayerId = null;
    updates.currentBid = null;
    updates.currentBidTeamId = null;
    updates.timerEndsAt = null;
    updates.timerType = null;
    updates.pausedTimeRemaining = null;
    updates.lastAction = "Player withdrawn — block cleared";
    updates.lastOutcome = null;
  }

  if (Object.keys(updates).length === 0) return;

  await db
    .update(auctionSessionsTable)
    .set(updates)
    .where(eq(auctionSessionsTable.tournamentId, tournamentId));
}

export async function countActiveRegistrations(tournamentId: number): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playersTable)
    .where(
      and(
        eq(playersTable.tournamentId, tournamentId),
        ne(playersTable.status, "withdrawn"),
      ),
    );
  return Number(count);
}

export async function withdrawTournamentPlayer(
  tournamentId: number,
  player: Player,
): Promise<PlayerWithdrawalResult> {
  if (player.status === "withdrawn") {
    return {
      ok: false,
      status: 409,
      code: "ALREADY_WITHDRAWN",
      error: "Player is already withdrawn.",
    };
  }

  if (BLOCKED_WITHDRAW_STATUSES.has(player.status)) {
    return {
      ok: false,
      status: 409,
      code: "CANNOT_WITHDRAW_AUCTION_ROSTER",
      error: `Cannot withdraw a player with status "${player.status}". Release from team or undo auction outcome first.`,
    };
  }

  await removePlayerFromAuctionPools(tournamentId, player.id);

  const previousTeamId = player.teamId;

  const withdrawalPatch: Record<string, unknown> = { status: "withdrawn" };
  if (player.teamId != null) withdrawalPatch.teamId = null;
  if (player.soldPrice != null) withdrawalPatch.soldPrice = null;
  if (player.retainedPrice != null) withdrawalPatch.retainedPrice = null;

  const [updated] = await db
    .update(playersTable)
    .set(withdrawalPatch)
    .where(and(eq(playersTable.id, player.id), eq(playersTable.tournamentId, tournamentId)))
    .returning();

  if (!updated) {
    return { ok: false, status: 404, code: "NOT_FOUND", error: "Player not found" };
  }

  if (previousTeamId != null) {
    await recalcTeamPurseUsed(tournamentId, previousTeamId);
  }

  return { ok: true, player: updated };
}

export async function reinstateTournamentPlayer(
  tournamentId: number,
  player: Player,
): Promise<PlayerReinstateResult> {
  if (player.status !== "withdrawn") {
    return {
      ok: false,
      status: 409,
      code: "NOT_WITHDRAWN",
      error: "Only withdrawn players can be reinstated.",
    };
  }

  const [tournament] = await db
    .select({
      registrationLimit: tournamentsTable.registrationLimit,
      status: tournamentsTable.status,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) {
    return { ok: false, status: 404, code: "NOT_FOUND", error: "Tournament not found" };
  }

  if (tournament.status === "completed") {
    return {
      ok: false,
      status: 409,
      code: "TOURNAMENT_COMPLETED",
      error: "Cannot reinstate players after the tournament is completed.",
    };
  }

  const limit = tournament.registrationLimit ?? null;
  if (limit !== null) {
    const activeCount = await countActiveRegistrations(tournamentId);
    if (activeCount >= limit) {
      return {
        ok: false,
        status: 403,
        code: "REGISTRATION_LIMIT_REACHED",
        error: "Registration limit reached. Increase the limit or withdraw another player first.",
      };
    }
  }

  const [updated] = await db
    .update(playersTable)
    .set({ status: "available" })
    .where(and(eq(playersTable.id, player.id), eq(playersTable.tournamentId, tournamentId)))
    .returning();

  if (!updated) {
    return { ok: false, status: 404, code: "NOT_FOUND", error: "Player not found" };
  }

  return { ok: true, player: updated };
}

export type PublicWithdrawnReRegistrationResult = {
  player: Player;
  reinstated: boolean;
  requiresOrganizerApproval: boolean;
  reinstateBlockedCode?: string;
};

/**
 * After a withdrawn player's profile is updated via public registration, optionally
 * reinstate them when the tournament allows automatic approval.
 */
export async function applyPublicWithdrawnReRegistration(
  tournamentId: number,
  player: Player,
  autoApproveWithdrawnReRegistration: boolean,
): Promise<PublicWithdrawnReRegistrationResult> {
  if (player.status !== "withdrawn") {
    return { player, reinstated: false, requiresOrganizerApproval: false };
  }

  if (!autoApproveWithdrawnReRegistration) {
    return { player, reinstated: false, requiresOrganizerApproval: true };
  }

  const result = await reinstateTournamentPlayer(tournamentId, player);
  if (!result.ok) {
    return {
      player,
      reinstated: false,
      requiresOrganizerApproval: true,
      reinstateBlockedCode: result.code,
    };
  }

  return {
    player: result.player,
    reinstated: true,
    requiresOrganizerApproval: false,
  };
}
