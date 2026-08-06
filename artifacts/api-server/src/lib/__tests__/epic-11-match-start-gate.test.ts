/**
 * EPIC-11 Phase 1 — Match Start gate (verify-only, never resolve).
 */
import { describe, expect, it, vi } from "vitest";
import {
  RuleEngine,
  verifyMatchStartContract,
  buildRuleResolutionPrepMetadata,
} from "@workspace/platform-core/rule-engine";

describe("EPIC-11 Phase 1 Match Start gate", () => {
  it("blocks Match Start without Runtime Prepare bind", () => {
    const result = verifyMatchStartContract({
      currentRuntimeVersion: null,
      runtimePrepMetadata: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("RUNTIME_PREPARE_REQUIRED");
    }
  });

  it("never calls RuleEngine.resolve during verification", () => {
    const spy = vi.spyOn(RuleEngine, "resolve");
    const metadata = buildRuleResolutionPrepMetadata({
      resolutionId: "res_1",
      rulesHash: "hash_1",
      runtimeRulesVersion: "1.0.0",
      snapshotVersion: 1,
    });
    const result = verifyMatchStartContract({
      currentRuntimeVersion: 1,
      runtimePrepMetadata: metadata,
    });
    expect(result.ok).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
