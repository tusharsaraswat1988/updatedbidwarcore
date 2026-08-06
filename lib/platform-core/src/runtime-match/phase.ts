import type { MatchLifecycleStatusId } from "../match/types.ts";
import type { ExecutionPhaseId } from "./types.ts";
import { EXECUTION_PHASE_ORDER } from "./types.ts";

const ORDER = new Map(EXECUTION_PHASE_ORDER.map((p, i) => [p, i]));

/** Match Lifecycle states that allow preparation / countdown phases. */
const PREP_LIFECYCLES = new Set<MatchLifecycleStatusId>(["ready", "locked"]);

/** Match Lifecycle states that allow Running / Paused. */
const LIVE_LIFECYCLES = new Set<MatchLifecycleStatusId>(["live"]);

/** Match Lifecycle states that allow Finished. */
const FINISHED_LIFECYCLES = new Set<MatchLifecycleStatusId>(["live", "completed"]);

export function isPhaseAllowedForLifecycle(
  phase: ExecutionPhaseId,
  lifecycle: MatchLifecycleStatusId,
): boolean {
  if (
    phase === "preparing" ||
    phase === "resources_ready" ||
    phase === "officials_ready" ||
    phase === "participants_ready" ||
    phase === "countdown"
  ) {
    return PREP_LIFECYCLES.has(lifecycle);
  }
  if (phase === "running" || phase === "paused") {
    return LIVE_LIFECYCLES.has(lifecycle);
  }
  if (phase === "finished") {
    return FINISHED_LIFECYCLES.has(lifecycle);
  }
  return false;
}

/**
 * Linear phase transitions only.
 * Allowed: forward by one step; Running ↔ Paused; same phase.
 */
export function isValidExecutionPhaseTransition(
  from: ExecutionPhaseId,
  to: ExecutionPhaseId,
): boolean {
  if (from === to) return true;
  if (from === "running" && to === "paused") return true;
  if (from === "paused" && to === "running") return true;

  const fromIdx = ORDER.get(from);
  const toIdx = ORDER.get(to);
  if (fromIdx == null || toIdx == null) return false;

  // Skip paused in the forward index when leaving running toward finished.
  if (from === "running" && to === "finished") return true;
  if (from === "paused" && to === "finished") return true;

  // Forward one step along the linear prep chain (excluding paused loop).
  const linear = EXECUTION_PHASE_ORDER.filter((p) => p !== "paused");
  const linearFrom = linear.indexOf(from);
  const linearTo = linear.indexOf(to);
  if (linearFrom < 0 || linearTo < 0) return false;
  return linearTo === linearFrom + 1;
}

export function resolveExecutionPhase(
  phase: string | null | undefined,
): ExecutionPhaseId {
  return (phase ?? "preparing") as ExecutionPhaseId;
}

/** Lifecycle status EPIC-05 should be requested to enter for Running. */
export function requestedLifecycleForPhase(
  phase: ExecutionPhaseId,
): MatchLifecycleStatusId | null {
  if (phase === "running" || phase === "paused") return "live";
  if (phase === "finished") return "completed";
  return null;
}
