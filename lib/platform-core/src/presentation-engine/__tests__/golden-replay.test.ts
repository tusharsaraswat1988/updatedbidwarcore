import { describe, expect, it } from "vitest";
import { PresentationEngine } from "../engine.ts";
import { PRESENTATION_ENGINE_INPUT_VERSION } from "../versions.ts";
import type { PresentationEngineInput, PresentationEngineResult } from "../types.ts";

function stripNonDeterministic(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNonDeterministic);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "durationMs") continue;
      out[k] = stripNonDeterministic(v);
    }
    return out;
  }
  return value;
}

function serialize(value: unknown): string {
  return JSON.stringify(value);
}

describe("PresentationEngine golden replay", () => {
  it("replays identical deterministic output", () => {
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

    const raw = serialize(input);
    const reloaded = JSON.parse(raw) as PresentationEngineInput;
    const a = stripNonDeterministic(PresentationEngine.resolve(reloaded) as PresentationEngineResult);
    const b = stripNonDeterministic(
      PresentationEngine.resolve(JSON.parse(serialize(input))) as PresentationEngineResult,
    );
    expect(serialize(a)).toBe(serialize(b));
  });

  it("unrelated catalog sport does not affect cricket replay hash", () => {
    const cricketInput: PresentationEngineInput = {
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
    const before = PresentationEngine.resolve(cricketInput).resolvedPresentationContract
      ?.semanticHash;

    PresentationEngine.resolve({
      inputVersion: PRESENTATION_ENGINE_INPUT_VERSION,
      snapshot: null,
      context: {
        sportId: "badminton",
        variantId: "badminton.standard",
        competitionTypeId: "auction",
        presentationProfile: { id: "presentation.badminton.standard", version: "1.0.0" },
        resolutionMode: "PREVIEW",
      },
    });

    const after = PresentationEngine.resolve(cricketInput).resolvedPresentationContract
      ?.semanticHash;
    expect(after).toBe(before);
  });
});
