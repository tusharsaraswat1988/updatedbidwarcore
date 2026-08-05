/**
 * Team Product Layer (EPIC-04).
 * Import from `@workspace/platform-core/team`.
 * Public APIs must speak Identity / Configuration / Members / Validation / History —
 * never runtime team tables.
 */

export {
  resolveTeamConfiguration,
  type AuctionTeamRuntimeColumns,
} from "./configuration.ts";
export {
  mapAuctionTeamToIdentity,
  mapAuctionTeamToConfiguration,
  mapAuctionSignalsToMembers,
  mapMasterTeamBrandingHint,
  type AuctionTeamBridgeRow,
  type AuctionTeamMemberSignal,
  type MasterTeamBrandingHint,
} from "./bridges.ts";
export { validateTeam } from "./validation.ts";
export { buildTeamConfigurationHistoryPayload } from "./plan.ts";
export {
  isValidLifecycleTransition,
  lifecycleAfterLock,
} from "./lifecycle.ts";
export {
  TEAM_CONFIGURATION_SCHEMA_VERSION,
  TEAM_LIFECYCLE_ORDER,
  type TeamBranding,
  type TeamConfiguration,
  type TeamConfigurationHistoryEntry,
  type TeamConfigurationHistoryPayload,
  type TeamIdentity,
  type TeamLifecycleStatusId,
  type TeamMember,
  type TeamMemberParticipantRef,
  type TeamMemberStatusId,
  type TeamReadiness,
  type TeamTheme,
  type TeamTypeId,
  type TeamValidationResult,
  type TeamVisibilityId,
  type ValidationIssue,
} from "./types.ts";
