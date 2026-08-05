import { describe, expect, it } from "vitest";
import { RuleEngine, ruleEngineResultOk } from "../engine.ts";
import {
  RULE_ENGINE_INPUT_VERSION,
  RUNTIME_RULES_VERSION,
  RUNTIME_RULES_SCHEMA_VERSION,
} from "../versions.ts";
import type { RuleEngineInput } from "../types.ts";

function t20Preview(compile = false): RuleEngineInput {
  return {
    inputVersion: RULE_ENGINE_INPUT_VERSION,
    snapshot: null,
    context: {
      sportId: "cricket",
      variantId: "cricket.outdoor",
      competitionTypeId: "auction",
      ruleProfile: { id: "cricket.outdoor.t20_standard", version: "1.0.0" },
      profileFamilyId: "cricket.outdoor.t20_standard",
      resolutionMode: "PREVIEW",
    },
    compile,
  };
}

describe("RuleEngine.resolve", () => {
  it("resolves PREVIEW without compilation by default", () => {
    const result = RuleEngine.resolve(t20Preview());
    expect(ruleEngineResultOk(result)).toBe(true);
    expect(result.resolvedRuleSnapshot).not.toBeNull();
    expect(result.resolvedRuntimeRules).toBeNull();
    expect(result.diagnostics.resolution.compiled).toBe(false);
    expect(result.diagnostics.resolution.stagesCompleted).toEqual([
      "verification",
      "resolution",
    ]);
  });

  it("compiles when explicitly requested in PREVIEW", () => {
    const result = RuleEngine.resolve(t20Preview(true));
    expect(result.ok).toBe(true);
    expect(result.resolvedRuntimeRules).not.toBeNull();
    expect(result.resolvedRuntimeRules?.schemaVersion).toBe(RUNTIME_RULES_SCHEMA_VERSION);
    expect(result.resolvedRuntimeRules?.runtimeRulesVersion).toBe(RUNTIME_RULES_VERSION);
    expect(result.resolvedRuntimeRules?.rulesHash).toBeTruthy();
    expect(result.resolutionId).toBe(result.resolvedRuntimeRules?.resolutionId);
    // No provenance on executable contract
    expect(result.resolvedRuntimeRules).not.toHaveProperty("runtimeBinding");
    expect(JSON.stringify(result.resolvedRuntimeRules)).not.toContain("resolvedFromLayer");
  });

  it("requires snapshot for MATCH_START", () => {
    const result = RuleEngine.resolve({
      ...t20Preview(),
      context: {
        ...t20Preview().context,
        resolutionMode: "MATCH_START",
      },
      compile: true,
    });
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.validation.structural.some((i) => i.code === "SNAPSHOT_REQUIRED"),
    ).toBe(true);
    expect(result.resolvedRuntimeRules).toBeNull();
  });

  it("is deterministic excluding durationMs", () => {
    const a = RuleEngine.resolve(t20Preview(true));
    const b = RuleEngine.resolve(t20Preview(true));
    expect(a.resolvedRuntimeRules?.rulesHash).toBe(b.resolvedRuntimeRules?.rulesHash);
    expect(a.resolutionId).toBe(b.resolutionId);
    expect(a.diagnostics.validation).toEqual(b.diagnostics.validation);
  });

  it("rejects unknown override definitions structurally", () => {
    const result = RuleEngine.resolve({
      ...t20Preview(),
      context: {
        ...t20Preview().context,
        tournamentOverrideRef: { id: "ovr", version: "1.0.0" },
      },
      overrideDocuments: {
        "ovr@1.0.0": { values: { "not.a.real.definition": 1 } },
      },
    });
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.validation.structural.some(
        (i) => i.code === "OVERRIDE_UNKNOWN_DEFINITION",
      ),
    ).toBe(true);
    expect(result.resolvedRuleSnapshot).toBeNull();
  });
});
