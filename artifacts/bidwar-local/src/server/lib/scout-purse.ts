import { computeEffectiveCapacity } from "@workspace/api-base/purse-capacity";

type PlayerRow = {
  status: string;
  teamId: number | null;
};

export type ScoutPurseProtection = {
  originalPurse: number;
  boosterTotal: number;
  effectiveCapacity: number;
  purseRemaining: number;
  reservePurse: number;
  spendablePurse: number;
  slotsRequired: number;
  lowestBasePrice: number;
  maximumSquadSize: number;
};

export function computeScoutPurseProtection(
  team: { purse: number; purseUsed: number },
  boosterTotal: number,
  allPlayers: PlayerRow[],
  teamId: number,
  opts: { minimumSquadSize: number; maximumSquadSize: number; minBid: number },
): ScoutPurseProtection {
  const originalPurse = team.purse;
  const effectiveCapacity = computeEffectiveCapacity(originalPurse, boosterTotal);
  const purseRemaining = effectiveCapacity - team.purseUsed;
  const { minimumSquadSize: minSquadSize, maximumSquadSize: maxSquadSize, minBid } = opts;

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

  const playerCount = allPlayers.filter(
    (p) => p.teamId === teamId && (p.status === "sold" || p.status === "retained"),
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
      lowestBasePrice: minBid,
      maximumSquadSize: maxSquadSize,
    };
  }

  const reservePurse = slotsRequired * minBid;
  const spendablePurse = Math.max(0, purseRemaining - reservePurse);

  return {
    originalPurse,
    boosterTotal,
    effectiveCapacity,
    purseRemaining,
    reservePurse,
    spendablePurse,
    slotsRequired,
    lowestBasePrice: minBid,
    maximumSquadSize: maxSquadSize,
  };
}
