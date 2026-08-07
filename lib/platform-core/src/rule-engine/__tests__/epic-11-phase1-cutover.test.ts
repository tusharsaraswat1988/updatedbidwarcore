/**
 * EPIC-11 Phase 1 — Rule Engine Consumer Cutover tests.
 * Proves: sole resolve at Prepare, RuntimeExecutionPolicy, compatibility rulesJson,
 * Match Start verify-only, Snapshot refs-only, Corporate Box values.
 */
import { describe, expect, it, vi } from "vitest";
import {
  RuleEngine,
  buildPrepareRuleEngineInput,
  buildRuleResolutionPrepMetadata,
  buildRuntimeExecutionPolicy,
  projectRuntimeExecutionPolicyToRulesJson,
  resolvePrepareCatalogBindings,
  ruleEngineResultOk,
  verifyMatchStartContract,
  RULE_ENGINE_INPUT_VERSION,
} from "../index.ts";
import {
  buildRuntimeSnapshot,
  buildSnapshotReferences,
} from "../../runtime-match/index.ts";

const CORPORATE_BOX = {
  sportId: "cricket",
  variantId: "cricket.box",
  competitionTypeId: "auction",
  ruleProfileId: "cricket.box.corporate_standard",
  ruleProfileVersion: "1.0.0",
  presentationProfileId: "presentation.cricket.corporate_box",
  presentationProfileVersion: "1.0.0",
} as const;

function corporateBoxSnapshot(matchId = "42") {
  const bindings = resolvePrepareCatalogBindings(CORPORATE_BOX);
  return buildRuntimeSnapshot({
    matchId,
    tournamentId: 7,
    snapshotVersion: 1,
    createdAt: "2026-08-06T12:00:00.000Z",
    createdBy: "test",
    references: buildSnapshotReferences({
      matchId,
      ruleProfileId: bindings.ruleProfileId,
      ruleProfileVersion: bindings.ruleProfileVersion,
      presentationProfileId: bindings.presentationProfileId,
      presentationProfileVersion: bindings.presentationProfileVersion,
      competitionId: "7",
      competitionVersion: 1,
      matchConfigurationVersion: 1,
      sideIds: [{ id: "side_a" }, { id: "side_b" }],
    }),
  });
}

