import type { ValidationIssue, ValidationSeverity } from "../catalog/resolve/types.ts";
import type { ParticipantKindId } from "../competition/types.ts";

export type MatchTypeId =
  | "league"
  | "knockout"
  | "practice"
  | "friendly"
  | "exhibition"
  | "custom"
  | string;

export type MatchLifecycleStatusId =
  | "draft"
  | "scheduled"
  | "ready"
  | "locked"
  | "live"
  | "completed"
  | "verified"
  | "archived";

export type MatchVisibilityId = "public" | "tournament" | "private" | string;

export type MatchSideSlotId = "side_a" | "side_b" | string;

export type MatchBranding = {
  primaryColor: string | null;
  secondaryColor: string | null;
  logoUrl: string | null;
};

/** Stable platform identity — independent of sides, schedule, venue, officials. */
export type MatchIdentity = {
  id: string;
  tournamentId: number;
  typeId: MatchTypeId;
};

/**
 * Working Match Configuration.
 * Never includes lifecycle status, officials, or presentation side labels.
 */
export type MatchConfiguration = {
  matchId: string;
  tournamentId: number;
  name: string;
  displayName: string;
  typeId: MatchTypeId;
  venue: string | null;
  surface: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  visibility: MatchVisibilityId;
  branding: MatchBranding;
  locked: boolean;
  planVersion: number | null;
};

/** Lifecycle is a separate module — not part of Configuration. */
export type MatchLifecycle = {
  matchId: string;
  tournamentId: number;
  status: MatchLifecycleStatusId;
  locked: boolean;
};

export type MatchConfigurationHistoryPayload = {
  schemaVersion: string;
  name: string;
  displayName: string;
  typeId: MatchTypeId;
  venue: string | null;
  surface: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  visibility: MatchVisibilityId;
  branding: MatchBranding;
  validationSummary: {
    errorCount: number;
    warningCount: number;
    infoCount: number;
    issues: readonly ValidationIssue[];
  };
  frozenAt: string;
};

export type MatchConfigurationHistoryEntry = {
  matchId: string;
  tournamentId: number;
  version: number;
  payload: MatchConfigurationHistoryPayload;
  frozenAt: string;
  frozenBy: string | null;
};

/**
 * Subject attached to a Match Side — Team Identity or Participant.
 * Never attached directly to Match Identity.
 */
export type MatchSideSubject =
  | {
      kind: "team";
      id: string;
      displayName: string;
    }
  | {
      kind: "participant";
      id: string;
      participantKind: ParticipantKindId;
      displayName: string;
    };

/**
 * Match Side — first-class contest slot.
 *
 * Match → Match Side → (Team | Participant) + Roles
 *
 * Examples of presentation mapping (later, not platform ids):
 * - Cricket: Team A / Team B
 * - Badminton singles: Player A / Player B
 * - Doubles: Pair A / Pair B
 * - Relay: Lane A / Lane B
 *
 * Platform ids stay side_a / side_b / … — never home/away.
 */
export type MatchSide = {
  sideId: MatchSideSlotId;
  subject: MatchSideSubject | null;
  roles: readonly string[];
};

/** Officials are Match Members — never Configuration. */
export type MatchOfficial = {
  participant: {
    id: string;
    kind: ParticipantKindId;
    displayName: string;
  };
  roleId: string;
  status: "active" | "inactive" | string;
};

export type MatchValidationResult = {
  issues: readonly ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  readiness: "ready" | "almost_ready" | "not_ready";
};

export type MatchReadiness = MatchValidationResult["readiness"];

export const MATCH_CONFIGURATION_SCHEMA_VERSION = "1.0.0";

export const MATCH_LIFECYCLE_ORDER: readonly MatchLifecycleStatusId[] = [
  "draft",
  "scheduled",
  "ready",
  "locked",
  "live",
  "completed",
  "verified",
  "archived",
] as const;

export type { ValidationIssue, ValidationSeverity };
