import { describe, expect, it } from "vitest";
import { RuleEngine } from "../engine.ts";
import { RULE_ENGINE_INPUT_VERSION } from "../versions.ts";
import type { RuleEngineInput, RuleEngineResult } from "../types.ts";

function stripNonDeterministic(result: RuleEngineResult) {
  const { durationMs: _d, ...rest } = result;
  return rest;
}

function serialize(value: unknown): string {
  return JSON.stringify(value);
}

describe("RuleEngine golden replay", () => {
  it("replays identical deterministic output", () => {
    const input: RuleEngineInput = {
      inputVersion: RULE_ENGINE_INPUT_VERSION,
      snapshot: null,
      context: {
        sportId: "cricket",
        variantId: "cricket.outdoor",
        competitionTypeId: "auction",
        ruleProfile: { id: "cricket.outdoor.t20_standard", version: "1.0.0" },
        profileFamilyId: "cricket.outdoor.t20_standard",
        resolutionMode: "CREATE",
      },
    };

    const raw = serialize(input);
    const reloaded = JSON.parse(raw) as RuleEngineInput;
    const a = stripNonDeterministic(RuleEngine.resolve(reloaded));
    const b = stripNonDeterministic(RuleEngine.resolve(JSON.parse(serialize(input))));
    expect(serialize(a)).toBe(serialize(b));
  });

  it("unrelated catalog sport does not affect cricket replay hash", () => {
    const cricketInput: RuleEngineInput = {
      inputVersion: RULE_ENGINE_INPUT_VERSION,
      snapshot: null,
      context: {
        sportId: "cricket",
        variantId: "cricket.outdoor",
        competitionTypeId: "auction",
        ruleProfile: { id: "cricket.outdoor.t20_standard", version: "1.0.0" },
        profileFamilyId: "cricket.outdoor.t20_standard",
        resolutionMode: "CREATE",
      },
    };
    const before = RuleEngine.resolve(cricketInput).resolvedRuntimeRules?.rulesHash;

    // Resolve an unrelated sport — must not mutate cricket output
    RuleEngine.resolve({
      inputVersion: RULE_ENGINE_INPUT_VERSION,
      snapshot: null,
      context: {
        sportId: "badminton",
        variantId: "badminton.standard",
        competitionTypeId: "auction",
        ruleProfile: { id: "badminton.standard_bwf", version: "1.0.0" },
        profileFamilyId: "badminton.standard_bwf",
        resolutionMode: "PREVIEW",
      },
    });

    const after = RuleEngine.resolve(cricketInput).resolvedRuntimeRules?.rulesHash;
    expect(after).toBe(before);
  });
});
