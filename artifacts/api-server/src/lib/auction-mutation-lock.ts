import { sql } from "drizzle-orm";
import {
  lockTournamentLifecycleShared,
  lockTournamentLifecycleExclusive,
  lockAuctionLotExclusive,
  type TransactionExecutor,
} from "./tournament-locks";

export {
  lockTournamentLifecycleShared,
  lockTournamentLifecycleExclusive,
  lockAuctionLotExclusive,
};

/**
 * Returns the legacy single-key advisory lock statement for backward compatibility.
 */
export function auctionMutationLockStatement(tournamentId: number) {
  return sql`select pg_advisory_xact_lock(hashtext(${`bidwar-demo-reset:${tournamentId}`}))`;
}

/**
 * Serializes demo cleanup, live-license activation, and auction mutations for one tournament.
 * Enforces the strict two-tier lock order:
 * 1. Tier 1: Tournament Lifecycle Shared Lock (1001, tournamentId)
 * 2. Tier 2: Auction Lot Exclusive Lock (1002, tournamentId)
 * 3. Legacy compatibility lock: hashtext('bidwar-demo-reset:' || tournamentId)
 */
export async function lockAuctionMutation(
  tx: TransactionExecutor,
  tournamentId: number,
): Promise<void> {
  if (typeof tx?.execute !== "function") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`CRITICAL: Cannot acquire auction mutation lock - transaction object lacks execute()`);
    }
    return;
  }

  // 1. Tier 1 Shared lock: allows concurrent bidding and scoring across matches, blocks if Reset Data / Activate Live is running
  await lockTournamentLifecycleShared(tx, tournamentId);

  // 2. Tier 2 Exclusive lot lock: serializes auction bids on this lot
  await lockAuctionLotExclusive(tx, tournamentId);

  // 3. Legacy hash lock for backward compatibility during rolling deploy
  await tx.execute(auctionMutationLockStatement(tournamentId));
}
