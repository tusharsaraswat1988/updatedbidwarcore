import { describe, expect, it } from "vitest";
import {
  TRIAL_AUCTION_ELIGIBLE_TEAM_LIMIT,
  isAuctionLicenseActive,
  isTeamEligibleForTrialAuction,
} from "../auction-trial";

describe("auction-trial", () => {
  it("treats only active as licensed", () => {
    expect(isAuctionLicenseActive("active")).toBe(true);
    expect(isAuctionLicenseActive("trial")).toBe(false);
    expect(isAuctionLicenseActive("completed")).toBe(false);
    expect(isAuctionLicenseActive(null)).toBe(false);
  });

  it("allows any team when license is active", () => {
    expect(
      isTeamEligibleForTrialAuction(99, { licenseStatus: "active", trialTeamIds: [1, 2] }),
    ).toBe(true);
  });

  it("limits trial participation to trialTeamIds", () => {
    const opts = { licenseStatus: "trial" as const, trialTeamIds: [10, 20] };
    expect(isTeamEligibleForTrialAuction(10, opts)).toBe(true);
    expect(isTeamEligibleForTrialAuction(20, opts)).toBe(true);
    expect(isTeamEligibleForTrialAuction(30, opts)).toBe(false);
  });

  it("denies trial teams when trialTeamIds is empty", () => {
    expect(isTeamEligibleForTrialAuction(1, { licenseStatus: "trial", trialTeamIds: [] })).toBe(false);
  });

  it("allows UI while trialTeamIds is still loading (null)", () => {
    expect(isTeamEligibleForTrialAuction(1, { licenseStatus: "trial" })).toBe(true);
    expect(isTeamEligibleForTrialAuction(1, { licenseStatus: "trial", trialTeamIds: null })).toBe(true);
  });

  it("exports the two-team trial cap", () => {
    expect(TRIAL_AUCTION_ELIGIBLE_TEAM_LIMIT).toBe(2);
  });
});
