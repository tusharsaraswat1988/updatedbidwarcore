import { db } from "@workspace/db";
import {
  auctionSessionsTable,
  bidsTable,
  playersTable,
  type Player,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { playerSpecificationService } from "./player-specification-service";
import { recalcTeamPurseUsed } from "./player-purse";

export type PlayerDeleteGuardResult =
  | { ok: true }
  | { ok: false; status: number; error: string; code: string };

const BLOCKED_AUCTION_STATUSES = new Set(["sold", "retained", "unsold"]);

/**
 * Players tied to auction outcomes or an active auction block cannot be removed via registration delete.
 */
export async function validatePlayerDeletable(
  tournamentId: number,
  player: Pick<Player, "id" | "status" | "teamId">,
): Promise<PlayerDeleteGuardResult> {
  if (BLOCKED_AUCTION_STATUSES.has(player.status)) {
    return {
      ok: false,
      status: 409,
      code: "PLAYER_IN_AUCTION_ROSTER",
      error: `Cannot delete a player with auction status "${player.status}". Remove auction assignment first or mark as available.`,
    };
  }

  const [{ bidCount }] = await db
    .select({ bidCount: sql<number>`cast(count(*) as int)` })
    .from(bidsTable)
    .where(and(eq(bidsTable.tournamentId, tournamentId), eq(bidsTable.playerId, player.id)));

  if (Number(bidCount) > 0) {
    return {
      ok: false,
      status: 409,
      code: "PLAYER_HAS_BIDS",
      error: "Cannot delete a player who has bid history in this tournament.",
    };
  }

  const [session] = await db
    .select({
      currentPlayerId: auctionSessionsTable.currentPlayerId,
      deferredPlayerIds: auctionSessionsTable.deferredPlayerIds,
    })
    .from(auctionSessionsTable)
    .where(eq(auctionSessionsTable.tournamentId, tournamentId))
    .limit(1);

  if (session?.currentPlayerId === player.id) {
    return {
      ok: false,
      status: 409,
      code: "PLAYER_ON_AUCTION_BLOCK",
      error: "Cannot delete the player currently on the auction block.",
    };
  }

  if (session?.deferredPlayerIds) {
    try {
      const deferred = JSON.parse(session.deferredPlayerIds) as number[];
      if (deferred.includes(player.id)) {
        return {
          ok: false,
          status: 409,
          code: "PLAYER_IN_DEFERRED_QUEUE",
          error: "Cannot delete a player in the deferred auction queue. Remove them from the queue first.",
        };
      }
    } catch {
      // ignore malformed JSON
    }
  }

  return { ok: true };
}

/** Deletes registration-scoped player data that is not enforced by FK cascade. */
export async function deletePlayerRegistrationData(
  tournamentId: number,
  playerId: number,
  teamId: number | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(bidsTable)
      .where(and(eq(bidsTable.tournamentId, tournamentId), eq(bidsTable.playerId, playerId)));
    await playerSpecificationService.deletePlayerSpecifications(playerId);
    await tx
      .delete(playersTable)
      .where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tournamentId)));
  });

  if (teamId != null) {
    await recalcTeamPurseUsed(tournamentId, teamId);
  }
}
