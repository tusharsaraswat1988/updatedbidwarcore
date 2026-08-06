import { describe, expect, it } from "vitest";
import { RuleEngine } from "../engine.ts";
import {
  RULE_ENGINE_INPUT_VERSION,
  RULE_ENGINE_VERSION,
  RUNTIME_RULES_SCHEMA_VERSION,
  RUNTIME_RULES_VERSION,
} from "../versions.ts";
import type { RuleEngineInput, RuleEngineResult } from "../types.ts";

describe("RuleEngine public contract", () => {
  it("round-trips Input/Output DTOs with version fields", () => {
    const input: RuleEngineInput = {
      inputVersion: RULE_ENGINE_INPUT_VERSION,
      snapshot: null,
      context: {
        sportId: "cricket",
        variantId: "cricket.outdoor",
        competitionTypeId: "auction",
        ruleProfile: { id: "cricket.outdoor.t20_standard", version: "1.0.0" },
        resolutionMode: "CREATE",
      },
    };

    const encoded = JSON.parse(JSON.stringify(input)) as RuleEngineInput;
    expect(encoded.inputVersion).toBe(RULE_ENGINE_INPUT_VERSION);

    const result = RuleEngine.resolve(encoded);
    const encodedResult = JSON.parse(JSON.stringify(result)) as RuleEngineResult;

    expect(encodedResult.engineVersion).toBe(RULE_ENGINE_VERSION);
    expect(encodedResult.resolvedRuntimeRules?.schemaVersion).toBe(
      RUNTIME_RULES_SCHEMA_VERSION,
    );
    expect(encodedResult.resolvedRuntimeRules?.runtimeRulesVersion).toBe(
      RUNTIME_RULES_VERSION,
    );
    expect(encodedResult.diagnostics.resolution.engineVersion).toBe(RULE_ENGINE_VERSION);
  });
});
