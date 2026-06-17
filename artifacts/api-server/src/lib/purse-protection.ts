import { db } from "@workspace/db";
import { playersTable, teamsTable, tournamentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { computeEffectiveCapacity } from "@workspace/api-base/purse-capacity";
import { getActiveBoosterTotal, getActiveBoosterTotalsForTeams } from "./purse-capacity";

export interface PurseProtection {
  originalPurse: number;
  boosterTotal: number;
  effectiveCapacity: number;
  purseRemaining: number;
  reservePurse: number;
  spendablePurse: number;
  slotsRequired: number;
  lowestBasePrice: number;
  maximumSquadSize: number;
}

/**
 * Compute a team's spendable purse after reserving budget for unfilled
 * minimum-squad slots.
 *
 * Formula:
 *   slotsRequired  = max(0, minimumSquadSize - teamPlayerCount)
 *   reservePurse   = slotsRequired × tournament.minBid
 *   spendablePurse = max(0, purseRemaining - reservePurse)
 *
 * NOTE: The per-slot cost uses tournament.minBid (the absolute cheapest any
 * player can sell for), NOT individual player.basePrice. Using basePrice was
 * wrong — category base prices (e.g. ₹1L) would reserve the entire purse
 * even when the tournament minimum is ₹10k.
 */
export async function computeTeamPurseProtection(
  tournamentId: number,
  teamId: number,
  opts?: {
    allPlayers?: Array<{ id: number; status: string; teamId: number | null; basePrice: number; isNonPlayingMember?: boolean }>;
    minimumSquadSize?: number;
    maximumSquadSize?: number;
    minBid?: number;
    team?: { purse: number; purseUsed: number };
    boosterTotal?: number;
  }
): Promise<PurseProtection> {
  const needsTournamentRow =
    opts?.minimumSquadSize === undefined ||
    opts?.maximumSquadSize === undefined ||
    opts?.minBid === undefined;

  const tournamentRow = needsTournamentRow
    ? await db
        .select({
          minimumSquadSize: tournamentsTable.minimumSquadSize,
          maximumSquadSize: tournamentsTable.maximumSquadSize,
          minBid: tournamentsTable.minBid,
        })
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, tournamentId))
        .then(([t]) => t)
    : null;

  const minSquadSize = opts?.minimumSquadSize !== undefined
    ? opts.minimumSquadSize
    : (tournamentRow?.minimumSquadSize ?? 0);

  const maxSquadSize = opts?.maximumSquadSize !== undefined
    ? opts.maximumSquadSize
    : (tournamentRow?.maximumSquadSize ?? 0);

  // Per-slot reserve cost: use the tournament's minimum bid floor.
  // This is the absolute cheapest any player can be sold for, so it gives
  // teams the most room to bid while still protecting minimum-squad slots.
  // (Using individual player.basePrice was wrong — it reserved at category
  //  price e.g. ₹1L per slot, leaving spendable = ₹0 on a ₹10L purse.)
  const tournamentMinBid = opts?.minBid !== undefined
    ? opts.minBid
    : (tournamentRow?.minBid ?? 0);

  const teamRow =
    opts?.team ??
    (await db
      .select({ purse: teamsTable.purse, purseUsed: teamsTable.purseUsed })
      .from(teamsTable)
      .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tournamentId)))
      .then(([t]) => t));

  if (!teamRow) {
    return {
      originalPurse: 0,
      boosterTotal: 0,
      effectiveCapacity: 0,
      purseRemaining: 0,
      reservePurse: 0,
      spendablePurse: 0,
      slotsRequired: 0,
      lowestBasePrice: 0,
      maximumSquadSize: maxSquadSize,
    };
  }

  const boosterTotal =
    opts?.boosterTotal ??
    (await getActiveBoosterTotal(tournamentId, teamId));
  const originalPurse = teamRow.purse;
  const effectiveCapacity = computeEffectiveCapacity(originalPurse, boosterTotal);
  const purseRemaining = effectiveCapacity - teamRow.purseUsed;

  if (minSquadSize === 0) {
    return {
      originalPurse,
      boosterTotal,
      effectiveCapacity,
      purseRemaining,
      reservePurse: 0,
      spendablePurse: purseRemaining,
      slotsRequired: 0,
      lowestBasePrice: 0,
      maximumSquadSize: maxSquadSize,
    };
  }

  const allPlayers =
    opts?.allPlayers ??
    (await db
      .select({ id: playersTable.id, status: playersTable.status, teamId: playersTable.teamId, basePrice: playersTable.basePrice, isNonPlayingMember: playersTable.isNonPlayingMember })
      .from(playersTable)
      .where(eq(playersTable.tournamentId, tournamentId)));

  // Non-playing members are excluded from squad-slot counts
  const playerCount = allPlayers.filter(
    (p) => p.teamId === teamId && (p.status === "sold" || p.status === "retained") && !p.isNonPlayingMember
  ).length;

  const slotsRequired = Math.max(0, minSquadSize - playerCount);

  if (slotsRequired === 0) {
    return {
      originalPurse,
      boosterTotal,
      effectiveCapacity,
      purseRemaining,
      reservePurse: 0,
      spendablePurse: purseRemaining,
      slotsRequired: 0,
      lowestBasePrice: tournamentMinBid,
      maximumSquadSize: maxSquadSize,
    };
  }

  // Reserve slotsRequired × tournament.minBid — the cheapest possible cost per
  // unfilled slot.  Do NOT use player.basePrice here; category base prices are
  // often 10–100× higher than the tournament minimum and would wrongly reserve
  // the entire purse (e.g. 10 slots × ₹1L = ₹10L on a ₹10L purse → spendable ₹0).
  const reservePurse = slotsRequired * tournamentMinBid;
  const spendablePurse = Math.max(0, purseRemaining - reservePurse);

  return {
    originalPurse,
    boosterTotal,
    effectiveCapacity,
    purseRemaining,
    reservePurse,
    spendablePurse,
    slotsRequired,
    lowestBasePrice: tournamentMinBid,
    maximumSquadSize: maxSquadSize,
  };
}

