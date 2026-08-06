import type { FrozenRef } from "../runtime-match/types.ts";
import type { RuleResolutionContext, RuleResolutionMode } from "./types.ts";

export type RuleResolutionContextParts = {
  sportId: string;
  variantId: string;
  competitionTypeId: string;
  ruleProfile: FrozenRef;
  profileFamilyId?: string;
  tournamentOverrideRef?: FrozenRef;
  competitionOverrideRef?: FrozenRef;
  matchOverrideRef?: FrozenRef;
  resolutionMode: RuleResolutionMode;
};

/**
 * Pure helper — assemble serializable RuleResolutionContext from already-loaded parts.
 * Forbidden: loading from matchId / database inside the Rule Engine.
 */
export function buildRuleResolutionContextFromParts(
  parts: RuleResolutionContextParts,
): RuleResolutionContext {
  return Object.freeze({
    sportId: parts.sportId,
    variantId: parts.variantId,
    competitionTypeId: parts.competitionTypeId,
    ruleProfile: Object.freeze({ ...parts.ruleProfile }),
    profileFamilyId: parts.profileFamilyId ?? String(parts.ruleProfile.id),
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
