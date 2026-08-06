/**
 * EPIC-12 Phase 1 — Presentation Engine Consumer Cutover tests.
 * Proves: sole resolve at Prepare, PresentationExecutionPolicy, compatibility paint,
 * Match Start verify-only, Snapshot refs-only, legacy LED/OBS DTO shape.
 */
import { describe, expect, it, vi } from "vitest";
import {
  PresentationEngine,
  buildPreparePresentationEngineInput,
  buildPresentationExecutionPolicy,
  buildPresentationResolutionPrepMetadata,
  presentationEngineResultOk,
  projectPresentationExecutionPolicyToPaintJson,
  verifyPresentationMatchStartContract,
} from "../index.ts";
import {
  resolvePrepareCatalogBindings,
} from "../../rule-engine/index.ts";
import {
  buildRuntimeSnapshot,
  buildSnapshotReferences,
} from "../../runtime-match/index.ts";

const CORPORATE_BOX = {
  sportId: "cricket",
  variantId: "cricket.box",
  competitionTypeId: "auction",
  ruleProfileId: "cricket.box.corporate_standard",
  ruleProfileVersion: "1.0.0",
  presentationProfileId: "presentation.cricket.corporate_box",
  presentationProfileVersion: "1.0.0",
} as const;

function corporateBoxSnapshot(matchId = "42") {
  const bindings = resolvePrepareCatalogBindings(CORPORATE_BOX);
  return buildRuntimeSnapshot({
    matchId,
    tournamentId: 7,
    snapshotVersion: 1,
    createdAt: "2026-08-06T12:00:00.000Z",
    createdBy: "test",
    references: buildSnapshotReferences({
      matchId,
      ruleProfileId: bindings.ruleProfileId,
      ruleProfileVersion: bindings.ruleProfileVersion,
      presentationProfileId: bindings.presentationProfileId,
      presentationProfileVersion: bindings.presentationProfileVersion,
      competitionId: "7",
      competitionVersion: 1,
      matchConfigurationVersion: 1,
      sideIds: [{ id: "side_a" }, { id: "side_b" }],
    }),
  });
}

