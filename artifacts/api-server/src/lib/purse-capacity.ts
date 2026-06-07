import { db } from "@workspace/db";
import { purseBoostersTable } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  assertCapacityNotBelowUsed,
  computeEffectiveCapacity,
} from "@workspace/api-base/purse-capacity";

export { computeEffectiveCapacity, computePurseRemaining, assertCapacityNotBelowUsed } from "@workspace/api-base/purse-capacity";

export async function getActiveBoosterTotal(
  tournamentId: number,
  teamId: number,
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${purseBoostersTable.amount}), 0)::int`,
    })
    .from(purseBoostersTable)
    .where(
      and(
        eq(purseBoostersTable.tournamentId, tournamentId),
        eq(purseBoostersTable.teamId, teamId),
        eq(purseBoostersTable.status, "active"),
      ),
    );
  return row?.total ?? 0;
}

export async function getActiveBoosterTotalsForTeams(
  tournamentId: number,
  teamIds: number[],
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (teamIds.length === 0) return result;

  const rows = await db
    .select({
      teamId: purseBoostersTable.teamId,
      total: sql<number>`coalesce(sum(${purseBoostersTable.amount}), 0)::int`,
    })
    .from(purseBoostersTable)
    .where(
      and(
        eq(purseBoostersTable.tournamentId, tournamentId),
        eq(purseBoostersTable.status, "active"),
        inArray(purseBoostersTable.teamId, teamIds),
      ),
    )
    .groupBy(purseBoostersTable.teamId);

  for (const id of teamIds) result.set(id, 0);
  for (const row of rows) result.set(row.teamId, row.total);
  return result;
}

export async function getEffectiveCapacityForTeam(
  tournamentId: number,
  teamId: number,
  originalPurse: number,
): Promise<number> {
  const boosterTotal = await getActiveBoosterTotal(tournamentId, teamId);
  return computeEffectiveCapacity(originalPurse, boosterTotal);
}

export async function validateCancelBooster(
  tournamentId: number,
  teamId: number,
  originalPurse: number,
  purseUsed: number,
  boosterAmount: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const currentBoosterTotal = await getActiveBoosterTotal(tournamentId, teamId);
  const newBoosterTotal = currentBoosterTotal - boosterAmount;
  const newCapacity = computeEffectiveCapacity(originalPurse, newBoosterTotal);
  return assertCapacityNotBelowUsed(newCapacity, purseUsed);
}
