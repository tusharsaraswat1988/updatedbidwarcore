import type { ValidationIssue, ValidationSeverity } from "../catalog/resolve/types.ts";

export type ParticipantKindId = "individual" | "team" | "organization" | "mixed" | "guest";

export type RegistrationStatusId =
  | "applied"
  | "pending_payment"
  | "pending_verification"
  | "verified"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "cancelled";

export type SquadRules = {
  minPlayers?: number | null;
  maxPlayers?: number | null;
  substitutes?: number | null;
  retentions?: number | null;
  lockedPlayers?: number | null;
  reservePlayers?: number | null;
};

export type ParticipantConstraints = {
  allowedKindIds?: readonly ParticipantKindId[];
  minParticipants?: number | null;
  maxParticipants?: number | null;
};

/** Working Competition Configuration (resolve-on-read product view). */
export type CompetitionConfiguration = {
  tournamentId: number;
  sportId: string;
  variantId: string | null;
  competitionTypeId: string | null;
  ruleProfileId: string | null;
  ruleProfileVersion: string | null;
  presentationProfileId: string | null;
  presentationProfileVersion: string | null;
  registrationModeId: string | null;
  teamFormationStrategyId: string | null;
  squadRules: SquadRules;
  participantConstraints: ParticipantConstraints;
  businessStageId: string;
  locked: boolean;
  planVersion: number | null;
};

/** Locked Competition Plan payload (history snapshot). */
export type CompetitionPlanPayload = {
  schemaVersion: string;
  policyVersion: string;
  sportId: string;
  variantId: string | null;
  competitionTypeId: string | null;
  registrationModeId: string | null;
  teamFormationStrategyId: string | null;
  squadRules: SquadRules;
  participantConstraints: ParticipantConstraints;
  ruleProfileId: string | null;
  ruleProfileVersion: string | null;
  presentationProfileId: string | null;
  presentationProfileVersion: string | null;
  businessStageId: string;
  validationSummary: {
    errorCount: number;
    warningCount: number;
    infoCount: number;
    issues: readonly ValidationIssue[];
  };
  frozenAt: string;
};

export type CompetitionPlan = {
  tournamentId: number;
  version: number;
  payload: CompetitionPlanPayload;
  frozenAt: string;
  frozenBy: string | null;
};

export type CompetitionReadiness =
  | "ready"
  | "almost_ready"
  | "not_ready";

export type CompetitionStatus = {
  readiness: CompetitionReadiness;
  businessStageId: string;
  locked: boolean;
  blockingIssueCount: number;
  warningCount: number;
  recommendations: readonly string[];
};

export type CompetitionValidationResult = {
  issues: readonly ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  readiness: CompetitionReadiness;
};

export type TournamentTransitionRequest = {
  requestedTournamentState: string | null;
  reason: string;
  policyId: string;
};

export type ParticipantRegistrationSummary = {
  id: string;
  status: RegistrationStatusId | string;
};

/** Platform Participant view — never a DB table. */
export type Participant = {
  id: string;
  kind: ParticipantKindId;
  displayName: string;
  sportId: string;
  registration: ParticipantRegistrationSummary | null;
  eligibility: {
    eligible: boolean;
    reasons: readonly string[];
  };
};

export type CompetitionAggregate = {
  configuration: CompetitionConfiguration;
  plan: CompetitionPlan | null;
  validation: CompetitionValidationResult;
  summary: {
    status: CompetitionStatus;
    participantCount: number;
  };
};

export type { ValidationIssue, ValidationSeverity };

export const COMPETITION_PLAN_SCHEMA_VERSION = "1.0.0";
export const TRANSITION_POLICY_VERSION = "1.0.0";
