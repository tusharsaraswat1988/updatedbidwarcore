import {
  computePurseProtection,
  type PurseProtectionResult,
} from "@workspace/api-base/purse-protection";

type PlayerRow = {
  status: string;
  teamId: number | null;
  isNonPlayingMember?: boolean;
};

export type ScoutPurseProtection = PurseProtectionResult;

export function computeScoutPurseProtection(
  team: { purse: number; purseUsed: number },
  boosterTotal: number,
  allPlayers: PlayerRow[],
  teamId: number,
  opts: { minimumSquadSize: number; maximumSquadSize: number; minBid: number },
): ScoutPurseProtection {
  const playersBought = allPlayers.filter(
    (p) =>
      p.teamId === teamId
      && (p.status === "sold" || p.status === "retained")
      && !p.isNonPlayingMember,
  ).length;

  return computePurseProtection({
    purse: team.purse,
    purseUsed: team.purseUsed,
    boosterTotal,
    playersBought,
    minimumSquadSize: opts.minimumSquadSize,
    maximumSquadSize: opts.maximumSquadSize,
    minBid: opts.minBid,
  });
}
