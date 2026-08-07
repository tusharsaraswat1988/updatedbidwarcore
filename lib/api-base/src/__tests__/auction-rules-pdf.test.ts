import { describe, expect, it } from "vitest";
import {
  buildAuctionRulesPdfCategoryOverrides,
  buildAuctionRulesPdfDocumentModel,
  evaluateAuctionRulesPdfReady,
} from "../auction-rules-pdf";

const readyBase = {
  name: "City Premier League",
  city: "Pune",
  basePurse: 10_000_000,
  minBid: 100_000,
  timerSeconds: 10,
  bidTimerSeconds: 10,
  minimumSquadSize: 11,
  bidTiers: JSON.stringify([{ increment: 25_000 }]),
};

describe("evaluateAuctionRulesPdfReady", () => {
  it("is ready when core identity and auction fields are set", () => {
    expect(evaluateAuctionRulesPdfReady(readyBase)).toEqual({
      ready: true,
      blockedReason: null,
    });
  });

  it("blocks when bid tiers have no positive increment", () => {
    const result = evaluateAuctionRulesPdfReady({
      ...readyBase,
      bidTiers: JSON.stringify([{ increment: 0 }]),
    });
    expect(result.ready).toBe(false);
    expect(result.blockedReason).toMatch(/bid increment/i);
  });

  it("blocks when minimum squad size is missing", () => {
    const result = evaluateAuctionRulesPdfReady({
      ...readyBase,
      minimumSquadSize: 0,
    });
    expect(result.ready).toBe(false);
    expect(result.blockedReason).toMatch(/minimum players/i);
  });

  it("blocks when city is missing", () => {
    const result = evaluateAuctionRulesPdfReady({
      ...readyBase,
      city: "  ",
    });
    expect(result.ready).toBe(false);
    expect(result.blockedReason).toMatch(/city/i);
  });
});

describe("buildAuctionRulesPdfDocumentModel", () => {
  it("includes identity, rules, and category overrides", () => {
    const model = buildAuctionRulesPdfDocumentModel({
      name: "City Premier League",
      sport: "cricket",
      city: "Pune",
      venue: "MCA Stadium",
      auctionDate: "2026-08-20",
      auctionTime: "18:00",
      auctionUnit: "rupee",
      basePurse: 10_000_000,
      minBid: 100_000,
      bidValueMode: "system",
      timerSeconds: 15,
      bidTimerSeconds: 10,
      bidExtensionEnabled: true,
      bidExtensionThresholdSeconds: 3,
      bidExtensionSeconds: 5,
      playerSelectionMode: "random",
      minimumSquadSize: 11,
      maximumSquadSize: 15,
      categories: [
        { name: "Gold", minBid: 150_000, bidIncrement: 50_000, bidTiers: null },
        { name: "Silver", minBid: 100_000, bidIncrement: null, bidTiers: null },
      ],
      tournament: { bidTiers: JSON.stringify([{ increment: 25_000 }]) },
    });

    expect(model.tournamentName).toBe("City Premier League");
    expect(model.city).toBe("Pune");
    expect(model.bidIncrementLines.length).toBeGreaterThan(0);
    expect(model.maximumSquadSize).toBe(15);
    expect(model.bidExtensionEnabled).toBe(true);
    expect(model.categoryOverrides).toHaveLength(1);
    expect(model.categoryOverrides[0]?.name).toBe("Gold");
  });
});

describe("buildAuctionRulesPdfCategoryOverrides", () => {
  it("omits categories with no overrides", () => {
    expect(
      buildAuctionRulesPdfCategoryOverrides(100_000, "rupee", [
        { name: "Silver", minBid: 100_000, bidIncrement: null, bidTiers: null },
      ]),
    ).toEqual([]);
  });
});
