import { describe, expect, it } from "vitest";
import {
  validateAuctionReadiness,
  parseBidTiers,
  getReadinessChecklistItems,
  DEFAULT_NEW_TOURNAMENT_BID_TIERS_JSON,
  type AuctionReadinessInput,
} from "@workspace/api-base/auction-readiness";

const readyBase: AuctionReadinessInput = {
  teamCount: 2,
  playerCount: 2,
  minBid: 10_000,
  timerSeconds: 10,
  bidTimerSeconds: 10,
  playerSelectionMode: "random",
  bidTiers: JSON.stringify([{ increment: 5_000 }]),
  minimumSquadSize: 11,
};

describe("parseBidTiers", () => {
  it("parses JSON bid tiers when present", () => {
    expect(parseBidTiers({ bidTiers: JSON.stringify([{ increment: 8_000 }]) })).toEqual([
      { upTo: undefined, increment: 8_000 },
    ]);
  });

  it("falls back to legacy tier columns when bidTiers is absent", () => {
    expect(
      parseBidTiers({
        bidTier1UpTo: 50_000,
        bidTier1Increment: 5_000,
        bidTier2UpTo: 100_000,
        bidTier2Increment: 10_000,
        bidTier3Increment: 20_000,
      }),
    ).toHaveLength(3);
  });
});

describe("validateAuctionReadiness — live", () => {
  it("passes when all live requirements are met", () => {
    expect(validateAuctionReadiness(readyBase, "live")).toEqual([]);
  });

  it("requires at least 2 players in live mode", () => {
    const issues = validateAuctionReadiness({ ...readyBase, playerCount: 1 }, "live");
    expect(issues.some((i) => i.id === "players")).toBe(true);
    expect(issues.find((i) => i.id === "players")?.message).toBe("Add at least 2 players");
  });

  it("flags blank default bid tiers on new tournaments", () => {
    const issues = validateAuctionReadiness(
      { ...readyBase, bidTiers: DEFAULT_NEW_TOURNAMENT_BID_TIERS_JSON },
      "live",
    );
    expect(issues.some((i) => i.id === "bidTiers")).toBe(true);
  });

  it("collects multiple missing items at once", () => {
    const issues = validateAuctionReadiness(
      {
        ...readyBase,
        teamCount: 1,
        playerCount: 0,
        minBid: 0,
        minimumSquadSize: 0,
        bidTiers: DEFAULT_NEW_TOURNAMENT_BID_TIERS_JSON,
      },
      "live",
    );
    expect(issues.length).toBeGreaterThanOrEqual(4);
  });
});

describe("validateAuctionReadiness — trial", () => {
  it("allows 1 player in trial mode", () => {
    expect(validateAuctionReadiness({ ...readyBase, playerCount: 1 }, "trial")).toEqual([]);
  });

  it("still requires 2 teams in trial mode", () => {
    const issues = validateAuctionReadiness({ ...readyBase, teamCount: 1, playerCount: 1 }, "trial");
    expect(issues.some((i) => i.id === "teams")).toBe(true);
  });
});

describe("getReadinessChecklistItems", () => {
  it("marks satisfied checks as done for informational hub display", () => {
    const items = getReadinessChecklistItems(readyBase, "live");
    expect(items.every((i) => i.done)).toBe(true);
  });

  it("marks failing checks as not done", () => {
    const items = getReadinessChecklistItems(
      { ...readyBase, minimumSquadSize: 0 },
      "live",
    );
    const minSquad = items.find((i) => i.id === "minSquad");
    expect(minSquad?.done).toBe(false);
    expect(items.some((i) => String(i.id) === "maxSquad")).toBe(false);
  });
});
