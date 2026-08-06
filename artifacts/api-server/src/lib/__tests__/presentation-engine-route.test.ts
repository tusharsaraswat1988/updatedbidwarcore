import { describe, expect, it } from "vitest";
import {
  CapabilityCompiler,
  PresentationEngine,
  PRESENTATION_ENGINE_INPUT_VERSION,
} from "@workspace/platform-core/presentation-engine";

function stripTimings(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripTimings);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "durationMs") continue;
      out[k] = stripTimings(v);
    }
    return out;
  }
  return value;
}

/**
 * Platform API contract smoke — handlers delegate to PresentationEngine / CapabilityCompiler.
 * Full HTTP mounting is covered by route registration; computation is dark-launched.
 */
describe("Presentation Engine Platform API contract", () => {
  it("resolve is idempotent excluding durationMs", () => {
    const body = {
      inputVersion: PRESENTATION_ENGINE_INPUT_VERSION,
      snapshot: null,
      context: {
        sportId: "cricket",
        variantId: "cricket.outdoor",
        competitionTypeId: "auction",
        presentationProfile: { id: "presentation.cricket.outdoor", version: "1.0.0" },
        resolutionMode: "PREVIEW" as const,
      },
      compilationMode: "REQUIRED" as const,
    };
    const a = PresentationEngine.resolve(body);
    const b = PresentationEngine.resolve(body);
    expect(stripTimings(a)).toEqual(stripTimings(b));
  });

  it("adapt is idempotent excluding durationMs", () => {
    const resolved = PresentationEngine.resolve({
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
    expect(resolved.ok).toBe(true);
    const contract = resolved.resolvedPresentationContract!;
    const a = CapabilityCompiler.adapt(contract, "capability.obs.v1", "1.0.0");
    const b = CapabilityCompiler.adapt(contract, "capability.obs.v1", "1.0.0");
    expect(stripTimings(a)).toEqual(stripTimings(b));
  });
});
