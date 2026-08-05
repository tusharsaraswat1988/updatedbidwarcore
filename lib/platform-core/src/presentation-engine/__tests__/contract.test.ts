import { describe, expect, it } from "vitest";
import { PresentationEngine } from "../engine.ts";
import {
  PRESENTATION_CONTRACT_VERSION,
  PRESENTATION_ENGINE_INPUT_VERSION,
  PRESENTATION_ENGINE_VERSION,
  PRESENTATION_SCHEMA_VERSION,
} from "../versions.ts";
import type { PresentationEngineInput, PresentationEngineResult } from "../types.ts";

describe("PresentationEngine public contract", () => {
  it("round-trips Input/Output DTOs with version fields", () => {
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

    const encoded = JSON.parse(JSON.stringify(input)) as PresentationEngineInput;
    expect(encoded.inputVersion).toBe(PRESENTATION_ENGINE_INPUT_VERSION);

    const result = PresentationEngine.resolve(encoded);
    const encodedResult = JSON.parse(JSON.stringify(result)) as PresentationEngineResult;

    expect(encodedResult.engineVersion).toBe(PRESENTATION_ENGINE_VERSION);
    expect(encodedResult.schemaVersion).toBe(PRESENTATION_SCHEMA_VERSION);
    expect(encodedResult.resolvedPresentationContract?.schemaVersion).toBe(
      PRESENTATION_SCHEMA_VERSION,
    );
    expect(encodedResult.resolvedPresentationContract?.presentationContractVersion).toBe(
      PRESENTATION_CONTRACT_VERSION,
    );
  });
});
