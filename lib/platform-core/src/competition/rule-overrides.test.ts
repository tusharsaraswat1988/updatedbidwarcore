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
});
