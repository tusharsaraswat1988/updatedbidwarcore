import type { ValidationIssue, ValidationSeverity } from "../catalog/resolve/types.ts";
import type { Participant, ParticipantKindId, SquadRules } from "../competition/types.ts";

export type TeamTypeId = "competitive" | "practice" | "selection" | "temporary" | string;

export type TeamLifecycleStatusId =
  | "draft"
  | "building"
  | "ready"
  | "locked"
  | "active"
  | "completed"
  | "archived";

export type TeamVisibilityId = "public" | "tournament" | "private" | string;

export type TeamMemberStatusId = "active" | "inactive" | "invited" | string;

export type TeamBranding = {
  primaryColor: string | null;
  secondaryColor: string | null;
  logoUrl: string | null;
};

export type TeamTheme = {
  accentColor?: string | null;
  [key: string]: unknown;
};

/** Stable platform identity — independent of members. */
export type TeamIdentity = {
  id: string;
  tournamentId: number;
  typeId: TeamTypeId;
  masterTeamId: string | null;
};

/**
 * Working Team Configuration.
 * Never includes Captain / Vice Captain / Owner — those are membership roles.
 */
export type TeamConfiguration = {
  teamId: string;
  tournamentId: number;
  name: string;
  displayName: string;
  shortName: string;
  logoUrl: string | null;
  branding: TeamBranding;
  visibility: TeamVisibilityId;
  typeId: TeamTypeId;
  status: TeamLifecycleStatusId;
  theme: TeamTheme;
  locked: boolean;
  planVersion: number | null;
};

/** Locked configuration payload (history only — never roster). */
export type TeamConfigurationHistoryPayload = {
  schemaVersion: string;
  name: string;
  displayName: string;
  shortName: string;
  logoUrl: string | null;
  branding: TeamBranding;
  visibility: TeamVisibilityId;
  typeId: TeamTypeId;
  status: TeamLifecycleStatusId;
  theme: TeamTheme;
  validationSummary: {
    errorCount: number;
    warningCount: number;
    infoCount: number;
    issues: readonly ValidationIssue[];
  };
  frozenAt: string;
};

export type TeamConfigurationHistoryEntry = {
  teamId: string;
  tournamentId: number;
  version: number;
  payload: TeamConfigurationHistoryPayload;
  frozenAt: string;
  frozenBy: string | null;
};

/** Participant reference on a member — never runtime assignment ids. */
export type TeamMemberParticipantRef = {
  id: string;
  kind: ParticipantKindId;
  displayName: string;
};

export type TeamMember = {
  participant: TeamMemberParticipantRef;
  roleId: string;
  status: TeamMemberStatusId;
};

export type TeamValidationResult = {
  issues: readonly ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  readiness: "ready" | "almost_ready" | "not_ready";
};

export type TeamReadiness = TeamValidationResult["readiness"];

export const TEAM_CONFIGURATION_SCHEMA_VERSION = "1.0.0";

export const TEAM_LIFECYCLE_ORDER: readonly TeamLifecycleStatusId[] = [
  "draft",
  "building",
  "ready",
  "locked",
  "active",
  "completed",
  "archived",
] as const;

export type { Participant, SquadRules, ValidationIssue, ValidationSeverity };
