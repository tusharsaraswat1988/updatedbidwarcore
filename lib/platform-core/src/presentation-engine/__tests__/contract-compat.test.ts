import { describe, expect, it } from "vitest";
import { PresentationEngine } from "../engine.ts";
import {
  PRESENTATION_CONTRACT_VERSION,
  PRESENTATION_ENGINE_INPUT_VERSION,
} from "../versions.ts";
import type { ResolvedPresentationContract } from "../types.ts";

describe("Contract backward-compatibility", () => {
  it("serialize → deserialize preserves semanticHash for Contract v1", () => {
    const result = PresentationEngine.resolve({
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
    });

    expect(result.ok).toBe(true);
    const contract = result.resolvedPresentationContract!;
    expect(contract.presentationContractVersion).toBe(PRESENTATION_CONTRACT_VERSION);

    const wire = JSON.stringify(contract);
    const restored = JSON.parse(wire) as ResolvedPresentationContract;

    expect(restored.semanticHash).toBe(contract.semanticHash);
    expect(restored.resolutionId).toBe(contract.resolutionId);
    expect(restored.presentationContractVersion).toBe(PRESENTATION_CONTRACT_VERSION);
    expect(restored.tokens).toEqual(contract.tokens);
    expect(restored.features).toEqual(contract.features);
    expect(restored.slots).toEqual(contract.slots);
  });

  it("contract is frozen (immutable) and has no runtime-state fields", () => {
    const result = PresentationEngine.resolve({
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
    });
    const contract = result.resolvedPresentationContract!;
    expect(Object.isFrozen(contract)).toBe(true);
    expect(Object.isFrozen(contract.features)).toBe(true);
    expect(Object.isFrozen(contract.slots)).toBe(true);

    const forbiddenRuntimeKeys = [
      "matchClock",
      "liveScore",
      "sessionId",
      "rendererId",
      "widgetTree",
      "css",
      "pixels",
      "dom",
      "react",
    ];
    const keys = Object.keys(contract);
    for (const k of forbiddenRuntimeKeys) {
      expect(keys).not.toContain(k);
    }
    expect(JSON.stringify(contract)).not.toMatch(/px|rgba\(|#[0-9a-fA-F]{3,8}/);
  });
});
