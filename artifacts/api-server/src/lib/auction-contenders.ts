import { db } from "@workspace/db";
import { categoriesTable, playersTable, teamsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { getActiveBoosterTotalsForTeams } from "./purse-capacity";

export interface ComputeContendersParams {
  categoryId?: number | null;
  finalAmount: number;
}

/**
 * Inferred Contender Matrix (ICM)
 *
 * Counts teams in the tournament whose purseRemaining >= finalAmount
 * and who have open category slots for the player's category.
 * Returns Math.max(1, contenderCount) to guarantee at least 1.
 */
export async function computeInferredContenderCount(
  tournamentId: number,
  params: ComputeContendersParams,
): Promise<number> {
  try {
    const teams = await db
      .select({ id: teamsTable.id, purse: teamsTable.purse, purseUsed: teamsTable.purseUsed })
      .from(teamsTable)
      .where(eq(teamsTable.tournamentId, tournamentId));

    if (teams.length === 0) return 1;

    const boosterTotals = await getActiveBoosterTotalsForTeams(
      tournamentId,
      teams.map((t) => t.id),
    );

    let categoryMaxPlayers: number | null = null;
    if (params.categoryId) {
      const [cat] = await db
        .select({ maxPlayers: categoriesTable.maxPlayers })
        .from(categoriesTable)
        .where(eq(categoriesTable.id, params.categoryId));
      if (cat?.maxPlayers && cat.maxPlayers > 0) {
        categoryMaxPlayers = cat.maxPlayers;
      }
    }

    const categoryCountByTeam = new Map<number, number>();
    if (params.categoryId && categoryMaxPlayers !== null) {
      const catPlayers = await db
        .select({
          id: playersTable.id,
          teamId: playersTable.teamId,
          isNonPlayingMember: playersTable.isNonPlayingMember,
        })
        .from(playersTable)
        .where(
          and(
            eq(playersTable.tournamentId, tournamentId),
            eq(playersTable.categoryId, params.categoryId),
            inArray(playersTable.status, ["sold", "retained"]),
          ),
        );

      for (const p of catPlayers) {
        if (p.teamId && !p.isNonPlayingMember) {
          categoryCountByTeam.set(p.teamId, (categoryCountByTeam.get(p.teamId) ?? 0) + 1);
        }
      }
    }

    let contenderCount = 0;
    for (const team of teams) {
      const booster = boosterTotals.get(team.id) ?? 0;
      const purseRemaining = (team.purse ?? 0) + booster - (team.purseUsed ?? 0);
      const openCategorySlot =
        categoryMaxPlayers === null ||
        (categoryCountByTeam.get(team.id) ?? 0) < categoryMaxPlayers;

      if (purseRemaining >= params.finalAmount && openCategorySlot) {
        contenderCount++;
      }
    }

    return Math.max(1, contenderCount);
  } catch {
    return 1;
  }
}
