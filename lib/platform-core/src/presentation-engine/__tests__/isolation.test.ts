import { describe, expect, it } from "vitest";
import { CapabilityCompiler } from "../capability-compiler.ts";
import { PresentationEngine } from "../engine.ts";
import { PRESENTATION_ENGINE_INPUT_VERSION } from "../versions.ts";
import type { PresentationEngineInput, ResolvedPresentationContract } from "../types.ts";

function resolveOutdoor(): ResolvedPresentationContract {
  const input: PresentationEngineInput = {
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
  const result = PresentationEngine.resolve(input);
  expect(result.ok).toBe(true);
  return result.resolvedPresentationContract!;
}

describe("Capability Compiler consumer isolation", () => {
  it("OBS adapt does not mutate Phase A contract or affect LED adapt", () => {
    const contract = resolveOutdoor();
    const beforeHash = contract.semanticHash;
    const beforeFeatures = JSON.stringify(contract.features);

    const obs = CapabilityCompiler.adapt(contract, "capability.obs.v1", "1.0.0");
    expect(obs.ok).toBe(true);

    // Phase A contract unchanged after OBS adapt
    expect(contract.semanticHash).toBe(beforeHash);
    expect(JSON.stringify(contract.features)).toBe(beforeFeatures);

    const led = CapabilityCompiler.adapt(contract, "capability.led.v1", "1.0.0");
    expect(led.ok).toBe(true);

    // Different consumers produce different adaptations
    expect(obs.adaptationHash).not.toBe(led.adaptationHash);

    // LED result independent of prior OBS adapt
    const ledAgain = CapabilityCompiler.adapt(contract, "capability.led.v1", "1.0.0");
    expect(ledAgain.adaptationHash).toBe(led.adaptationHash);
    expect(JSON.stringify(ledAgain.adaptedPresentationContract)).toBe(
      JSON.stringify(led.adaptedPresentationContract),
    );
  });

  it("Mobile adapt leaves Broadcast/OBS baseline contract unchanged", () => {
    const contract = resolveOutdoor();
    const baseline = JSON.stringify(contract);

    const mobile = CapabilityCompiler.adapt(contract, "capability.mobile.v1", "1.0.0");
    expect(mobile.ok).toBe(true);
    expect(mobile.adaptedPresentationContract?.disabledByCapability.length).toBeGreaterThan(0);

    expect(JSON.stringify(contract)).toBe(baseline);

    const obs = CapabilityCompiler.adapt(contract, "capability.obs.v1", "1.0.0");
    expect(obs.ok).toBe(true);
    expect(obs.adaptationHash).not.toBe(mobile.adaptationHash);
  });
});
