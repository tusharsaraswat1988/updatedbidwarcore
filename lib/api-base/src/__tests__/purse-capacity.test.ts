import { describe, expect, it } from "vitest";
import {
  assertCapacityNotBelowUsed,
  computeEffectiveCapacity,
  computePurseRemaining,
} from "@workspace/api-base/purse-capacity";

describe("purse-capacity", () => {
  it("computes effective capacity from original purse and boosters", () => {
    expect(computeEffectiveCapacity(10_000_000, 500_000)).toBe(10_500_000);
  });

  it("computes purse remaining from capacity and used", () => {
    expect(computePurseRemaining(10_500_000, 8_000_000)).toBe(2_500_000);
  });

  it("rejects cancellation that would drop below purse used", () => {
    const result = assertCapacityNotBelowUsed(8_000_000, 8_500_000);
    expect(result.ok).toBe(false);
  });

  it("allows cancellation when capacity stays above purse used", () => {
    const result = assertCapacityNotBelowUsed(9_000_000, 8_500_000);
    expect(result.ok).toBe(true);
  });
});
