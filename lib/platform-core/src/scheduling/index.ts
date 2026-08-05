/**
 * Scheduling Product Layer (EPIC-07).
 * Import from `@workspace/platform-core/scheduling`.
 * Public APIs must speak Identity / Configuration / Slots / Resource Assignments /
 * Validation / History — never runtime scheduling tables or algorithms.
 */

export {
  resolveSchedulingConfiguration,
  resolvePlanKindId,
  mergeSchedulingConfigBlob,
  type DrawSchedulingRuntimeColumns,
  type SchedulingConfigBlob,
} from "./configuration.ts";
export {
  mapDrawToSchedulingIdentity,
  mapDrawToSchedulingConfiguration,
  mapDrawToSchedulingLifecycle,
  mapBadmintonFixturesToSchedule,
  mapScoringFixturesToSchedule,
  mapBadmintonCourtsToResourceRefs,
  mapScoringVenuesToResourceRefs,
  type BadmintonCourtBridgeRow,
  type BadmintonFixtureScheduleRow,
  type ScoringVenueBridgeRow,
  type ScoringFixtureScheduleRow,
} from "./bridges.ts";
export {
  validateScheduling,
  type CompetitionStateForScheduling,
  type FixtureStateForScheduling,
  type SchedulingValidationContext,
} from "./validation.ts";
export { buildSchedulingConfigurationHistoryPayload } from "./plan.ts";
export {
  isValidSchedulingLifecycleTransition,
  lifecycleAfterSchedulingLock,
  resolveSchedulingLifecycle,
} from "./lifecycle.ts";
export { encodeSchedulingId, parseSchedulingId } from "./ids.ts";
export {
  SCHEDULING_CONFIGURATION_SCHEMA_VERSION,
  SCHEDULING_LIFECYCLE_ORDER,
  type ResourceAssignment,
  type ResourceKindId,
  type ScheduleSlot,
  type SchedulingConfiguration,
  type SchedulingConfigurationHistoryEntry,
  type SchedulingConfigurationHistoryPayload,
  type SchedulingIdentity,
  type SchedulingLifecycle,
  type SchedulingLifecycleStatusId,
  type SchedulingPlanKindId,
  type SchedulingReadiness,
  type SchedulingResourceRef,
  type SchedulingSource,
  type SchedulingStrategyId,
  type SchedulingValidationResult,
  type ValidationIssue,
} from "./types.ts";
