import { PresentationEngine } from "../../presentation-engine/engine.ts";
import { PRESENTATION_ENGINE_INPUT_VERSION } from "../../presentation-engine/versions.ts";
import type {
  PresentationEngineInput,
  PresentationEngineResult,
  PresentationOverrideDocument,
  PresentationResolutionMode,
} from "../../presentation-engine/types.ts";

export type PresentationResolveContext = {
  sportId: string;
  variantId: string;
  competitionTypeId: string;
  profileId: string;
  profileVersion: string;
  matchTypeId?: string;
  resolutionMode?: PresentationResolutionMode | "PREVIEW" | "VALIDATE";
  tournamentOverrides?: { values: Readonly<Record<string, unknown>> };
  matchOverrides?: { values: Readonly<Record<string, unknown>> };
};

/**
 * Map catalog presentation preview/validate context → PresentationEngineInput.
 * CatalogRegistry owns discovery; Presentation Engine owns computation.
 */
export function presentationContextToEngineInput(
  ctx: PresentationResolveContext,
  mode: "PREVIEW" | "VALIDATE",
): PresentationEngineInput {
  const overrideDocuments: Record<string, PresentationOverrideDocument> = {};
  let tournamentOverrideRef: { id: string; version: string } | undefined;
  let matchOverrideRef: { id: string; version: string } | undefined;

  if (ctx.tournamentOverrides?.values) {
    tournamentOverrideRef = { id: "__inline_tournament__", version: "1.0.0" };
    overrideDocuments["__inline_tournament__@1.0.0"] = {
      values: ctx.tournamentOverrides.values as PresentationOverrideDocument["values"],
    };
  }
  if (ctx.matchOverrides?.values) {
    matchOverrideRef = { id: "__inline_match__", version: "1.0.0" };
    overrideDocuments["__inline_match__@1.0.0"] = {
      values: ctx.matchOverrides.values as PresentationOverrideDocument["values"],
    };
  }

  return {
    inputVersion: PRESENTATION_ENGINE_INPUT_VERSION,
    snapshot: null,
    context: {
      sportId: ctx.sportId,
      variantId: ctx.variantId,
      competitionTypeId: ctx.competitionTypeId,
      matchTypeId: ctx.matchTypeId,
      presentationProfile: { id: ctx.profileId, version: ctx.profileVersion },
      tournamentOverrideRef,
      matchOverrideRef,
      resolutionMode: mode,
    },
    overrideDocuments,
    compilationMode: "NONE",
  };
}

/**
 * EPIC-02/10 façade — permanently delegates computation to PresentationEngine.resolve().
 * Organizer preview/validate always use PREVIEW/VALIDATE modes (forced).
 */
export function resolvePresentationProfile(
  ctx: PresentationResolveContext,
): PresentationEngineResult {
  const mode =
    ctx.resolutionMode === "VALIDATE" || ctx.resolutionMode === "MIGRATION"
      ? "VALIDATE"
      : "PREVIEW";
  return PresentationEngine.resolve(presentationContextToEngineInput(ctx, mode));
}

export function presentationResolveResultOk(result: PresentationEngineResult): boolean {
  return result.ok;
}
