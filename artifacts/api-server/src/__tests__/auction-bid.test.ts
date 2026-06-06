import { describe, expect, it } from "vitest";
import {
  computeNextBidAmount,
  validateBidAmount,
} from "@workspace/api-base/auction-bid";

const BASE = 10_000;
const INCREMENT = 25_000;

describe("computeNextBidAmount", () => {
  it("returns base price when no team has bid yet", () => {
    expect(
      computeNextBidAmount({
        currentBid: BASE,
        bidIncrement: INCREMENT,
        currentBidTeamId: null,
      }),
    ).toBe(BASE);
  });

  it("returns current bid + increment after Team A opens at base", () => {
    expect(
      computeNextBidAmount({
        currentBid: BASE,
        bidIncrement: INCREMENT,
        currentBidTeamId: 1,
      }),
    ).toBe(BASE + INCREMENT);
  });

  it("returns current bid + increment after Team B raises to 35000", () => {
    expect(
      computeNextBidAmount({
        currentBid: BASE + INCREMENT,
        bidIncrement: INCREMENT,
        currentBidTeamId: 2,
      }),
    ).toBe(BASE + INCREMENT * 2);
  });
});

describe("validateBidAmount", () => {
  const noBidder = {
    currentBid: BASE,
    bidIncrement: INCREMENT,
    currentBidTeamId: null as number | null,
  };

  it("accepts opening bid exactly equal to base price", () => {
    expect(validateBidAmount(BASE, noBidder)).toEqual({ ok: true });
  });

  it("rejects sub-increment amounts on opening bid (11000, 12000, 15000)", () => {
    for (const amount of [11_000, 12_000, 15_000]) {
      expect(validateBidAmount(amount, noBidder).ok).toBe(false);
    }
  });

  it("rejects opening bid above base price without a prior bidder", () => {
    expect(validateBidAmount(BASE + INCREMENT, noBidder).ok).toBe(false);
  });

  it("accepts exactly currentBid + increment after first bid", () => {
    expect(
      validateBidAmount(BASE + INCREMENT, {
        currentBid: BASE,
        bidIncrement: INCREMENT,
        currentBidTeamId: 1,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects invalid raises after first bid", () => {
    const afterTeamA = {
      currentBid: BASE,
      bidIncrement: INCREMENT,
      currentBidTeamId: 1,
    };
    expect(validateBidAmount(BASE + 1, afterTeamA).ok).toBe(false);
    expect(validateBidAmount(BASE + 5_000, afterTeamA).ok).toBe(false);
    expect(validateBidAmount(BASE + INCREMENT + 5_000, afterTeamA).ok).toBe(false);
  });

  it("accepts third bid at 60000 after current bid is 35000", () => {
    expect(
      validateBidAmount(BASE + INCREMENT * 2, {
        currentBid: BASE + INCREMENT,
        bidIncrement: INCREMENT,
        currentBidTeamId: 2,
      }),
    ).toEqual({ ok: true });
  });
});

describe("expected bid sequence (base 10000, increment 25000)", () => {
  it("follows 10000 → 35000 → 60000 → 85000", () => {
    let currentBid = BASE;
    let currentBidTeamId: number | null = null;

    const step = () =>
      computeNextBidAmount({
        currentBid,
        bidIncrement: INCREMENT,
        currentBidTeamId,
      });

    expect(step()).toBe(10_000);
    expect(validateBidAmount(10_000, { currentBid, bidIncrement: INCREMENT, currentBidTeamId }).ok).toBe(true);
    currentBid = 10_000;
    currentBidTeamId = 1;

    expect(step()).toBe(35_000);
    expect(
      validateBidAmount(35_000, { currentBid, bidIncrement: INCREMENT, currentBidTeamId }).ok,
    ).toBe(true);
    currentBid = 35_000;
    currentBidTeamId = 2;

    expect(step()).toBe(60_000);
    expect(
      validateBidAmount(60_000, { currentBid, bidIncrement: INCREMENT, currentBidTeamId }).ok,
    ).toBe(true);
    currentBid = 60_000;
    currentBidTeamId = 1;

    expect(step()).toBe(85_000);
    expect(
      validateBidAmount(85_000, { currentBid, bidIncrement: INCREMENT, currentBidTeamId }).ok,
    ).toBe(true);
  });
});
