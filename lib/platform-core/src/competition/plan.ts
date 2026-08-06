import type { CompetitionConfiguration, CompetitionPlanPayload, CompetitionValidationResult } from "./types.ts";
import {
  COMPETITION_PLAN_SCHEMA_VERSION,
  TRANSITION_POLICY_VERSION,
} from "./types.ts";

/** Build immutable Competition Plan payload from Working Configuration + Validation Result. */
export function buildCompetitionPlanPayload(
  config: CompetitionConfiguration,
  validation: CompetitionValidationResult,
  frozenAt: string = new Date().toISOString(),
): CompetitionPlanPayload {
  return {
    schemaVersion: COMPETITION_PLAN_SCHEMA_VERSION,
    policyVersion: TRANSITION_POLICY_VERSION,
    sportId: config.sportId,
    variantId: config.variantId,
    competitionTypeId: config.competitionTypeId,
    registrationModeId: config.registrationModeId,
    teamFormationStrategyId: config.teamFormationStrategyId,
    squadRules: { ...config.squadRules },
    participantConstraints: {
      ...config.participantConstraints,
      allowedKindIds: config.participantConstraints.allowedKindIds
        ? [...config.participantConstraints.allowedKindIds]
        : undefined,
    },
    ruleProfileId: config.ruleProfileId,
    ruleProfileVersion: config.ruleProfileVersion,
    presentationProfileId: config.presentationProfileId,
    presentationProfileVersion: config.presentationProfileVersion,
    businessStageId: "configuration_locked",
    validationSummary: {
      errorCount: validation.errorCount,
      warningCount: validation.warningCount,
      infoCount: validation.infoCount,
      issues: validation.issues,
    },
    frozenAt,
  };
}
