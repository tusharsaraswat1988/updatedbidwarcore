import { db } from "@workspace/db";
import { playersTable, teamsTable, tournamentsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { computeAllTeamPurseProtections } from "./purse-protection";

export type TeamPurseSnapshot = {
  teamId: number;
  teamName: string;
  shortCode: string;
  ownerName: string;
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
  lowestBasePrice: number;
  minimumSquadSize: number;
  maximumSquadSize: number;
  topPlayerName: string | null;
  topPlayerAmount: number | null;
};

/**
 * Build team purse rows for live displays. Uses sold/retained roster only —
 * available/unsold players do not affect purse math.
 */
export async function buildTeamPurseSnapshot(tournamentId: number): Promise<TeamPurseSnapshot[]> {
  const [tournamentRow] = await db
    .select({ minimumSquadSize: tournamentsTable.minimumSquadSize })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));

  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId))
    .orderBy(teamsTable.name);

  const rosterPlayers = await db
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
  );

  return teams.map((team) => {
    const teamSoldRetained = rosterPlayers.filter((p) => p.teamId === team.id);
    const playersBought = teamSoldRetained.filter((p) => !p.isNonPlayingMember).length;
    const retainedCount = rosterPlayers.filter(
      (p) => p.teamId === team.id && p.status === "retained",
    ).length;

    const topPlayer = teamSoldRetained.reduce<(typeof rosterPlayers)[0] | null>(
      (best, p) => {
        const pAmt = p.status === "retained" ? (p.retainedPrice ?? 0) : (p.soldPrice ?? 0);
        const bAmt = best
          ? (best.status === "retained" ? (best.retainedPrice ?? 0) : (best.soldPrice ?? 0))
          : -1;
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
      ownerName: team.ownerName,
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
      lowestBasePrice: p?.lowestBasePrice ?? 0,
      minimumSquadSize: tournamentRow?.minimumSquadSize ?? 0,
      maximumSquadSize: p?.maximumSquadSize ?? 0,
      topPlayerName: topPlayer?.name ?? null,
      topPlayerAmount: topPlayer
        ? (topPlayer.status === "retained" ? (topPlayer.retainedPrice ?? null) : (topPlayer.soldPrice ?? null))
        : null,
    };
  });
}
