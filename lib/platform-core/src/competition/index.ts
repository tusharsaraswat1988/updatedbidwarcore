/**
 * Competition Product Layer (EPIC-03).
 * Import from `@workspace/platform-core/competition`.
 * Public APIs must speak Plan / Configuration / Participants / Validation — never runtime tables.
 */

export {
  resolveCompetitionConfiguration,
  type TournamentCompetitionColumns,
} from "./configuration.ts";
export { buildCompetitionPlanPayload } from "./plan.ts";
export {
  CRICKET_KEY_RULE_OVERRIDE_IDS,
  parseRuleOverrides,
  sparseRuleOverrides,
  validateCricketKeyRuleOverrides,
  type CricketKeyRuleOverrideId,
  type RuleOverridesDocument,
} from "./rule-overrides.ts";
export { resolveTransitionRequest } from "./transition-rules.ts";
export {
  validateCompetitionConfiguration,
  buildCompetitionStatus,
} from "./validation.ts";
export {
  mapAuctionPlayersToParticipants,
  mapBadmintonRegistrationsToParticipants,
  type AuctionPlayerRow,
  type BadmintonRegistrationRow,
} from "./participant-bridges.ts";
export {
  COMPETITION_PLAN_SCHEMA_VERSION,
  TRANSITION_POLICY_VERSION,
  type CompetitionAggregate,
  type CompetitionConfiguration,
  type CompetitionPlan,
  type CompetitionPlanPayload,
  type CompetitionReadiness,
  type CompetitionStatus,
  type CompetitionValidationResult,
  type Participant,
  type ParticipantConstraints,
  type ParticipantKindId,
  type RegistrationStatusId,
  type SquadRules,
  type TournamentTransitionRequest,
  type ValidationIssue,
  type ValidationSeverity,
} from "./types.ts";
