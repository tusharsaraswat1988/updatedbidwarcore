import { describe, expect, it } from "vitest";
import { computePurseProtection } from "../purse-protection";

const baseInput = {
  purse: 400_000,
  purseUsed: 0,
  boosterTotal: 0,
  minimumSquadSize: 4,
  maximumSquadSize: 0,
  minBid: 10_000,
};

describe("computePurseProtection", () => {
  it("uses future squad state for maxAllowedBid when no players bought", () => {
    const p = computePurseProtection({ ...baseInput, playersBought: 0 });

    expect(p.slotsRequired).toBe(4);
    expect(p.reservePurse).toBe(40_000);
    expect(p.spendablePurse).toBe(360_000);

    expect(p.futurePlayersBought).toBe(1);
    expect(p.futureSlotsRequired).toBe(3);
    expect(p.futureReservePurse).toBe(30_000);
    expect(p.maxAllowedBid).toBe(370_000);
  });

  it("uses future squad state after one purchase", () => {
    const p = computePurseProtection({
      ...baseInput,
      purseUsed: 50_000,
      playersBought: 1,
    });

    expect(p.purseRemaining).toBe(350_000);
    expect(p.slotsRequired).toBe(3);
    expect(p.reservePurse).toBe(30_000);
    expect(p.spendablePurse).toBe(320_000);

    expect(p.futurePlayersBought).toBe(2);
    expect(p.futureSlotsRequired).toBe(2);
    expect(p.futureReservePurse).toBe(20_000);
    expect(p.maxAllowedBid).toBe(330_000);
  });

  it("allows full remaining purse once minimum squad is met after purchase", () => {
    const p = computePurseProtection({
      ...baseInput,
      purseUsed: 120_000,
      playersBought: 3,
    });

    expect(p.slotsRequired).toBe(1);
    expect(p.reservePurse).toBe(10_000);
    expect(p.futureSlotsRequired).toBe(0);
    expect(p.futureReservePurse).toBe(0);
    expect(p.maxAllowedBid).toBe(280_000);
  });

  it("disables reserve when minimum squad size is zero", () => {
    const p = computePurseProtection({
      ...baseInput,
      minimumSquadSize: 0,
      playersBought: 0,
    });

    expect(p.reservePurse).toBe(0);
    expect(p.spendablePurse).toBe(400_000);
    expect(p.maxAllowedBid).toBe(400_000);
  });
});
