import { describe, expect, it } from "vitest";
import {
  getOrganizerAuctionStatusLabel,
  getOrganizerLicenseBadgeKind,
  isOrganizerTournamentActive,
  isOrganizerTournamentCompleted,
  resolveOrganizerAuctionCta,
  resolveOrganizerScoringCta,
} from "../organizer-tournament-display";

describe("getOrganizerLicenseBadgeKind", () => {
  it("never shows Live Ready when the auction is completed", () => {
    expect(getOrganizerLicenseBadgeKind("active", "completed")).toBe("auction-done");
    expect(getOrganizerLicenseBadgeKind("trial", "completed")).toBe("auction-done");
  });

  it("shows Auction Done when license is completed", () => {
    expect(getOrganizerLicenseBadgeKind("completed", "setup")).toBe("auction-done");
    expect(getOrganizerLicenseBadgeKind("completed", "completed")).toBe("auction-done");
  });

  it("shows Live Ready only for an active license before auction completion", () => {
    expect(getOrganizerLicenseBadgeKind("active", "setup")).toBe("live-ready");
    expect(getOrganizerLicenseBadgeKind("active", "active")).toBe("live-ready");
    expect(getOrganizerLicenseBadgeKind("active", "paused")).toBe("live-ready");
  });

  it("falls back to trial for non-active licenses", () => {
    expect(getOrganizerLicenseBadgeKind("trial", "setup")).toBe("trial");
    expect(getOrganizerLicenseBadgeKind("trial", "active")).toBe("trial");
  });
});

describe("organizer tournament active/completed counts", () => {
  it("treats completed auction status as completed even with active license", () => {
    const t = { status: "completed", licenseStatus: "active" };
    expect(isOrganizerTournamentCompleted(t)).toBe(true);
    expect(isOrganizerTournamentActive(t)).toBe(false);
  });

  it("counts setup/active/paused as active when not completed", () => {
    expect(isOrganizerTournamentActive({ status: "setup", licenseStatus: "trial" })).toBe(true);
    expect(isOrganizerTournamentActive({ status: "active", licenseStatus: "active" })).toBe(true);
    expect(isOrganizerTournamentActive({ status: "paused", licenseStatus: "active" })).toBe(true);
  });

  it("treats license completed as completed", () => {
    const t = { status: "setup", licenseStatus: "completed" };
    expect(isOrganizerTournamentCompleted(t)).toBe(true);
    expect(isOrganizerTournamentActive(t)).toBe(false);
  });
});

describe("getOrganizerAuctionStatusLabel", () => {
  it("maps lifecycle statuses to readable labels", () => {
    expect(getOrganizerAuctionStatusLabel("setup")).toBe("Getting Ready");
    expect(getOrganizerAuctionStatusLabel("active")).toBe("Auction Running");
    expect(getOrganizerAuctionStatusLabel("paused")).toBe("Paused");
    expect(getOrganizerAuctionStatusLabel("completed")).toBe("Completed");
  });
});

describe("resolveOrganizerAuctionCta", () => {
  it("is active when auction was selected, including legacy tournaments that omit the flag", () => {
    expect(resolveOrganizerAuctionCta({ auctionEnabled: true })).toBe("active");
    expect(resolveOrganizerAuctionCta({ auctionEnabled: undefined })).toBe("active");
    expect(resolveOrganizerAuctionCta({})).toBe("active");
  });

  it("is not selected when the organizer did not take auction", () => {
    expect(resolveOrganizerAuctionCta({ auctionEnabled: false })).toBe("not-selected");
  });
});

describe("resolveOrganizerScoringCta", () => {
  it("follows the scoring option for cricket and badminton", () => {
    expect(
      resolveOrganizerScoringCta({
        sport: "cricket",
        scoringEnabled: true,
      }),
    ).toBe("active");
    expect(
      resolveOrganizerScoringCta({
        sport: "Badminton",
        scoringEnabled: true,
      }),
    ).toBe("active");
    expect(
      resolveOrganizerScoringCta({
        sport: "cricket",
        scoringEnabled: false,
      }),
    ).toBe("not-selected");
    expect(
      resolveOrganizerScoringCta({
        sport: "cricket",
        scoringEnabled: undefined,
      }),
    ).toBe("not-selected");
    expect(
      resolveOrganizerScoringCta({
        sport: "badminton",
        scoringEnabled: null,
      }),
    ).toBe("not-selected");
  });

  it("keeps Coming Soon for sports whose scoring is not live", () => {
    expect(
      resolveOrganizerScoringCta({
        sport: "football",
        scoringEnabled: true,
      }),
    ).toBe("coming-soon");
    expect(
      resolveOrganizerScoringCta({
        sport: "kabaddi",
        scoringEnabled: false,
      }),
    ).toBe("coming-soon");
  });
});
