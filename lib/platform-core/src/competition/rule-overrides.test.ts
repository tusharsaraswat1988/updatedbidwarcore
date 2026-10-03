import { describe, expect, it } from "vitest";
import {
  parseRuleOverrides,
  sparseRuleOverrides,
  validateCricketKeyRuleOverrides,
} from "./rule-overrides.ts";

describe("rule overrides", () => {
  it("accepts allowlisted cricket key overrides", () => {
    const result = validateCricketKeyRuleOverrides({
      values: {
        "cricket.match.overs_per_innings": 8,
        "cricket.dismissal.lbw_enabled": true,
        "cricket.batting.retire_at_runs": null,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document?.values["cricket.match.overs_per_innings"]).toBe(8);
  });

  it("rejects unknown override keys", () => {
    const result = validateCricketKeyRuleOverrides({
      values: { "cricket.unknown.some_flag": true },
    });
    expect(result.ok).toBe(false);
  });

  it("sparsifies only changed keys", () => {
    const sparse = sparseRuleOverrides(
      {
        "cricket.match.overs_per_innings": 6,
        "cricket.match.max_wickets": 10,
      },
      {
        "cricket.match.overs_per_innings": 8,
        "cricket.match.max_wickets": 10,
      },
    );
    expect(sparse).toEqual({
      values: { "cricket.match.overs_per_innings": 8 },
    });
  });

  it("parses stored json sparsely", () => {
    expect(
      parseRuleOverrides({
        values: {
          "cricket.match.overs_per_innings": 8,
          "cricket.unknown.some_flag": true,
        },
      }),
    ).toEqual({
      values: { "cricket.match.overs_per_innings": 8 },
    });
  });

  it("validates and sorts cricket.powerplay.overs", () => {
    const valid = validateCricketKeyRuleOverrides({
      values: {
        "cricket.powerplay.overs": [3, 1, 2, 2],
      },
    });
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    expect(valid.document?.values["cricket.powerplay.overs"]).toEqual([1, 2, 3]);

    const invalid = validateCricketKeyRuleOverrides({
      values: {
        "cricket.powerplay.overs": [0, -1],
      },
    });
    expect(invalid.ok).toBe(false);

    const nonArray = validateCricketKeyRuleOverrides({
      values: {
        "cricket.powerplay.overs": "1,2,3",
      },
    });
    expect(nonArray.ok).toBe(false);
  });
});
