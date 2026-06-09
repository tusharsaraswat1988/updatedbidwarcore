import { afterEach, describe, expect, it } from "vitest";
import { isBadmintonFeatureEnabled } from "../lib/badminton-feature";

describe("ENABLE_BADMINTON feature flag", () => {
  const original = process.env.ENABLE_BADMINTON;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ENABLE_BADMINTON;
    } else {
      process.env.ENABLE_BADMINTON = original;
    }
  });

  it("is disabled unless ENABLE_BADMINTON=true", () => {
    delete process.env.ENABLE_BADMINTON;
    expect(isBadmintonFeatureEnabled()).toBe(false);
    process.env.ENABLE_BADMINTON = "false";
    expect(isBadmintonFeatureEnabled()).toBe(false);
    process.env.ENABLE_BADMINTON = "true";
    expect(isBadmintonFeatureEnabled()).toBe(true);
  });
});
