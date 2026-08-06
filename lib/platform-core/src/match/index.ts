/**
 * Match Product Layer (EPIC-05).
 * Import from `@workspace/platform-core/match`.
 * Public APIs must speak Identity / Configuration / Sides / Officials / Validation / History —
 * never runtime match tables.
 */

export {
  resolveMatchConfiguration,
  type ScoringMatchRuntimeColumns,
} from "./configuration.ts";
export {
  mapScoringMatchToIdentity,
  mapScoringMatchToConfiguration,
  mapScoringMatchToLifecycle,
  mapScoringMatchToSides,
  mapScoringMatchToOfficials,
  type ScoringMatchBridgeRow,
  type SideSubjectHint,
  type OfficialSignal,
} from "./bridges.ts";
export {
  validateMatch,
  type CompetitionStateForMatch,
} from "./validation.ts";
export { buildMatchConfigurationHistoryPayload } from "./plan.ts";
export {
  isValidMatchLifecycleTransition,
  lifecycleAfterMatchLock,
  resolveMatchLifecycle,
} from "./lifecycle.ts";
export {
  DEFAULT_MATCH_SIDE_SLOTS,
  MATCH_SIDE_IDS,
  emptyMatchSide,
  matchSideHasSubject,
  matchSideWithSubject,
  type MatchSideId,
} from "./sides.ts";
export {
  MATCH_CONFIGURATION_SCHEMA_VERSION,
  MATCH_LIFECYCLE_ORDER,
  type MatchBranding,
  type MatchConfiguration,
  type MatchConfigurationHistoryEntry,
  type MatchConfigurationHistoryPayload,
  type MatchIdentity,
  type MatchLifecycle,
  type MatchLifecycleStatusId,
  type MatchOfficial,
  type MatchReadiness,
  type MatchSide,
  type MatchSideSlotId,
  type MatchSideSubject,
  type MatchTypeId,
  type MatchValidationResult,
  type MatchVisibilityId,
  type ValidationIssue,
} from "./types.ts";
