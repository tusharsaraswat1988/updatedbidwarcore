import { describe, expect, it } from "vitest";
import { CapabilityCompiler } from "../capability-compiler.ts";
import { PresentationEngine, presentationEngineResultOk } from "../engine.ts";
import {
  PRESENTATION_CONTRACT_VERSION,
  PRESENTATION_ENGINE_INPUT_VERSION,
  PRESENTATION_SCHEMA_VERSION,
} from "../versions.ts";
import type { PresentationEngineInput } from "../types.ts";

function outdoorPreview(compilationMode?: PresentationEngineInput["compilationMode"]): PresentationEngineInput {
  return {
    inputVersion: PRESENTATION_ENGINE_INPUT_VERSION,
    snapshot: null,
    context: {
      sportId: "cricket",
      variantId: "cricket.outdoor",
      competitionTypeId: "auction",
      presentationProfile: { id: "presentation.cricket.outdoor", version: "1.0.0" },
      resolutionMode: "PREVIEW",
    },
    compilationMode,
  };
}

describe("PresentationEngine.resolve", () => {
  it("resolves PREVIEW without compilation by default (AUTO)", () => {
    const result = PresentationEngine.resolve(outdoorPreview("AUTO"));
    expect(presentationEngineResultOk(result)).toBe(true);
    expect(result.resolvedPresentationSnapshot).not.toBeNull();
    expect(result.resolvedPresentationContract).toBeNull();
    expect(result.compilation?.compiled).toBe(false);
  });

  it("compiles when REQUIRED", () => {
    const result = PresentationEngine.resolve(outdoorPreview("REQUIRED"));
    expect(result.ok).toBe(true);
    expect(result.resolvedPresentationContract).not.toBeNull();
    expect(result.resolvedPresentationContract?.schemaVersion).toBe(PRESENTATION_SCHEMA_VERSION);
    expect(result.resolvedPresentationContract?.presentationContractVersion).toBe(
      PRESENTATION_CONTRACT_VERSION,
    );
    expect(result.resolvedPresentationContract?.semanticHash).toBeTruthy();
    expect(result.resolutionId).toBe(result.resolvedPresentationContract?.resolutionId);
    expect(JSON.stringify(result.resolvedPresentationContract)).not.toContain("resolvedFromLayer");
  });

  it("requires snapshot for MATCH_START", () => {
    const result = PresentationEngine.resolve({
      ...outdoorPreview("REQUIRED"),
      context: {
        ...outdoorPreview().context,
        resolutionMode: "MATCH_START",
      },
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.issues.some((i) => i.code === "SNAPSHOT_REQUIRED")).toBe(true);
    expect(result.resolvedPresentationContract).toBeNull();
  });

  it("is deterministic excluding durationMs", () => {
    const a = PresentationEngine.resolve(outdoorPreview("REQUIRED"));
    const b = PresentationEngine.resolve(outdoorPreview("REQUIRED"));
    expect(a.resolvedPresentationContract?.semanticHash).toBe(
      b.resolvedPresentationContract?.semanticHash,
    );
    expect(a.resolutionId).toBe(b.resolutionId);
    expect(a.diagnostics.issues).toEqual(b.diagnostics.issues);
  });

  it("rejects unknown override definitions structurally", () => {
    const result = PresentationEngine.resolve({
      ...outdoorPreview(),
      context: {
        ...outdoorPreview().context,
        tournamentOverrideRef: { id: "ovr", version: "1.0.0" },
      },
      overrideDocuments: {
        "ovr@1.0.0": { values: { "not.a.real.definition": true } },
      },
    });
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.issues.some((i) => i.code === "OVERRIDE_UNKNOWN_DEFINITION"),
    ).toBe(true);
    expect(result.resolvedPresentationSnapshot).toBeNull();
  });
});

describe("CapabilityCompiler.adapt", () => {
  it("omits unsupported optional features without substituting", () => {
    const resolved = PresentationEngine.resolve(outdoorPreview("REQUIRED"));
    expect(resolved.ok).toBe(true);
    const contract = resolved.resolvedPresentationContract!;
    const adapted = CapabilityCompiler.adapt(contract, "capability.mobile.v1", "1.0.0");
    expect(adapted.ok).toBe(true);
    expect(adapted.adaptationHash).toBeTruthy();
    const ticker = adapted.adaptedPresentationContract?.features.find(
      (f) => f.featureId === "presentation.feature.ticker",
    );
    expect(ticker?.state).toBe("disabled");
    expect(ticker?.reasonCode).toBe("CAPABILITY_OMIT");
    expect(adapted.adaptedPresentationContract?.disabledByCapability).toContain(
      "presentation.feature.ticker",
    );
  });

  it("fails for unknown capability profile", () => {
    const resolved = PresentationEngine.resolve(outdoorPreview("REQUIRED"));
    const adapted = CapabilityCompiler.adapt(
      resolved.resolvedPresentationContract!,
      "capability.does.not.exist",
    );
    expect(adapted.ok).toBe(false);
    expect(adapted.diagnostics.issues.some((i) => i.code === "UNKNOWN_CAPABILITY_PROFILE")).toBe(
      true,
    );
  });
});
