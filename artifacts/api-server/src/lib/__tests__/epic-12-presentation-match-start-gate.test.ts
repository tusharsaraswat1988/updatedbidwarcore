/**
 * EPIC-12 Phase 1 — Match Start presentation gate (verify-only, never resolve).
 */
import { describe, expect, it, vi } from "vitest";
import {
  PresentationEngine,
  verifyPresentationMatchStartContract,
  buildPresentationResolutionPrepMetadata,
} from "@workspace/platform-core/presentation-engine";

describe("EPIC-12 Phase 1 Match Start presentation gate", () => {
  it("blocks Match Start without presentation Prepare bind", () => {
    const result = verifyPresentationMatchStartContract({
      currentRuntimeVersion: null,
      runtimePrepMetadata: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("RUNTIME_PREPARE_REQUIRED");
    }
  });

  it("never calls PresentationEngine.resolve during verification", () => {
    const spy = vi.spyOn(PresentationEngine, "resolve");
    const metadata = buildPresentationResolutionPrepMetadata({
      presentationResolutionId: "pres_1",
      presentationHash: "hash_1",
      presentationVersion: "1.0.0",
      snapshotVersion: 1,
    });
    const result = verifyPresentationMatchStartContract({
      currentRuntimeVersion: 1,
      runtimePrepMetadata: metadata,
    });
    expect(result.ok).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
