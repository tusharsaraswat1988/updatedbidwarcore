import type { ValidationIssue, ValidationSeverity } from "../catalog/resolve/types.ts";
import type { MatchIdentity, MatchLifecycleStatusId } from "../match/types.ts";

/** Linear Execution Phase — subordinate to EPIC-05 Match Lifecycle. */
export type ExecutionPhaseId =
  | "preparing"
  | "resources_ready"
  | "officials_ready"
  | "participants_ready"
  | "countdown"
  | "running"
  | "paused"
  | "finished"
  | string;

/** Frozen version reference — never "latest". */
export type FrozenRef = {
  id: string;
  version: number | string | null;
};

export type RuntimeSnapshotReferences = {
  ruleProfile: FrozenRef | null;
  presentationProfile: FrozenRef | null;
  competition: FrozenRef | null;
  fixture: FrozenRef | null;
  fixtureNode: FrozenRef | null;
  matchBlueprint: FrozenRef | null;
  schedulingPlan: FrozenRef | null;
  scheduleSlot: FrozenRef | null;
  resourceAssignments: readonly FrozenRef[];
  sides: readonly FrozenRef[];
  officials: readonly FrozenRef[];
  matchConfiguration: FrozenRef | null;
};

/**
 * Immutable Runtime Snapshot — self-describing.
 * References + frozen versions only; never product configuration copies.
 */
export type RuntimeSnapshot = {
  matchId: string;
  tournamentId: number;
  snapshotVersion: number;
  snapshotSchemaVersion: string;
  createdAt: string;
  createdBy: string | null;
  references: RuntimeSnapshotReferences;
};

/** Resolved bindings — constant for a frozen snapshot. Not execution progress. */
export type RuntimeContext = {
  matchId: string;
  tournamentId: number;
  snapshotVersion: number;
  ruleBinding: FrozenRef | null;
  presentationBinding: FrozenRef | null;
  schedulingBinding: FrozenRef | null;
  resourceAssignmentBindings: readonly FrozenRef[];
  executionMetadata: Record<string, unknown> | null;
};

export type ExecutionPhaseState = {
  matchId: string;
  tournamentId: number;
  phase: ExecutionPhaseId;
  /** Active snapshot version pointer — working field only. */
  currentRuntimeVersion: number | null;
};

export type RuntimeHistoryOperation =
  | "prepare"
  | "freeze_snapshot"
  | "phase_transition"
  | "ready_request"
  | "lifecycle_request"
  | string;

export type RuntimeHistoryEntry = {
  matchId: string;
  tournamentId: number;
  timestamp: string;
  actor: string | null;
  operation: RuntimeHistoryOperation;
  snapshotVersion: number | null;
  executionPhase: ExecutionPhaseId | null;
  reason: string | null;
  payload: Record<string, unknown> | null;
};

export type RuntimeValidationResult = {
  issues: readonly ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  readiness: "ready" | "almost_ready" | "not_ready";
};

export type RuntimeMatchListItem = {
  identity: MatchIdentity;
  executionPhase: ExecutionPhaseId;
  currentRuntimeVersion: number | null;
  matchLifecycleStatus: MatchLifecycleStatusId;
};

export const RUNTIME_SNAPSHOT_SCHEMA_VERSION = "1.0.0";

/** Linear phase order. Paused may return to Running. */
export const EXECUTION_PHASE_ORDER: readonly ExecutionPhaseId[] = [
  "preparing",
  "resources_ready",
  "officials_ready",
  "participants_ready",
  "countdown",
  "running",
  "paused",
  "finished",
] as const;

export type { MatchIdentity, ValidationIssue, ValidationSeverity };
