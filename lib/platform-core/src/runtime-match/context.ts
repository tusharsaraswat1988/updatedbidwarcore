import type { FrozenRef, RuntimeContext, RuntimeSnapshot } from "./types.ts";

/**
 * Build Runtime Context from a frozen snapshot.
 * Bindings are resolved refs — constant for that snapshot.
 * Never includes score, clock, timer, stats, or broadcast state.
 */
export function buildRuntimeContextFromSnapshot(
  snapshot: RuntimeSnapshot,
  executionMetadata?: Record<string, unknown> | null,
): RuntimeContext {
  const refs = snapshot.references;
  return {
    matchId: snapshot.matchId,
    tournamentId: snapshot.tournamentId,
    snapshotVersion: snapshot.snapshotVersion,
    ruleBinding: refs.ruleProfile,
    presentationBinding: refs.presentationProfile,
    schedulingBinding: refs.schedulingPlan,
    resourceAssignmentBindings: refs.resourceAssignments,
    executionMetadata: executionMetadata ?? null,
  };
}

/** Guard: Context must not carry scoring/broadcast fields. */
export function contextHasForbiddenExecutionState(
  context: RuntimeContext,
): boolean {
  const meta = context.executionMetadata;
  if (!meta) return false;
  const forbidden = [
    "score",
    "overs",
    "rally",
    "timer",
    "clock",
    "statistics",
    "broadcast",
    "playerPositions",
  ];
  return forbidden.some((k) => k in meta);
}

export type { FrozenRef };
