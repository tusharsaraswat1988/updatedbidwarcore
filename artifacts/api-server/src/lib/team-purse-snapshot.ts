import { resolveRetainedSpend } from "@workspace/api-base/retained-price";
import { db } from "@workspace/db";
import { playersTable, teamsTable, tournamentsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { computeAllTeamPurseProtections } from "./purse-protection";

function playerAcquisitionAmount(p: {
  status: string;
  soldPrice: number | null;
  retainedPrice: number | null;
  basePrice: number;
}): number {
  if (p.status === "retained") return resolveRetainedSpend(p);
  return p.soldPrice ?? 0;
}

export type TeamPurseSnapshot = {
  teamId: number;
  teamName: string;
  shortCode: string;
  color: string | null;
  logoUrl: string | null;
  originalPurse: number;
  boosterTotal: number;
  effectiveCapacity: number;
  purse: number;
  purseUsed: number;
  purseRemaining: number;
  playersBought: number;
  retainedCount: number;
  reservePurse: number;
  spendablePurse: number;
  slotsRequired: number;
  futurePlayersBought: number;
  futureSlotsRequired: number;
  futureReservePurse: number;
  maxAllowedBid: number;
  lowestBasePrice: number;
  minimumSquadSize: number;
  maximumSquadSize: number;
  topPlayerName: string | null;
  topPlayerAmount: number | null;
};

type TeamRow = typeof teamsTable.$inferSelect;
type RosterPlayerRow = typeof playersTable.$inferSelect;

export type BuildTeamPurseSnapshotOpts = {
  teams?: TeamRow[];
  rosterPlayers?: RosterPlayerRow[];
  tournamentRow?: {
    minimumSquadSize: number | null;
    maximumSquadSize?: number | null;
    minBid?: number | null;
  };
  /** When provided, skips the booster-totals DB query (sponsors step). */
  boosterTotals?: Map<number, number>;
};

/**
 * Build team purse rows for live displays. Uses sold/retained roster only —
 * available/unsold players do not affect purse math.
 */
export async function buildTeamPurseSnapshot(
  tournamentId: number,
  opts?: BuildTeamPurseSnapshotOpts,
): Promise<TeamPurseSnapshot[]> {
  const tournamentRow = opts?.tournamentRow ?? (await db
    .select({
      minimumSquadSize: tournamentsTable.minimumSquadSize,
      maximumSquadSize: tournamentsTable.maximumSquadSize,
      minBid: tournamentsTable.minBid,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .then(([t]) => t));

  const teams = opts?.teams ?? await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId))
    .orderBy(teamsTable.name);

  const rosterPlayers = opts?.rosterPlayers ?? await db
    .select()
    .from(playersTable)
    .where(
      and(
        eq(playersTable.tournamentId, tournamentId),
        inArray(playersTable.status, ["sold", "retained"]),
      ),
    );

  const protections = await computeAllTeamPurseProtections(
    tournamentId,
    teams.map((t) => ({ id: t.id, purse: t.purse, purseUsed: t.purseUsed })),
    rosterPlayers.map((p) => ({
      id: p.id,
      status: p.status,
      teamId: p.teamId,
      basePrice: p.basePrice,
      isNonPlayingMember: p.isNonPlayingMember ?? false,
    })),
    {
      minimumSquadSize: tournamentRow?.minimumSquadSize ?? 0,
      maximumSquadSize: tournamentRow?.maximumSquadSize ?? 0,
      minBid: tournamentRow?.minBid ?? 0,
    },
    opts?.boosterTotals,
  );

  return teams.map((team) => {
    const teamSoldRetained = rosterPlayers.filter((p) => p.teamId === team.id);
    const playersBought = teamSoldRetained.filter((p) => !p.isNonPlayingMember).length;
    const retainedCount = rosterPlayers.filter(
      (p) => p.teamId === team.id && p.status === "retained",
    ).length;

    const topPlayer = teamSoldRetained.reduce<(typeof rosterPlayers)[0] | null>(
      (best, p) => {
        const pAmt = playerAcquisitionAmount(p);
        const bAmt = best ? playerAcquisitionAmount(best) : -1;
        return pAmt > bAmt ? p : best;
      },
      null,
    );

    const p = protections.get(team.id);
    const originalPurse = p?.originalPurse ?? team.purse;
    const boosterTotal = p?.boosterTotal ?? 0;
    const effectiveCapacity = p?.effectiveCapacity ?? team.purse;
    const purseRemaining = p?.purseRemaining ?? (effectiveCapacity - team.purseUsed);

    return {
      teamId: team.id,
      teamName: team.name,
      shortCode: team.shortCode,
      color: team.color,
      logoUrl: team.logoUrl,
      originalPurse,
      boosterTotal,
      effectiveCapacity,
      purse: effectiveCapacity,
      purseUsed: team.purseUsed,
      purseRemaining,
      playersBought,
      retainedCount,
      reservePurse: p?.reservePurse ?? 0,
      spendablePurse: p?.spendablePurse ?? purseRemaining,
      slotsRequired: p?.slotsRequired ?? 0,
      futurePlayersBought: p?.futurePlayersBought ?? playersBought + 1,
      futureSlotsRequired: p?.futureSlotsRequired ?? 0,
      futureReservePurse: p?.futureReservePurse ?? 0,
      maxAllowedBid: p?.maxAllowedBid ?? purseRemaining,
      lowestBasePrice: p?.lowestBasePrice ?? 0,
      minimumSquadSize: tournamentRow?.minimumSquadSize ?? 0,
      maximumSquadSize: p?.maximumSquadSize ?? 0,
      topPlayerName: topPlayer?.name ?? null,
      topPlayerAmount: topPlayer ? playerAcquisitionAmount(topPlayer) || null : null,
    };
  });
}