/**
 * Batch version — fetches all shared data once and computes protection
 * for every team in a tournament. Use in endpoints that return data for
 * all teams at once (e.g. getTeamPurses).
 */
export async function computeAllTeamPurseProtections(
  tournamentId: number,
  teams: Array<{ id: number; purse: number; purseUsed: number }>,
  playersOverride?: Array<{ id: number; status: string; teamId: number | null; basePrice: number; isNonPlayingMember?: boolean }>,
): Promise<Map<number, PurseProtection>> {
  const [tournamentRow] = await db
    .select({
      minimumSquadSize: tournamentsTable.minimumSquadSize,
      maximumSquadSize: tournamentsTable.maximumSquadSize,
      minBid: tournamentsTable.minBid,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));

  const minimumSquadSize = tournamentRow?.minimumSquadSize ?? 0;
  const maximumSquadSize = tournamentRow?.maximumSquadSize ?? 0;
  const minBid = tournamentRow?.minBid ?? 0;

  const allPlayers =
    playersOverride ??
    (await db
      .select({ id: playersTable.id, status: playersTable.status, teamId: playersTable.teamId, basePrice: playersTable.basePrice, isNonPlayingMember: playersTable.isNonPlayingMember })
      .from(playersTable)
      .where(eq(playersTable.tournamentId, tournamentId)));

  const boosterTotals = await getActiveBoosterTotalsForTeams(
    tournamentId,
    teams.map((t) => t.id),
  );

  const result = new Map<number, PurseProtection>();
  for (const team of teams) {
    const protection = await computeTeamPurseProtection(tournamentId, team.id, {
      allPlayers,
      minimumSquadSize,
      maximumSquadSize,
      minBid,
      team,
      boosterTotal: boosterTotals.get(team.id) ?? 0,
    });
    result.set(team.id, protection);
  }
  return result;
}
