import { describe, expect, it } from "vitest";
import {
  parseBidValueOptions,
  resolvePlayerBidFields,
  serializeBidValueOptions,
  bidValueSourceLabel,
  canEditPlayerBidValue,
} from "@workspace/api-base/bid-value";

describe("bid-value", () => {
  it("parses and serializes organizer options", () => {
    expect(parseBidValueOptions("[3000,500,1500]")).toEqual([500, 1500, 3000]);
    expect(JSON.parse(serializeBidValueOptions([3000, 500, 500]))).toEqual([500, 3000]);
  });

  it("keeps system mode behavior unchanged", () => {
    const result = resolvePlayerBidFields(
      { bidValueMode: "system", minBid: 100000, bidValueOptions: null },
      {},
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields.basePrice).toBe(100000);
      expect(result.fields.bidValueSource).toBe("system");
    }
  });

  it("uses player selection as the only input change in player mode", () => {
    const options = serializeBidValueOptions([500, 1000, 1500]);
    const valid = resolvePlayerBidFields(
      { bidValueMode: "player", minBid: 100000, bidValueOptions: options },
      { selectedBidValue: 1500 },
    );
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.fields.basePrice).toBe(1500);
      expect(valid.fields.selectedBidValue).toBe(1500);
      expect(valid.fields.bidValueSource).toBe("player");
    }

    const invalid = resolvePlayerBidFields(
      { bidValueMode: "player", minBid: 100000, bidValueOptions: options },
      { selectedBidValue: 2000 },
    );
    expect(invalid.ok).toBe(false);
  });

  it("treats null bid value source as system assigned for display", () => {
    expect(bidValueSourceLabel(null)).toBe("System Assigned");
  });

  it("locks bid value edits after auction starts", () => {
    expect(canEditPlayerBidValue("setup")).toBe(true);
    expect(canEditPlayerBidValue("active")).toBe(false);
  });
});
