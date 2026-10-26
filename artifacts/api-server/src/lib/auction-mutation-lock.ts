import { sql } from "drizzle-orm";

/**
 * Serializes demo cleanup, live-license activation, and auction mutations
 * for one tournament. The lock is held until the surrounding transaction ends.
 * Mock transactions without `execute` skip the lock so route unit tests stay isolated.
 */
export function auctionMutationLockStatement(tournamentId: number) {
  return sql`select pg_advisory_xact_lock(hashtext(${`bidwar-demo-reset:${tournamentId}`}))`;
}

export async function lockAuctionMutation(
  tx: { execute?: (query: ReturnType<typeof auctionMutationLockStatement>) => Promise<unknown> },
  tournamentId: number,
): Promise<void> {
  if (typeof tx.execute !== "function") return;
  await tx.execute(auctionMutationLockStatement(tournamentId));
}
