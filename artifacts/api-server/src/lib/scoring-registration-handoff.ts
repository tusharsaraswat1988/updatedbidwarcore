import { syncAuctionPlayerToMaster } from "./master-sports/sync";
import { ensureBadmintonPlayerFromMaster } from "./master-sports/badminton";
import {
  adaptScoringPlayerToBadmintonRegistration,
  type BadmintonScoringRegistrationOutcome,
} from "./master-sports/badminton-scoring-registration";

export class ScoringHandoffError extends Error {
  readonly code = "SCORING_HANDOFF_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "ScoringHandoffError";
  }
}

export type ScoringRegistrationHandoffResult = {
  masterPlayerId: string;
  badmintonPlayerId?: number;
  badmintonRegistration?: BadmintonScoringRegistrationOutcome;
};

function isBadmintonSport(sport: string | null | undefined): boolean {
  return (sport ?? "").trim().toLowerCase() === "badminton";
}

/**
 * After scoring-mode public registration, sync the same canonical player into
 * the sport scoring plane. Required steps must succeed before HTTP 201/200.
 * Cricket PTA is written later when a team is assigned.
 */
export async function afterScoringPlayerRegistered(
  playerId: number,
  tournamentId: number,
  sport: string | null | undefined,
): Promise<ScoringRegistrationHandoffResult> {
  const syncResult = await syncAuctionPlayerToMaster(playerId, tournamentId);
  if (!syncResult?.masterPlayerId) {
    throw new ScoringHandoffError(
      "Could not sync the player identity for scoring. Please try again.",
    );
  }

  if (!isBadmintonSport(sport)) {
    return { masterPlayerId: syncResult.masterPlayerId };
  }

  const badmintonPlayer = await ensureBadmintonPlayerFromMaster(
    tournamentId,
    syncResult.masterPlayerId,
  );
  if (!badmintonPlayer?.id) {
    throw new ScoringHandoffError("Could not create the badminton scoring player.");
  }

  const badmintonRegistration = await adaptScoringPlayerToBadmintonRegistration({
    tournamentId,
    canonicalPlayerId: playerId,
    badmintonPlayer,
  });

  return {
    masterPlayerId: syncResult.masterPlayerId,
    badmintonPlayerId: badmintonPlayer.id,
    badmintonRegistration,
  };
}

/** Non-critical callers only. Scoring registration must await `afterScoringPlayerRegistered`. */
export function afterScoringPlayerRegisteredAsync(
  playerId: number,
  tournamentId: number,
  sport: string | null | undefined,
): void {
  void afterScoringPlayerRegistered(playerId, tournamentId, sport).catch((err) => {
    console.error("[scoring-registration] handoff failed:", err);
  });
}
