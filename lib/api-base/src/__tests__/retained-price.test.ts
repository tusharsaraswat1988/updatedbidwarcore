import { describe, expect, it } from "vitest";
import { resolveRetainedPriceForSave, resolveRetainedSpend } from "../retained-price";

describe("resolveRetainedSpend", () => {
  it("uses retainedPrice when set", () => {
    expect(
      resolveRetainedSpend({ status: "retained", retainedPrice: 400000, basePrice: 100000 }),
    ).toBe(400000);
  });

  it("falls back to basePrice when retainedPrice is missing", () => {
    expect(
      resolveRetainedSpend({ status: "retained", retainedPrice: null, basePrice: 400000 }),
    ).toBe(400000);
  });

  it("returns 0 for non-retained players", () => {
    expect(
      resolveRetainedSpend({ status: "available", retainedPrice: 400000, basePrice: 400000 }),
    ).toBe(0);
  });
});

describe("resolveRetainedPriceForSave", () => {
  it("keeps explicit retained price", () => {
    expect(resolveRetainedPriceForSave(400000, 100000)).toBe(400000);
  });

  it("defaults to base price when explicit price omitted", () => {
    expect(resolveRetainedPriceForSave(undefined, 400000)).toBe(400000);
  });
});
