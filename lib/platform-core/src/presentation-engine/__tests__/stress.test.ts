import { describe, expect, it } from "vitest";
import { CapabilityCompiler } from "../capability-compiler.ts";
import { PresentationEngine } from "../engine.ts";
import { PRESENTATION_ENGINE_INPUT_VERSION } from "../versions.ts";
import type { PresentationEngineInput } from "../types.ts";

const baseInput: PresentationEngineInput = {
  inputVersion: PRESENTATION_ENGINE_INPUT_VERSION,
  snapshot: null,
  context: {
    sportId: "cricket",
    variantId: "cricket.outdoor",
    competitionTypeId: "auction",
    presentationProfile: { id: "presentation.cricket.outdoor", version: "1.0.0" },
    resolutionMode: "CREATE",
  },
  compilationMode: "REQUIRED",
};

describe("Presentation Engine determinism stress", () => {
  it("resolve 1000× yields identical semanticHash and resolutionId", () => {
    const first = PresentationEngine.resolve(baseInput);
    expect(first.ok).toBe(true);
    const semanticHash = first.resolvedPresentationContract!.semanticHash;
    const resolutionId = first.resolutionId;

    for (let i = 0; i < 999; i++) {
      const next = PresentationEngine.resolve(baseInput);
      expect(next.ok).toBe(true);
      expect(next.resolvedPresentationContract!.semanticHash).toBe(semanticHash);
      expect(next.resolutionId).toBe(resolutionId);
    }
  });

  it("adapt 1000× yields identical adaptationHash", () => {
    const resolved = PresentationEngine.resolve(baseInput);
    const contract = resolved.resolvedPresentationContract!;
    const first = CapabilityCompiler.adapt(contract, "capability.obs.v1", "1.0.0");
    expect(first.ok).toBe(true);
    const adaptationHash = first.adaptationHash;

    for (let i = 0; i < 999; i++) {
      const next = CapabilityCompiler.adapt(contract, "capability.obs.v1", "1.0.0");
      expect(next.ok).toBe(true);
      expect(next.adaptationHash).toBe(adaptationHash);
    }
  });
});
