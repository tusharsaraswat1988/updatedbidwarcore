/**
 * Organizer dashboard display helpers.
 *
 * Tournament cards mix two independent fields:
 * - `status` — auction lifecycle (setup / active / paused / completed)
 * - `licenseStatus` — license entitlement (trial / active / completed)
 *
 * A licensed auction can finish (`status === "completed"`) while the license
 * remains `active` for post-auction features. The UI must not show "Live Ready"
 * in that case.
 */

export type OrganizerLicenseBadgeKind = "live-ready" | "auction-done" | "trial";

export function getOrganizerLicenseBadgeKind(
  licenseStatus: string,
  auctionStatus: string,
): OrganizerLicenseBadgeKind {
  if (auctionStatus === "completed" || licenseStatus === "completed") {
    return "auction-done";
  }
  if (licenseStatus === "active") {
    return "live-ready";
  }
  return "trial";
}

export function isOrganizerTournamentCompleted(t: {
  status: string;
  licenseStatus: string;
}): boolean {
  return t.status === "completed" || t.licenseStatus === "completed";
}

/** In-progress or upcoming auctions (not finished). */
export function isOrganizerTournamentActive(t: {
  status: string;
  licenseStatus: string;
}): boolean {
  return !isOrganizerTournamentCompleted(t);
}

export function getOrganizerAuctionStatusLabel(status: string): string {
  switch (status) {
    case "setup":
      return "Getting Ready";
    case "active":
      return "Auction Running";
    case "paused":
      return "Paused";
    case "completed":
      return "Completed";
    default:
      return status;
  }
}

/** Scoring CTA state for organizer dashboard module chooser. */
export type OrganizerScoringCtaState = "active" | "coming-soon";

const SCORING_SPORTS = new Set(["cricket", "badminton"]);

/**
 * Organizer-card scoring affordance.
 * Active ONLY when match scoring is enabled by admin for the tournament (scoringEnabled === true).
 * Otherwise "Coming Soon".
 */
export function resolveOrganizerScoringCta(input: {
  sport?: string | null;
  scoringEnabled: boolean | null | undefined;
  /** @deprecated Ignored — kept for call-site compatibility. */
  platformCricket?: boolean;
  /** @deprecated Ignored — kept for call-site compatibility. */
  platformBadminton?: boolean;
}): OrganizerScoringCtaState {
  if (input.scoringEnabled === true) return "active";
  return "coming-soon";
}
