import { describe, expect, it } from "vitest";
import {
  RuleEngine,
  RULE_ENGINE_INPUT_VERSION,
} from "@workspace/platform-core/rule-engine";

/**
 * Platform API contract smoke — handlers delegate to RuleEngine.resolve (idempotent).
 * Full HTTP mounting is covered by route registration; computation is dark-launched.
 */
describe("Rule Engine Platform API contract", () => {
  it("resolve is idempotent excluding durationMs", () => {
    const body = {
      inputVersion: RULE_ENGINE_INPUT_VERSION,
      snapshot: null,
      context: {
        sportId: "cricket",
        variantId: "cricket.outdoor",
        competitionTypeId: "auction",
        ruleProfile: { id: "cricket.outdoor.t20_standard", version: "1.0.0" },
        profileFamilyId: "cricket.outdoor.t20_standard",
        resolutionMode: "PREVIEW" as const,
      },
    };
    const a = RuleEngine.resolve(body);
    const b = RuleEngine.resolve(body);
    const { durationMs: _a, ...restA } = a;
    const { durationMs: _b, ...restB } = b;
    expect(restA).toEqual(restB);
  });
});
