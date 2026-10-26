import { describe, expect, it } from "vitest";
import {
  auctionOverviewPath,
  resolveScoringEntryPath,
  resolveTournamentOrganizerLandingPath,
  returnPathBackLabel,
} from "../tournament-navigation";

describe("resolveTournamentOrganizerLandingPath", () => {
  const TID = 7;

  it("prefers Auction Overview when auction is enabled", () => {
    expect(
      resolveTournamentOrganizerLandingPath(TID, {
        auctionEnabled: true,
        scoringEnabled: true,
        sport: "cricket",
      }),
    ).toBe(auctionOverviewPath(TID));
  });

  it("routes scoring-only tournaments to sport entry paths", () => {
    expect(
      resolveTournamentOrganizerLandingPath(TID, {
        auctionEnabled: false,
        scoringEnabled: true,
        sport: "cricket",
      }),
    ).toBe(resolveScoringEntryPath(TID, "cricket"));
    expect(
      resolveTournamentOrganizerLandingPath(TID, {
        auctionEnabled: false,
        scoringEnabled: true,
        sport: "badminton",
      }),
    ).toBe(resolveScoringEntryPath(TID, "badminton"));
  });

  it("falls back to settings when no modules are enabled", () => {
    expect(
      resolveTournamentOrganizerLandingPath(TID, {
        auctionEnabled: false,
        scoringEnabled: false,
      }),
    ).toBe(`/tournament/${TID}/settings`);
  });
});

describe("returnPathBackLabel — legacy tournament root", () => {
  it("labels /tournament/:id as Auction Overview (compatibility redirect target)", () => {
    expect(returnPathBackLabel("/tournament/99")).toBe("Back to Auction Overview");
  });
});
