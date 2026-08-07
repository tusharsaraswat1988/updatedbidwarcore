/**
 * EPIC-11 Phase 2 — Pre-match / dismissal consumer helpers (auction-platform mirror).
 * Authoritative assertions live in @workspace/scoring-core epic-11-phase2-consumers.
 */
import { describe, expect, it } from "vitest";
import { availableDismissalTypes, executionLimitsFromRules } from "@workspace/scoring-core";

describe("EPIC-11 Phase 2 UI consumers", () => {
  it("Corporate Box lineup limits are 8 / 2 from policy rules", () => {
    const limits = executionLimitsFromRules({
      overs: 6,
      maxWickets: 10,
      playingSquadSize: 8,
      benchSize: 2,
      lbwEnabled: false,
      freeHitEnabled: true,
      retireAtRuns: 30,
      source: "runtime_execution_policy",
    });
    expect(limits.fromPolicy).toBe(true);
    expect(limits.oversLimit).toBe(6);
    expect(limits.playingSquadSize).toBe(8);
    expect(limits.benchSize).toBe(2);
  });

  it("LBW disappears from dismissal options when disabled", () => {
    expect(availableDismissalTypes(false)).not.toContain("lbw");
  });
});