describe("EPIC-11 Phase 1 — Runtime Prepare → Rule Engine cutover", () => {
  it("Corporate Box: RuleEngine.resolve(PREPARE) once → Policy → rulesJson values", () => {
    const snapshot = corporateBoxSnapshot();
    const bindings = resolvePrepareCatalogBindings(CORPORATE_BOX);
    const input = buildPrepareRuleEngineInput(snapshot, bindings);

    const spy = vi.spyOn(RuleEngine, "resolve");
    const result = RuleEngine.resolve(input);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();

    expect(ruleEngineResultOk(result)).toBe(true);
    expect(result.resolvedRuntimeRules).not.toBeNull();
    expect(input.context.resolutionMode).toBe("PREPARE");

    const policy = buildRuntimeExecutionPolicy(result.resolvedRuntimeRules!);
    expect(policy.resolutionId).toBe(result.resolvedRuntimeRules!.resolutionId);
    expect(policy.rulesHash).toBe(result.resolvedRuntimeRules!.rulesHash);
    expect(policy.cricket).not.toBeNull();
    expect(policy.cricket!.oversLimit).toBe(6);
    expect(policy.cricket!.playingSquadSize).toBe(8);
    expect(policy.cricket!.benchSize).toBe(2);
    expect(policy.cricket!.lbwEnabled).toBe(false);
    expect(policy.cricket!.retireAtRuns).toBe(30);
    expect(policy.cricket!.freeHitEnabled).toBe(true);

    const rulesJson = projectRuntimeExecutionPolicyToRulesJson(policy);
    expect(rulesJson.source).toBe("runtime_execution_policy");
    expect(rulesJson.overs).toBe(6);
    expect(rulesJson.playingSquadSize).toBe(8);
    expect(rulesJson.lbwEnabled).toBe(false);
    expect(rulesJson.retireAtRuns).toBe(30);
    expect(rulesJson.maxWickets).toBe(10);
  });

  it("RuleEngine.resolve executes exactly once for a Prepare cycle (no Match Start resolve)", () => {
    const snapshot = corporateBoxSnapshot("99");
    const bindings = resolvePrepareCatalogBindings(CORPORATE_BOX);
    const prepareInput = buildPrepareRuleEngineInput(snapshot, bindings);

    const spy = vi.spyOn(RuleEngine, "resolve");
    const prepareResult = RuleEngine.resolve(prepareInput);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(prepareResult.ok).toBe(true);

    // Match Start must NEVER resolve — only verify bind.
    const bind = {
      resolutionId: prepareResult.resolvedRuntimeRules!.resolutionId,
      rulesHash: prepareResult.resolvedRuntimeRules!.rulesHash,
      runtimeRulesVersion: prepareResult.resolvedRuntimeRules!.runtimeRulesVersion,
      snapshotVersion: 1,
    };
    const metadata = buildRuleResolutionPrepMetadata(bind);
    const verified = verifyMatchStartContract({
      currentRuntimeVersion: 1,
      runtimePrepMetadata: metadata,
    });
    expect(verified.ok).toBe(true);
    // Still exactly one resolve — verify did not call RuleEngine.
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("Runtime Prepare is mandatory — Match Start fails without bind", () => {
    const missing = verifyMatchStartContract({
      currentRuntimeVersion: null,
      runtimePrepMetadata: null,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.code).toBe("RUNTIME_PREPARE_REQUIRED");
    }

    const noResolution = verifyMatchStartContract({
      currentRuntimeVersion: 1,
      runtimePrepMetadata: {},
    });
    expect(noResolution.ok).toBe(false);
    if (!noResolution.ok) {
      expect(noResolution.code).toBe("RUNTIME_PREPARE_REQUIRED");
    }
  });

  it("Match Start verifies snapshotVersion / resolutionId / rulesHash", () => {
    const metadata = buildRuleResolutionPrepMetadata({
      resolutionId: "res_abc",
      rulesHash: "hash_xyz",
      runtimeRulesVersion: "1.0.0",
      snapshotVersion: 3,
    });
    const ok = verifyMatchStartContract({
      currentRuntimeVersion: 3,
      runtimePrepMetadata: metadata,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.bind.resolutionId).toBe("res_abc");
      expect(ok.bind.rulesHash).toBe("hash_xyz");
      expect(ok.bind.snapshotVersion).toBe(3);
    }

    const mismatch = verifyMatchStartContract({
      currentRuntimeVersion: 4,
      runtimePrepMetadata: metadata,
    });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) {
      expect(mismatch.code).toBe("SNAPSHOT_VERSION_MISMATCH");
    }
  });

  it("Runtime Snapshot remains references only — no rule bodies / policy / rulesJson", () => {
    const snapshot = corporateBoxSnapshot();
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain("overs");
    expect(json).not.toContain("lbw");
    expect(json).not.toContain("retire");
    expect(json).not.toContain("ResolvedRuntimeRules");
    expect(json).not.toContain("runtimeExecutionPolicy");
    expect(json).not.toContain("rulesJson");
    expect(snapshot.references.ruleProfile?.id).toBe(
      "cricket.box.corporate_standard",
    );
  });

  it("prep metadata stores resolution identity only — strips rule bodies if present", () => {
    const metadata = buildRuleResolutionPrepMetadata(
      {
        resolutionId: "r1",
        rulesHash: "h1",
        runtimeRulesVersion: "1.0.0",
        snapshotVersion: 2,
      },
      {
        resolvedRuntimeRules: { rules: [{ definitionId: "x", value: 6 }] },
        runtimeExecutionPolicy: { cricket: { oversLimit: 6 } },
        rulesJson: { overs: 6 },
        other: "keep",
      },
    );
    expect(metadata.ruleResolution).toEqual({
      resolutionId: "r1",
      rulesHash: "h1",
      runtimeRulesVersion: "1.0.0",
      snapshotVersion: 2,
    });
    expect(metadata).not.toHaveProperty("resolvedRuntimeRules");
    expect(metadata).not.toHaveProperty("runtimeExecutionPolicy");
    expect(metadata).not.toHaveProperty("rulesJson");
    expect(metadata.other).toBe("keep");
  });

  it("PREPARE input requires snapshot and uses RULE_ENGINE_INPUT_VERSION", () => {
    const snapshot = corporateBoxSnapshot();
    const bindings = resolvePrepareCatalogBindings(CORPORATE_BOX);
    const input = buildPrepareRuleEngineInput(snapshot, bindings);
    expect(input.inputVersion).toBe(RULE_ENGINE_INPUT_VERSION);
    expect(input.snapshot).toBe(snapshot);
    expect(input.compile).toBe(true);
    expect(input.context.ruleProfile.id).toBe("cricket.box.corporate_standard");
    expect(String(input.context.ruleProfile.version)).toBe("1.0.0");
  });
});
