import { describe, expect, it } from "vitest";
import {
  buildAuctionRulesPdfCategoryOverrides,
  buildAuctionRulesPdfDocumentModel,
  evaluateAuctionRulesPdfReady,
  formatAuctionDateForPdf,
  formatAuctionTimeForPdf,
  formatSportLabel,
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
  it("includes identity, exact increment rules, and category overrides", () => {
    const model = buildAuctionRulesPdfDocumentModel({
      name: "City Premier League",
      sport: "cricket",
      organizerName: "Asha Patil",
      city: "Pune",
      venue: "MCA Stadium",
      auctionDate: "2026-08-20",
      auctionTime: "18:00",
      auctionUnit: "rupee",
      basePurse: 10_000_000,
      minBid: 100_000,
      bidValueMode: "player",
      bidValueOptions: JSON.stringify([50_000, 100_000, 200_000]),
      timerSeconds: 15,
      bidTimerSeconds: 10,
      bidExtensionEnabled: true,
      bidExtensionThresholdSeconds: 3,
      bidExtensionSeconds: 5,
      playerSelectionMode: "random",
      minimumSquadSize: 11,
      maximumSquadSize: 15,
      categories: [
        { name: "Gold", minBid: 150_000, bidIncrement: 50_000, bidTiers: null, maxPlayers: 3 },
        { name: "Silver", minBid: 100_000, bidIncrement: null, bidTiers: null, maxPlayers: 4 },
      ],
      tournament: { bidTiers: JSON.stringify([{ increment: 25_000 }]) },
    });

    expect(model.tournamentName).toBe("City Premier League");
    expect(model.sport).toBe("Cricket");
    expect(model.organizerName).toBe("Asha Patil");
    expect(model.city).toBe("Pune");
    expect(model.auctionDate).toBe("20 Aug 2026");
    expect(model.auctionTime).toBe("6:00 PM");
    expect(model.basePurseLabel).toBe("Rs. 1,00,00,000");
    expect(model.minBidLabel).toBe("Rs. 1,00,000");
    expect(model.auctionUnitLabel).toBe("Rupee (Rs.)");
    expect(model.bidIncrementLines).toEqual(["Each raise must be exactly Rs. 25,000."]);
    expect(model.openingBidNote).toMatch(/exactly/i);
    expect(model.playersChooseBaseValue).toBe(true);
    expect(model.allowedBaseValuesLabel).toBe("Rs. 50,000, Rs. 1,00,000, Rs. 2,00,000");
    expect(model.maximumSquadSize).toBe(15);
    expect(model.squadReserveNote).toMatch(/reserves Rs\. 1,00,000/);
    expect(model.bidExtensionEnabled).toBe(true);
    expect(model.categoryOverrides).toHaveLength(2);
    expect(model.categoryOverrides[0]?.name).toBe("Gold");
    expect(model.categoryOverrides[0]?.lines).toEqual([
      "Minimum player value: Rs. 1,50,000",
      "Each raise must be exactly Rs. 50,000.",
      "Maximum players per team: 3",
    ]);
    expect(model.categoryOverrides[1]?.lines).toEqual(["Maximum players per team: 4"]);
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

describe("pdf display helpers", () => {
  it("title-cases sport and formats schedule", () => {
    expect(formatSportLabel("CRICKET")).toBe("Cricket");
    expect(formatAuctionDateForPdf("2026-08-20")).toBe("20 Aug 2026");
    expect(formatAuctionTimeForPdf("18:00")).toBe("6:00 PM");
    expect(formatAuctionTimeForPdf("09:05")).toBe("9:05 AM");
  });
});
