/**
 * Assemble PresentationEngineInput for Runtime Prepare — caller-side only.
 * Forbidden: DB loads inside Presentation Engine. Parts must already be resolved.
 */

import type { RuntimeSnapshot } from "../runtime-match/types.ts";
import { buildPresentationResolutionContextFromParts } from "./context-builder.ts";
import type { PresentationEngineInput } from "./types.ts";
import { PRESENTATION_ENGINE_INPUT_VERSION } from "./versions.ts";

export type PreparePresentationBindings = {
  sportId: string;
  variantId: string;
  competitionTypeId: string;
  presentationProfileId: string;
  presentationProfileVersion: string;
  ruleProfileId?: string | null;
  ruleProfileVersion?: string | null;
};

/**
 * Build PresentationEngineInput for PREPARE against an already-built Runtime Snapshot.
 * Snapshot presentationProfile ref MUST match context.presentationProfile (verified by engine).
 */
export function buildPreparePresentationEngineInput(
  snapshot: RuntimeSnapshot,
  bindings: PreparePresentationBindings,
): PresentationEngineInput {
  const context = buildPresentationResolutionContextFromParts({
    sportId: bindings.sportId,
    variantId: bindings.variantId,
    competitionTypeId: bindings.competitionTypeId,
    presentationProfile: {
      id: bindings.presentationProfileId,
      version: bindings.presentationProfileVersion,
    },
    ruleProfile:
      bindings.ruleProfileId && bindings.ruleProfileVersion
        ? { id: bindings.ruleProfileId, version: bindings.ruleProfileVersion }
        : undefined,
    resolutionMode: "PREPARE",
  });

  return {
    inputVersion: PRESENTATION_ENGINE_INPUT_VERSION,
    snapshot,
    context,
    // PREPARE requires compiled contract for PresentationExecutionPolicy.
    compilationMode: "REQUIRED",
  };
}
