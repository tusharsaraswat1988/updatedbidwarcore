import { db } from "@workspace/db";
import { playersTable, teamsTable, tournamentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export interface PurseProtection {
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
 *   slotsRequired = max(0, minimumSquadSize - teamPlayerCount)
 *   reservePurse  = slotsRequired × lowestAvailableBasePrice
 *   spendablePurse = max(0, purseRemaining - reservePurse)
 */
export async function computeTeamPurseProtection(
  tournamentId: number,
  teamId: number,
  opts?: {
    allPlayers?: Array<{ id: number; status: string; teamId: number | null; basePrice: number }>;
    minimumSquadSize?: number;
    maximumSquadSize?: number;
    team?: { purse: number; purseUsed: number };
  }
): Promise<PurseProtection> {
  const tournamentRow = (opts?.minimumSquadSize === undefined || opts?.maximumSquadSize === undefined)
    ? await db
        .select({ minimumSquadSize: tournamentsTable.minimumSquadSize, maximumSquadSize: tournamentsTable.maximumSquadSize })
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

  const teamRow =
    opts?.team ??
    (await db
      .select({ purse: teamsTable.purse, purseUsed: teamsTable.purseUsed })
      .from(teamsTable)
      .where(eq(teamsTable.id, teamId))
      .then(([t]) => t));

  if (!teamRow) {
    return { purseRemaining: 0, reservePurse: 0, spendablePurse: 0, slotsRequired: 0, lowestBasePrice: 0, maximumSquadSize: maxSquadSize };
  }

  const purseRemaining = teamRow.purse - teamRow.purseUsed;

  if (minSquadSize === 0) {
    return { purseRemaining, reservePurse: 0, spendablePurse: purseRemaining, slotsRequired: 0, lowestBasePrice: 0, maximumSquadSize: maxSquadSize };
  }

  const allPlayers =
    opts?.allPlayers ??
    (await db
      .select({ id: playersTable.id, status: playersTable.status, teamId: playersTable.teamId, basePrice: playersTable.basePrice })
      .from(playersTable)
      .where(eq(playersTable.tournamentId, tournamentId)));

  const playerCount = allPlayers.filter(
    (p) => p.teamId === teamId && (p.status === "sold" || p.status === "retained")
  ).length;

  const slotsRequired = Math.max(0, minSquadSize - playerCount);

  if (slotsRequired === 0) {
    return { purseRemaining, reservePurse: 0, spendablePurse: purseRemaining, slotsRequired: 0, lowestBasePrice: 0, maximumSquadSize: maxSquadSize };
  }

  const availablePrices = allPlayers
    .filter((p) => p.status === "available")
    .map((p) => p.basePrice);

  const lowestBasePrice = availablePrices.length > 0 ? Math.min(...availablePrices) : 0;
  const reservePurse = slotsRequired * lowestBasePrice;
  const spendablePurse = Math.max(0, purseRemaining - reservePurse);

  return { purseRemaining, reservePurse, spendablePurse, slotsRequired, lowestBasePrice, maximumSquadSize: maxSquadSize };
}

/**
 * Batch version — fetches all shared data once and computes protection
 * for every team in a tournament. Use in endpoints that return data for
 * all teams at once (e.g. getTeamPurses).
 */
export async function computeAllTeamPurseProtections(
  tournamentId: number,
  teams: Array<{ id: number; purse: number; purseUsed: number }>
): Promise<Map<number, PurseProtection>> {
  const [tournamentRow] = await db
    .select({ minimumSquadSize: tournamentsTable.minimumSquadSize, maximumSquadSize: tournamentsTable.maximumSquadSize })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));

  const minimumSquadSize = tournamentRow?.minimumSquadSize ?? 0;
  const maximumSquadSize = tournamentRow?.maximumSquadSize ?? 0;

  const allPlayers = await db
    .select({ id: playersTable.id, status: playersTable.status, teamId: playersTable.teamId, basePrice: playersTable.basePrice })
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tournamentId));

  const result = new Map<number, PurseProtection>();
  for (const team of teams) {
    const protection = await computeTeamPurseProtection(tournamentId, team.id, {
      allPlayers,
      minimumSquadSize,
      maximumSquadSize,
      team,
    });
    result.set(team.id, protection);
  }
  return result;
}
