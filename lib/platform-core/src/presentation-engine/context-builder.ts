import type { FrozenRef } from "../runtime-match/types.ts";
import type {
  PresentationResolutionContext,
  PresentationResolutionMode,
} from "./types.ts";

export type PresentationResolutionContextParts = {
  sportId: string;
  variantId: string;
  competitionTypeId: string;
  presentationProfile: FrozenRef;
  matchTypeId?: string;
  ruleProfile?: FrozenRef;
  tournamentOverrideRef?: FrozenRef;
  competitionOverrideRef?: FrozenRef;
  matchOverrideRef?: FrozenRef;
  resolutionMode: PresentationResolutionMode;
};

/**
 * Pure helper — assemble serializable PresentationResolutionContext from already-loaded parts.
 * Forbidden: loading from matchId / database inside the Presentation Engine.
 */
export function buildPresentationResolutionContextFromParts(
  parts: PresentationResolutionContextParts,
): PresentationResolutionContext {
  return Object.freeze({
    sportId: parts.sportId,
    variantId: parts.variantId,
    competitionTypeId: parts.competitionTypeId,
    matchTypeId: parts.matchTypeId,
    presentationProfile: Object.freeze({ ...parts.presentationProfile }),
    ruleProfile: parts.ruleProfile ? Object.freeze({ ...parts.ruleProfile }) : undefined,
    tournamentOverrideRef: parts.tournamentOverrideRef
      ? Object.freeze({ ...parts.tournamentOverrideRef })
      : undefined,
    competitionOverrideRef: parts.competitionOverrideRef
      ? Object.freeze({ ...parts.competitionOverrideRef })
      : undefined,
    matchOverrideRef: parts.matchOverrideRef
      ? Object.freeze({ ...parts.matchOverrideRef })
      : undefined,
    resolutionMode: parts.resolutionMode,
  });
}
