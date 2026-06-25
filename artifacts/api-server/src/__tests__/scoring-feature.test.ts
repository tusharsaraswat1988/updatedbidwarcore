import { afterEach, describe, expect, it } from "vitest";
import { isScoringFeatureEnabled } from "../lib/scoring-feature";

describe("SCORING feature flag", () => {
  const originalScoring = process.env.SCORING;
  const originalBadminton = process.env.ENABLE_BADMINTON;

  afterEach(() => {
    if (originalScoring === undefined) delete process.env.SCORING;
    else process.env.SCORING = originalScoring;
    if (originalBadminton === undefined) delete process.env.ENABLE_BADMINTON;
    else process.env.ENABLE_BADMINTON = originalBadminton;
  });

  it("is enabled when SCORING=true", () => {
    process.env.SCORING = "true";
    delete process.env.ENABLE_BADMINTON;
    expect(isScoringFeatureEnabled()).toBe(true);
  });

  it("is disabled when SCORING=false even if ENABLE_BADMINTON=true", () => {
    process.env.SCORING = "false";
    process.env.ENABLE_BADMINTON = "true";
    expect(isScoringFeatureEnabled()).toBe(false);
  });

  it("falls back to ENABLE_BADMINTON=true when SCORING is unset", () => {
    delete process.env.SCORING;
    process.env.ENABLE_BADMINTON = "true";
    expect(isScoringFeatureEnabled()).toBe(true);
  });

  it("is disabled when neither flag is set", () => {
    delete process.env.SCORING;
    delete process.env.ENABLE_BADMINTON;
    expect(isScoringFeatureEnabled()).toBe(false);
  });
});
