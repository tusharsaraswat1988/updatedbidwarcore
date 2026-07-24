/** Max teams that may bid / receive auction sales while license is trial. */
export const TRIAL_AUCTION_ELIGIBLE_TEAM_LIMIT = 2;

export const TRIAL_AUCTION_PARTICIPATION_ERROR =
  "Trial mode: only the first 2 teams can bid or receive players in the auction. Contact admin to activate your license for a full auction.";

/** Live licence unlocks full auction participation. */
export function isAuctionLicenseActive(licenseStatus: string | null | undefined): boolean {
  return licenseStatus === "active";
}

/**
 * Whether a team may bid or be sold-to during the auction.
 * Trial: only IDs in `trialTeamIds` (first N teams by id). Live: all teams.
 * When `trialTeamIds` is still null (state loading), UI treats the team as
 * eligible — the server gate remains authoritative.
 */
export function isTeamEligibleForTrialAuction(
  teamId: number,
  options: {
    licenseStatus?: string | null;
    trialTeamIds?: number[] | null;
  },
): boolean {
  if (isAuctionLicenseActive(options.licenseStatus)) return true;
  const ids = options.trialTeamIds;
  if (ids == null) return true;
  if (ids.length === 0) return false;
  return ids.includes(teamId);
}
