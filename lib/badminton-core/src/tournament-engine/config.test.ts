import { describe, expect, it } from "vitest";
import {
  LEGACY_RANKING_RULES,
  PRODUCT_DEFAULT_RANKING_RULES,
  resolveCurrentStage,
  resolveQualificationRules,
  resolveRankingRules,
} from "./config";
import { normalizeRankingRules } from "./types";

describe("tournament engine config", () => {
  it("uses product default constant for new categories", () => {
    expect(PRODUCT_DEFAULT_RANKING_RULES).toEqual([
      "wins",
      "pointsDifference",
      "headToHead",
      "random",
    ]);
  });

  it("falls back to legacy ranking when JSON is null", () => {
    expect(resolveRankingRules(null)).toEqual(LEGACY_RANKING_RULES);
    expect(resolveRankingRules(undefined)).toEqual(LEGACY_RANKING_RULES);
  });

  it("normalizes explicit ranking rules", () => {
    expect(
      resolveRankingRules(["wins", "pointsDifference", "headToHead", "random"]),
    ).toEqual(PRODUCT_DEFAULT_RANKING_RULES);
    expect(normalizeRankingRules(["wins", "bogus"])).toBeNull();
  });

  it("resolves qualification defaults", () => {
    const q = resolveQualificationRules({
      qualifiersPerGroup: null,
      qualifierMode: null,
      groupCount: 2,
    });
    expect(q.effectiveQualifiersPerGroup).toBe(4);
    expect(q.effectiveQualifierMode).toBe("per_group");
  });

  it("resolves current stage from draw type when unset", () => {
    expect(
      resolveCurrentStage({ drawType: "group_knockout", currentStage: null }),
    ).toBe("league");
    expect(
      resolveCurrentStage({ drawType: "knockout", currentStage: null }),
    ).toBeNull();
    expect(
      resolveCurrentStage({
        drawType: "group_knockout",
        currentStage: null,
        phase: "completed",
      }),
    ).toBe("completed");
  });
});
