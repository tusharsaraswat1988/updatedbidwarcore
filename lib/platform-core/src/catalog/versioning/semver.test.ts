import { describe, expect, it } from "vitest";
import {
  compareSemver,
  isCompatibleUpgrade,
  isSemver,
  parseSemver,
  satisfiesSemverRange,
} from "./semver.ts";

describe("semver helpers", () => {
  it("accepts MAJOR.MINOR.PATCH only", () => {
    expect(isSemver("1.0.0")).toBe(true);
    expect(isSemver("latest")).toBe(false);
    expect(isSemver("v1")).toBe(false);
    expect(isSemver("1")).toBe(false);
    expect(parseSemver("2.1.3")).toEqual({ major: 2, minor: 1, patch: 3 });
  });

  it("compares and checks compatible upgrades", () => {
    expect(compareSemver("1.2.0", "1.1.9")).toBeGreaterThan(0);
    expect(isCompatibleUpgrade("1.0.0", "1.1.0")).toBe(true);
    expect(isCompatibleUpgrade("1.0.0", "2.0.0")).toBe(false);
    expect(satisfiesSemverRange("1.2.0", "^1.0.0")).toBe(true);
    expect(satisfiesSemverRange("2.0.0", "^1.0.0")).toBe(false);
  });
});
