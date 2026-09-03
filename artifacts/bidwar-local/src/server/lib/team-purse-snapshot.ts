import { eq } from "drizzle-orm";
import type { LocalDb } from "@workspace/db-local";
import { playersTable, teamsTable, tournamentsTable } from "@workspace/db-local";
import { getActiveBoosterTotalsForTeams } from "./purse-capacity.js";
import { computeScoutPurseProtection } from "./scout-purse.js";
import { resolveOfflineUrl } from "./offline-media.js";

export async function buildLocalTeamPurseSnapshot(db: LocalDb, tournamentId: number) {
  const [tournamentRow] = await db
    .select({
      minimumSquadSize: tournamentsTable.minimumSquadSize,
      maximumSquadSize: tournamentsTable.maximumSquadSize,
      minBid: tournamentsTable.minBid,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));

  const teams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, tournamentId));
  const players = await db.select().from(playersTable).where(eq(playersTable.tournamentId, tournamentId));
  const boosterTotals = await getActiveBoosterTotalsForTeams(db, tournamentId, teams.map((t) => t.id));

  const purseOpts = {
    minimumSquadSize: tournamentRow?.minimumSquadSize ?? 0,
    maximumSquadSize: tournamentRow?.maximumSquadSize ?? 0,
    minBid: tournamentRow?.minBid ?? 0,
  };

  return teams.map((t) => {
    const boosterTotal = boosterTotals.get(t.id) ?? 0;
    const p = computeScoutPurseProtection(t, boosterTotal, players, t.id, purseOpts);
    const teamSoldRetained = players.filter(
      (pRow) => pRow.teamId === t.id && (pRow.status === "sold" || pRow.status === "retained"),
    );
    const retainedCount = players.filter((pl) => pl.teamId === t.id && pl.status === "retained").length;
    const topPlayer = teamSoldRetained.reduce<(typeof teamSoldRetained)[0] | null>((best, pl) => {
      const pAmt = pl.status === "retained" ? (pl.retainedPrice ?? 0) : (pl.soldPrice ?? 0);
      const bAmt = best
        ? (best.status === "retained" ? (best.retainedPrice ?? 0) : (best.soldPrice ?? 0))
        : -1;
      return pAmt > bAmt ? pl : best;
    }, null);

    return {
      teamId: t.id,
      teamName: t.name,
      shortCode: t.shortCode,
      ownerName: t.ownerName,
      color: t.color,
      logoUrl: resolveOfflineUrl(t.logoUrl),
      originalPurse: t.purse,
      boosterTotal,
      effectiveCapacity: p.effectiveCapacity,
      purse: p.effectiveCapacity,
      purseUsed: t.purseUsed,
      purseRemaining: p.purseRemaining,
      playersBought: p.playersBought,
      retainedCount,
      reservePurse: p.reservePurse,
      spendablePurse: p.spendablePurse,
      slotsRequired: p.slotsRequired,
      futurePlayersBought: p.futurePlayersBought,
      futureSlotsRequired: p.futureSlotsRequired,
      futureReservePurse: p.futureReservePurse,
      maxAllowedBid: p.maxAllowedBid,
      lowestBasePrice: p.lowestBasePrice,
      minimumSquadSize: tournamentRow?.minimumSquadSize ?? 0,
      maximumSquadSize: tournamentRow?.maximumSquadSize ?? 0,
      topPlayerName: topPlayer?.name ?? null,
      topPlayerAmount: topPlayer
        ? (topPlayer.status === "retained" ? (topPlayer.retainedPrice ?? null) : (topPlayer.soldPrice ?? null))
        : null,
    };
  });
}
