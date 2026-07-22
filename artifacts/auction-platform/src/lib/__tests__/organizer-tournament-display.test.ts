import { describe, expect, it } from "vitest";
import {
  getOrganizerAuctionStatusLabel,
  getOrganizerLicenseBadgeKind,
  isOrganizerTournamentActive,
  isOrganizerTournamentCompleted,
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
