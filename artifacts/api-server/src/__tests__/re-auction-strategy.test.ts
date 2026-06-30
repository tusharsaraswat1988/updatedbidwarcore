import { describe, expect, it } from "vitest";
import {
  parseReAuctionStrategy,
  resolveOpeningBid,
  serializeReAuctionStrategy,
  validateFixedReAuctionAmount,
} from "@workspace/api-base/re-auction-strategy";

describe("re-auction-strategy", () => {
  it("keep_existing uses category then player base", () => {
    expect(
      resolveOpeningBid({
        strategy: { mode: "keep_existing" },
        playerBasePrice: 50000,
        categoryMinBid: 100000,
        tournamentMinBid: 10000,
      }),
    ).toBe(100000);
    expect(
      resolveOpeningBid({
        strategy: null,
        playerBasePrice: 1500,
        categoryMinBid: null,
        tournamentMinBid: 10000,
      }),
    ).toBe(1500);
  });

  it("reset_defaults ignores player base and uses tournament floor", () => {
    expect(
      resolveOpeningBid({
        strategy: { mode: "reset_defaults" },
        playerBasePrice: 1500,
        categoryMinBid: null,
        tournamentMinBid: 100000,
      }),
    ).toBe(100000);
    expect(
      resolveOpeningBid({
        strategy: { mode: "reset_defaults" },
        playerBasePrice: 1500,
        categoryMinBid: 200000,
        tournamentMinBid: 100000,
      }),
    ).toBe(200000);
  });

  it("fixed applies same amount for every player", () => {
    expect(
      resolveOpeningBid({
        strategy: { mode: "fixed", fixedAmount: 25000 },
        playerBasePrice: 500000,
        categoryMinBid: 100000,
        tournamentMinBid: 10000,
      }),
    ).toBe(25000);
  });

  it("validates fixed amount against tournament minimum", () => {
    expect(validateFixedReAuctionAmount(0, 10000).ok).toBe(false);
    expect(validateFixedReAuctionAmount(5000, 10000).ok).toBe(false);
    const ok = validateFixedReAuctionAmount(25000, 10000);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.amount).toBe(25000);
  });

  it("round-trips strategy JSON", () => {
    const json = serializeReAuctionStrategy({ mode: "fixed", fixedAmount: 25000 });
    expect(parseReAuctionStrategy(json)).toEqual({ mode: "fixed", fixedAmount: 25000 });
  });
});