describe("EPIC-12 Phase 1 — Runtime Prepare → Presentation Engine cutover", () => {
  it("Corporate Box: PresentationEngine.resolve(PREPARE) once → Policy → paint JSON", () => {
    const snapshot = corporateBoxSnapshot();
    const bindings = resolvePrepareCatalogBindings(CORPORATE_BOX);
    const input = buildPreparePresentationEngineInput(snapshot, {
      sportId: bindings.sportId,
      variantId: bindings.variantId,
      competitionTypeId: bindings.competitionTypeId,
      presentationProfileId: bindings.presentationProfileId,
      presentationProfileVersion: bindings.presentationProfileVersion,
      ruleProfileId: bindings.ruleProfileId,
      ruleProfileVersion: bindings.ruleProfileVersion,
    });

    const spy = vi.spyOn(PresentationEngine, "resolve");
    const result = PresentationEngine.resolve(input);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();

    expect(presentationEngineResultOk(result)).toBe(true);
    expect(result.resolvedPresentationContract).not.toBeNull();
    expect(input.context.resolutionMode).toBe("PREPARE");
    expect(input.compilationMode).toBe("REQUIRED");

    const policy = buildPresentationExecutionPolicy(result.resolvedPresentationContract!);
    expect(policy.presentationResolutionId).toBe(
      result.resolvedPresentationContract!.resolutionId,
    );
    expect(policy.presentationHash).toBe(result.resolvedPresentationContract!.semanticHash);
    expect(policy.presentationVersion).toBe(
      result.resolvedPresentationContract!.presentationContractVersion,
    );
    expect(policy.sportId).toBe("cricket");
    expect(policy.features.some((f) => f.featureId === "presentation.feature.sponsor_strip")).toBe(
      true,
    );

    const paint = projectPresentationExecutionPolicyToPaintJson(policy);
    expect(paint.source).toBe("presentation_execution_policy");
    expect(paint.displayThemeId).toBe("stadium-gold");
    expect(paint.broadcastTheme).toBe("gold");
    expect(paint.accentColor).toBe("#FFD700");
    expect(paint.safeAreaBottomPx).toBe(12);
    expect(paint.sponsorStripEnabled).toBe(true);
    expect(paint.presentationResolutionId).toBe(policy.presentationResolutionId);
  });

  it("PresentationEngine.resolve executes exactly once for a Prepare cycle (no Match Start resolve)", () => {
    const snapshot = corporateBoxSnapshot("99");
    const bindings = resolvePrepareCatalogBindings(CORPORATE_BOX);
    const prepareInput = buildPreparePresentationEngineInput(snapshot, {
      sportId: bindings.sportId,
      variantId: bindings.variantId,
      competitionTypeId: bindings.competitionTypeId,
      presentationProfileId: bindings.presentationProfileId,
      presentationProfileVersion: bindings.presentationProfileVersion,
    });

    const spy = vi.spyOn(PresentationEngine, "resolve");
    const prepareResult = PresentationEngine.resolve(prepareInput);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(prepareResult.ok).toBe(true);

    const policy = buildPresentationExecutionPolicy(
      prepareResult.resolvedPresentationContract!,
    );
    const metadata = buildPresentationResolutionPrepMetadata({
      presentationResolutionId: policy.presentationResolutionId,
      presentationHash: policy.presentationHash,
      presentationVersion: policy.presentationVersion,
      snapshotVersion: 1,
    });
    const verified = verifyPresentationMatchStartContract({
      currentRuntimeVersion: 1,
      runtimePrepMetadata: metadata,
    });
    expect(verified.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("Runtime Prepare is mandatory — Match Start fails without presentation bind", () => {
    const missing = verifyPresentationMatchStartContract({
      currentRuntimeVersion: null,
      runtimePrepMetadata: null,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("RUNTIME_PREPARE_REQUIRED");

    const noPresentation = verifyPresentationMatchStartContract({
      currentRuntimeVersion: 1,
      runtimePrepMetadata: { ruleResolution: { resolutionId: "r" } },
    });
    expect(noPresentation.ok).toBe(false);
  });

  it("prep metadata stores identity only — never contract / policy / paint bodies", () => {
    const metadata = buildPresentationResolutionPrepMetadata(
      {
        presentationResolutionId: "pres_1",
        presentationHash: "hash_1",
        presentationVersion: "1.0.0",
        snapshotVersion: 2,
      },
      {
        resolvedPresentationContract: { should: "strip" },
        presentationExecutionPolicy: { should: "strip" },
        presentationPaintJson: { should: "strip" },
        brandingJson: { should: "strip" },
      },
    );
    expect(metadata.presentationResolution).toEqual({
      presentationResolutionId: "pres_1",
      presentationHash: "hash_1",
      presentationVersion: "1.0.0",
      snapshotVersion: 2,
    });
    expect(metadata.resolvedPresentationContract).toBeUndefined();
    expect(metadata.presentationExecutionPolicy).toBeUndefined();
    expect(metadata.presentationPaintJson).toBeUndefined();
    expect(metadata.brandingJson).toBeUndefined();
  });

  it("Runtime Snapshot remains refs-only (presentationProfile FrozenRef, no contract body)", () => {
    const snapshot = corporateBoxSnapshot("snap");
    expect(snapshot.references.presentationProfile).toEqual({
      id: "presentation.cricket.corporate_box",
      version: "1.0.0",
    });
    const encoded = JSON.stringify(snapshot);
    expect(encoded).not.toContain("ResolvedPresentationContract");
    expect(encoded).not.toContain("presentation_execution_policy");
    expect(encoded).not.toContain("stadium-gold");
    expect(encoded).not.toContain("semanticHash");
  });

  it("legacy LED/OBS DTO shape is valid for existing theme consumers", () => {
    const snapshot = corporateBoxSnapshot("led");
    const bindings = resolvePrepareCatalogBindings(CORPORATE_BOX);
    const result = PresentationEngine.resolve(
      buildPreparePresentationEngineInput(snapshot, {
        sportId: bindings.sportId,
        variantId: bindings.variantId,
        competitionTypeId: bindings.competitionTypeId,
        presentationProfileId: bindings.presentationProfileId,
        presentationProfileVersion: bindings.presentationProfileVersion,
      }),
    );
    const paint = projectPresentationExecutionPolicyToPaintJson(
      buildPresentationExecutionPolicy(result.resolvedPresentationContract!),
    );

    // LED DisplayThemeName
    expect(["stadium-gold", "royal-sapphire", "emerald-cup", "crimson-final"]).toContain(
      paint.displayThemeId,
    );
    // OBS BroadcastTheme
    expect(["gold", "crimson", "premium-dark"]).toContain(paint.broadcastTheme);
    // Safe area matches existing sponsor ticker constant
    expect(paint.safeAreaBottomPx).toBe(12);
  });
});
