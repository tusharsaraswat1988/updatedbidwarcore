/**
 * Runtime Match Product Layer (EPIC-08).
 * Import from `@workspace/platform-core/runtime-match`.
 *
 * Runtime Match = Match Identity (EPIC-05) + Execution Contract.
 * Public APIs: Identity, Snapshot, Context, Execution Phase, Validation, History.
 * Never scoring, broadcast, statistics, or sport runtime storage shapes.
 */

export {
  mapRowToRuntimeIdentity,
  mapRowToExecutionPhaseState,
  mapRowToRuntimeListItem,
  runtimeSourceFromSportSlug,
  type ScoringMatchRuntimeBridgeRow,
} from "./bridges.ts";
export {
  buildRuntimeContextFromSnapshot,
  contextHasForbiddenExecutionState,
} from "./context.ts";
export {
  isPhaseAllowedForLifecycle,
  isValidExecutionPhaseTransition,
  resolveExecutionPhase,
  requestedLifecycleForPhase,
} from "./phase.ts";
export {
  buildRuntimeHistoryEntry,
  buildFreezeHistoryPayload,
} from "./plan.ts";
export {
  assertSnapshotImmutable,
  buildRuntimeSnapshot,
  buildSnapshotReferences,
  type SnapshotRefInput,
} from "./snapshot.ts";
export {
  validateRuntimeMatch,
  type CompetitionStateForRuntime,
  type FixtureStateForRuntime,
  type MatchConfigStateForRuntime,
  type SchedulingStateForRuntime,
} from "./validation.ts";
export {
  EXECUTION_PHASE_ORDER,
  RUNTIME_SNAPSHOT_SCHEMA_VERSION,
  type ExecutionPhaseId,
  type ExecutionPhaseState,
  type FrozenRef,
  type MatchIdentity,
  type RuntimeContext,
  type RuntimeHistoryEntry,
  type RuntimeHistoryOperation,
  type RuntimeMatchListItem,
  type RuntimeSnapshot,
  type RuntimeSnapshotReferences,
  type RuntimeValidationResult,
  type ValidationIssue,
} from "./types.ts";
