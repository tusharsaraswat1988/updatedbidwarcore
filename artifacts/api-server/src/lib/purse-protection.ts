import {
  computePurseProtection,
  type PurseProtectionResult,
} from "@workspace/api-base/purse-protection";
import { db } from "@workspace/db";
import { playersTable, teamsTable, tournamentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getActiveBoosterTotal, getActiveBoosterTotalsForTeams } from "./purse-capacity";

export type PurseProtection = PurseProtectionResult;

/**
 * Compute a team's purse protection with separate current (UI) and future
 * (bid validation) reserve states.
 *
 * Current state:
 *   slotsRequired  = max(0, minimumSquadSize - playersBought)
 *   reservePurse   = slotsRequired × tournament.minBid
 *   spendablePurse = max(0, purseRemaining - reservePurse)
 *
 * Future validation state (if this bid succeeds):
 *   futurePlayersBought = playersBought + 1
 *   futureSlotsRequired = max(0, minimumSquadSize - futurePlayersBought)
 *   futureReservePurse  = futureSlotsRequired × tournament.minBid
 *   maxAllowedBid       = max(0, purseRemaining - futureReservePurse)
 *
 * Bid validation MUST compare against maxAllowedBid, not spendablePurse.
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
      playersBought: 0,
      futurePlayersBought: 0,
      futureSlotsRequired: 0,
      futureReservePurse: 0,
      maxAllowedBid: 0,
    };
  }

  const boosterTotal =
    opts?.boosterTotal ??
    (await getActiveBoosterTotal(tournamentId, teamId));

  const allPlayers =
    opts?.allPlayers ??
    (await db
      .select({ id: playersTable.id, status: playersTable.status, teamId: playersTable.teamId, basePrice: playersTable.basePrice, isNonPlayingMember: playersTable.isNonPlayingMember })
      .from(playersTable)
      .where(eq(playersTable.tournamentId, tournamentId)));

  const playersBought = allPlayers.filter(
    (p) => p.teamId === teamId && (p.status === "sold" || p.status === "retained") && !p.isNonPlayingMember,
  ).length;

  return computePurseProtection({
    purse: teamRow.purse,
    purseUsed: teamRow.purseUsed,
    boosterTotal,
    playersBought,
    minimumSquadSize: minSquadSize,
    maximumSquadSize: maxSquadSize,
    minBid: tournamentMinBid,
  });
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
