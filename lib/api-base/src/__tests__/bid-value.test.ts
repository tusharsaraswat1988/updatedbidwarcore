import { describe, expect, it } from "vitest";
import {
  parseBidValueOptions,
  resolvePlayerBidFields,
  serializeBidValueOptions,
  bidValueSourceLabel,
  canEditPlayerBidValue,
} from "../bid-value.ts";

describe("parseBidValueOptions", () => {
  it("parses JSON array of integers", () => {
    expect(parseBidValueOptions("[3000,500,1500,1000]")).toEqual([500, 1000, 1500, 3000]);
  });

  it("returns empty for invalid input", () => {
    expect(parseBidValueOptions(null)).toEqual([]);
    expect(parseBidValueOptions("not-json")).toEqual([]);
    expect(parseBidValueOptions("{}")).toEqual([]);
  });
});

describe("resolvePlayerBidFields", () => {
  const systemTournament = { bidValueMode: "system", minBid: 100000, bidValueOptions: null };
  const playerTournament = {
    bidValueMode: "player",
    minBid: 100000,
    bidValueOptions: serializeBidValueOptions([500, 1000, 1500]),
  };

  it("uses tournament minBid in system mode when basePrice omitted", () => {
    const result = resolvePlayerBidFields(systemTournament, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields.basePrice).toBe(100000);
      expect(result.fields.selectedBidValue).toBeNull();
      expect(result.fields.bidValueSource).toBe("system");
    }
  });

  it("preserves explicit basePrice in system mode", () => {
    const result = resolvePlayerBidFields(systemTournament, { basePrice: 250000 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields.basePrice).toBe(250000);
    }
  });

  it("requires allowed selected value in player mode", () => {
    const missing = resolvePlayerBidFields(playerTournament, {});
    expect(missing.ok).toBe(false);

    const invalid = resolvePlayerBidFields(playerTournament, { selectedBidValue: 2000 });
    expect(invalid.ok).toBe(false);

    const valid = resolvePlayerBidFields(playerTournament, { selectedBidValue: 1500 });
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.fields.basePrice).toBe(1500);
      expect(valid.fields.selectedBidValue).toBe(1500);
      expect(valid.fields.bidValueSource).toBe("player");
    }
  });

  it("defaults to system mode when bidValueMode is null", () => {
    const result = resolvePlayerBidFields({ bidValueMode: null, minBid: 50000, bidValueOptions: null }, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields.basePrice).toBe(50000);
    }
  });
});

describe("bidValueSourceLabel", () => {
  it("labels sources for display", () => {
    expect(bidValueSourceLabel("player")).toBe("Player Selected");
    expect(bidValueSourceLabel("system")).toBe("System Assigned");
    expect(bidValueSourceLabel(null)).toBe("System Assigned");
  });
});

describe("canEditPlayerBidValue", () => {
  it("allows edits only during setup", () => {
    expect(canEditPlayerBidValue("setup")).toBe(true);
    expect(canEditPlayerBidValue("active")).toBe(false);
    expect(canEditPlayerBidValue("completed")).toBe(false);
  });
});

describe("serializeBidValueOptions", () => {
  it("deduplicates and sorts values", () => {
    expect(JSON.parse(serializeBidValueOptions([3000, 500, 500, 1000]))).toEqual([500, 1000, 3000]);
  });
});
