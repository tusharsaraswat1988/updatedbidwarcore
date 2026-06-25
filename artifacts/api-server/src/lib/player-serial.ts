import { db, playersTable } from "@workspace/db";
import { eq, max } from "drizzle-orm";

/** Next tournament-scoped serial (1-based per tournament). */
export async function allocateNextPlayerSerialNo(tournamentId: number): Promise<number> {
  const [row] = await db
    .select({ maxSerial: max(playersTable.serialNo) })
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tournamentId));
  return (row?.maxSerial ?? 0) + 1;
}

/** Reserve a contiguous block for bulk/import inserts. */
export async function allocatePlayerSerialNoBlock(
  tournamentId: number,
  count: number,
): Promise<number> {
  if (count <= 0) return 0;
  const start = await allocateNextPlayerSerialNo(tournamentId);
  return start;
}
