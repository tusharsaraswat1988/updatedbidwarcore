import { sql } from "drizzle-orm";

/**
 * BidWar Advisory Lock Namespaces (PostgreSQL 2-key advisory lock space: locktag_field4 = 2)
 *
 * 1001: Tournament Lifecycle Tier (Shared for operational mutations, Exclusive for Reset Data / Activate Live)
 * 1002: Auction Lot Tier (Exclusive per tournament lot)
 * 1003: Cricket Match Tier (Exclusive per cricket match)
 * 1004: Badminton Match Tier (Exclusive per badminton match)
 */
export const LOCK_NAMESPACE_LIFECYCLE = 1001;
export const LOCK_NAMESPACE_AUCTION_LOT = 1002;
export const LOCK_NAMESPACE_CRICKET_MATCH = 1003;
export const LOCK_NAMESPACE_BADMINTON_MATCH = 1004;

export type TransactionExecutor = {
  execute?: (query: any) => Promise<unknown>;
};

/**
 * Asserts that the transaction has an executable query interface in non-test environments.
 */
function assertExecutor(tx: TransactionExecutor, lockDescription: string): boolean {
  if (typeof tx?.execute === "function") {
    return true;
  }
  // In production / non-test environments, an invalid transaction object is a fatal error to prevent silent lock skipping.
  if (process.env.NODE_ENV === "production") {
    throw new Error(`CRITICAL: Cannot acquire ${lockDescription} - transaction object lacks execute()`);
  }
  return false;
}

/**
 * Tier 1 Lifecycle Shared Lock:
 * Acquired by all operational mutations (Auction bids/sales, Cricket scoring, Badminton scoring).
 * Multiple operational mutations across any module can hold this simultaneously without blocking each other.
 * Blocks (and is blocked by) Tier 1 Lifecycle Exclusive Lock.
 */
export async function lockTournamentLifecycleShared(
  tx: TransactionExecutor,
  tournamentId: number,
): Promise<void> {
  if (!assertExecutor(tx, `Tournament Lifecycle Shared Lock for tournament ${tournamentId}`)) return;
  await tx.execute!(sql`SELECT pg_advisory_xact_lock_shared(${LOCK_NAMESPACE_LIFECYCLE}, ${tournamentId})`);
}

/**
 * Tier 1 Lifecycle Exclusive Lock:
 * Acquired by maintenance operations: Reset Data, Activate Live, Admin Reset.
 * Blocks all operational mutations across Auction, Cricket, and Badminton until transaction commit/rollback.
 */
export async function lockTournamentLifecycleExclusive(
  tx: TransactionExecutor,
  tournamentId: number,
): Promise<void> {
  if (!assertExecutor(tx, `Tournament Lifecycle Exclusive Lock for tournament ${tournamentId}`)) return;
  await tx.execute!(sql`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_LIFECYCLE}, ${tournamentId})`);
  // Also acquire legacy 1-key lock for safe coexistence with any legacy v1 node
  await tx.execute!(sql`SELECT pg_advisory_xact_lock(hashtext(${`bidwar-demo-reset:${tournamentId}`}))`);
}

/**
 * Tier 2 Auction Lot Lock:
 * Serializes mutations on the active auction lot (bidding, lot sale, unsold, lot rollback).
 */
export async function lockAuctionLotExclusive(
  tx: TransactionExecutor,
  tournamentId: number,
): Promise<void> {
  if (!assertExecutor(tx, `Auction Lot Lock for tournament ${tournamentId}`)) return;
  await tx.execute!(sql`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_AUCTION_LOT}, ${tournamentId})`);
}

/**
 * Tier 2 Cricket Match Lock:
 * Serializes scoring mutations on a specific cricket match.
 */
export async function lockCricketMatchExclusive(
  tx: TransactionExecutor,
  matchId: number,
): Promise<void> {
  if (!assertExecutor(tx, `Cricket Match Lock for match ${matchId}`)) return;
  await tx.execute!(sql`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_CRICKET_MATCH}, ${matchId})`);
}

/**
 * Tier 2 Badminton Match Lock:
 * Serializes scoring mutations on a specific badminton match.
 */
export async function lockBadmintonMatchExclusive(
  tx: TransactionExecutor,
  matchId: number,
): Promise<void> {
  if (!assertExecutor(tx, `Badminton Match Lock for match ${matchId}`)) return;
  await tx.execute!(sql`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_BADMINTON_MATCH}, ${matchId})`);
}
