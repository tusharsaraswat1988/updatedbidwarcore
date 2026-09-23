/**
 * Tournament Product Modules — Source of Truth for product module enablement.
 *
 * Rules:
 * - A Tournament has independent, sibling product modules: Auction and Sports Scoring.
 * - Valid combinations:
 *     1. auctionEnabled=true, scoringEnabled=false  -> "auction_only"
 *     2. auctionEnabled=false, scoringEnabled=true  -> "scoring_only"
 *     3. auctionEnabled=true, scoringEnabled=true   -> "both"
 * - Invalid combination:
 *     auctionEnabled=false, scoringEnabled=false -> throws InvalidTournamentModuleStateError
 * - Combined product mode is strictly derived and NEVER stored in the database.
 * - Legacy fallback: undefined / null auctionEnabled resolves to true strictly for backward compatibility.
 */

export type TournamentProductMode = "auction_only" | "scoring_only" | "both";

export class InvalidTournamentModuleStateError extends Error {
  readonly code = "INVALID_MODULE_STATE";

  constructor(
    message = "A tournament must have at least one enabled product module (auction or scoring).",
  ) {
    super(message);
    this.name = "InvalidTournamentModuleStateError";
  }
}

export type TournamentModuleFlags = {
  auctionEnabled?: boolean | null;
  scoringEnabled?: boolean | null;
};

/**
 * Checks whether the module combination is valid (at least one module must be enabled).
 */
export function isValidTournamentModuleState(
  auctionEnabled: boolean,
  scoringEnabled: boolean,
): boolean {
  return auctionEnabled || scoringEnabled;
}

/**
 * Resolves the tournament's effective auctionEnabled flag.
 * Backward-compatibility fallback: missing/null values default to true.
 * Explicit false is strictly preserved.
 */
export function isAuctionEnabled(tournament: Pick<TournamentModuleFlags, "auctionEnabled"> | null | undefined): boolean {
  return tournament?.auctionEnabled ?? true;
}

/**
 * Resolves the tournament's effective scoringEnabled flag.
 * Default is false.
 */
export function isScoringEnabled(tournament: Pick<TournamentModuleFlags, "scoringEnabled"> | null | undefined): boolean {
  return tournament?.scoringEnabled ?? false;
}

/**
 * Resolves the derived TournamentProductMode from explicit or legacy module flags.
 * Throws InvalidTournamentModuleStateError if both modules are false.
 */
export function resolveTournamentProductMode(
  tournament: TournamentModuleFlags | null | undefined,
): TournamentProductMode {
  const auction = isAuctionEnabled(tournament);
  const scoring = isScoringEnabled(tournament);

  if (!auction && !scoring) {
    throw new InvalidTournamentModuleStateError();
  }

  if (auction && scoring) {
    return "both";
  }

  if (scoring) {
    return "scoring_only";
  }

  return "auction_only";
}

/**
 * Safe version of resolveTournamentProductMode that returns null instead of throwing on invalid state.
 */
export function tryResolveTournamentProductMode(
  tournament: TournamentModuleFlags | null | undefined,
): TournamentProductMode | null {
  try {
    return resolveTournamentProductMode(tournament);
  } catch (err) {
    if (err instanceof InvalidTournamentModuleStateError) {
      return null;
    }
    throw err;
  }
}

/**
 * Checks whether a sport is supported for live sports scoring.
 * Stabilized and supported for cricket and badminton only.
 */
export function isScoringSupportedSport(sport: string | null | undefined): boolean {
  const s = (sport || "").trim().toLowerCase();
  return s === "cricket" || s === "badminton";
}

