import { db } from "@workspace/db";
import { playersTable, teamsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

/**
 * Recalculate and persist team.purseUsed from current player records.
 * Called when a player's retained/sold status or teamId changes, or after delete.
 */
export async function recalcTeamPurseUsed(tournamentId: number, teamId: number): Promise<void> {
  const players = await db
    .select({
      status: playersTable.status,
      soldPrice: playersTable.soldPrice,
      retainedPrice: playersTable.retainedPrice,
    })
    .from(playersTable)
    .where(and(eq(playersTable.tournamentId, tournamentId), eq(playersTable.teamId, teamId)));

  const purseUsed = players.reduce((sum, p) => {
    if (p.status === "sold") return sum + (p.soldPrice ?? 0);
    if (p.status === "retained") return sum + (p.retainedPrice ?? 0);
    return sum;
  }, 0);

  await db.update(teamsTable).set({ purseUsed }).where(eq(teamsTable.id, teamId));
}
