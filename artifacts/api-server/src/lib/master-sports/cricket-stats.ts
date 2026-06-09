/**
 * Cricket player statistics baseline (master player id keyed).
 */

import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { playerStatisticsTable } from "@workspace/db";

export async function ensureCricketStatisticsBaseline(
  masterPlayerId: string,
  tournamentId: number,
): Promise<void> {
  const [existing] = await db
    .select({ id: playerStatisticsTable.id })
    .from(playerStatisticsTable)
    .where(
      and(
        eq(playerStatisticsTable.playerId, masterPlayerId),
        eq(playerStatisticsTable.sport, "cricket"),
        eq(playerStatisticsTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(playerStatisticsTable).values({
      playerId: masterPlayerId,
      sport: "cricket",
      tournamentId,
      statsJson: {},
    });
  }
}
