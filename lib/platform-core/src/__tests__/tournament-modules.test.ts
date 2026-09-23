import { describe, it, expect } from "vitest";
import {
  resolveTournamentProductMode,
  tryResolveTournamentProductMode,
  isAuctionEnabled,
  isScoringEnabled,
  isValidTournamentModuleState,
  InvalidTournamentModuleStateError,
} from "../tournament-modules";

describe("Tournament Product Module Resolution", () => {
  it("resolves auction_only when auctionEnabled=true and scoringEnabled=false", () => {
    const mode = resolveTournamentProductMode({
      auctionEnabled: true,
      scoringEnabled: false,
    });
    expect(mode).toBe("auction_only");
  });

  it("resolves scoring_only when auctionEnabled=false and scoringEnabled=true", () => {
    const mode = resolveTournamentProductMode({
      auctionEnabled: false,
      scoringEnabled: true,
    });
    expect(mode).toBe("scoring_only");
  });

  it("resolves both when auctionEnabled=true and scoringEnabled=true", () => {
    const mode = resolveTournamentProductMode({
      auctionEnabled: true,
      scoringEnabled: true,
    });
    expect(mode).toBe("both");
  });

  it("applies legacy fallback (auctionEnabled defaults to true) when auctionEnabled is undefined", () => {
    // Legacy scoring-disabled tournament
    expect(
      resolveTournamentProductMode({
        scoringEnabled: false,
      }),
    ).toBe("auction_only");

    // Legacy scoring-enabled tournament (both enabled due to legacy auction assumption)
    expect(
      resolveTournamentProductMode({
        scoringEnabled: true,
      }),
    ).toBe("both");
  });

  it("applies legacy fallback when auctionEnabled is null", () => {
    expect(
      resolveTournamentProductMode({
        auctionEnabled: null,
        scoringEnabled: false,
      }),
    ).toBe("auction_only");

    expect(
      resolveTournamentProductMode({
        auctionEnabled: null,
        scoringEnabled: true,
      }),
    ).toBe("both");
  });

  it("strictly preserves explicit false and throws InvalidTournamentModuleStateError when both modules are false", () => {
    expect(() =>
      resolveTournamentProductMode({
        auctionEnabled: false,
        scoringEnabled: false,
      }),
    ).toThrow(InvalidTournamentModuleStateError);

    try {
      resolveTournamentProductMode({
        auctionEnabled: false,
        scoringEnabled: false,
      });
    } catch (err) {
      expect((err as InvalidTournamentModuleStateError).code).toBe("INVALID_MODULE_STATE");
    }
  });

  it("tryResolveTournamentProductMode returns null on invalid state", () => {
    expect(
      tryResolveTournamentProductMode({
        auctionEnabled: false,
        scoringEnabled: false,
      }),
    ).toBeNull();

    expect(
      tryResolveTournamentProductMode({
        auctionEnabled: false,
        scoringEnabled: true,
      }),
    ).toBe("scoring_only");
  });

  it("correctly identifies valid and invalid module state combinations", () => {
    expect(isValidTournamentModuleState(true, false)).toBe(true);
    expect(isValidTournamentModuleState(false, true)).toBe(true);
    expect(isValidTournamentModuleState(true, true)).toBe(true);
    expect(isValidTournamentModuleState(false, false)).toBe(false);
  });

  it("helper functions check module enablement accurately", () => {
    expect(isAuctionEnabled({ auctionEnabled: true })).toBe(true);
    expect(isAuctionEnabled({ auctionEnabled: false })).toBe(false);
    expect(isAuctionEnabled({})).toBe(true); // legacy fallback
    expect(isAuctionEnabled(null)).toBe(true); // legacy fallback

    expect(isScoringEnabled({ scoringEnabled: true })).toBe(true);
    expect(isScoringEnabled({ scoringEnabled: false })).toBe(false);
    expect(isScoringEnabled({})).toBe(false);
    expect(isScoringEnabled(null)).toBe(false);
  });
});
