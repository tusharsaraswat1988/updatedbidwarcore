import { db, playersTable } from "@workspace/db";
import { asc, eq, max } from "drizzle-orm";

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

/** Renumber remaining tournament players to a continuous 1..n sequence (preserves relative order). */
export async function compactTournamentPlayerSerialNos(tournamentId: number): Promise<number> {
  const players = await db
    .select({ id: playersTable.id, serialNo: playersTable.serialNo })
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tournamentId))
    .orderBy(asc(playersTable.serialNo), asc(playersTable.id));

  let updated = 0;
  await db.transaction(async (tx) => {
    for (let i = 0; i < players.length; i++) {
      const nextSerial = i + 1;
      if (players[i]!.serialNo === nextSerial) continue;
      await tx
        .update(playersTable)
        .set({ serialNo: nextSerial })
        .where(eq(playersTable.id, players[i]!.id));
      updated++;
    }
  });
  return updated;
}
