import type { SchedulingLifecycle, SchedulingLifecycleStatusId } from "./types.ts";
import { SCHEDULING_LIFECYCLE_ORDER } from "./types.ts";

const ORDER = new Map(SCHEDULING_LIFECYCLE_ORDER.map((s, i) => [s, i]));

export function isValidSchedulingLifecycleTransition(
  from: SchedulingLifecycleStatusId,
  to: SchedulingLifecycleStatusId,
  opts?: { admin?: boolean },
): boolean {
  if (from === to) return true;
  const fromIdx = ORDER.get(from);
  const toIdx = ORDER.get(to);
  if (fromIdx == null || toIdx == null) return false;

  if (to === "archived") {
    if (from === "executed") return true;
    return !!opts?.admin;
  }

  if (from === "locked" && to === "ready") return true;
  if (from === "validated" && to === "locked") return true;
  if (from === "generated" && to === "validated") return true;
  if (from === "draft" && to === "generated") return true;
  if (toIdx === fromIdx + 1) return true;

  if (
    (from === "draft" && (to === "generated" || to === "validated")) ||
    (from === "generated" && to === "validated")
  ) {
    return true;
  }

  return false;
}

/** After Lock Scheduling Setup: freeze then Ready so execution may begin. */
export function lifecycleAfterSchedulingLock(
  current: SchedulingLifecycleStatusId,
): SchedulingLifecycleStatusId {
  if (current === "archived" || current === "executed") {
    return current;
  }
  return "ready";
}

export function resolveSchedulingLifecycle(
  schedulingId: string,
  tournamentId: number,
  status: string | null | undefined,
  locked: boolean,
  hasStructure: boolean,
): SchedulingLifecycle {
  let resolved = (status ?? null) as SchedulingLifecycleStatusId | null;
  if (!resolved) {
    if (locked) resolved = "ready";
    else if (hasStructure) resolved = "generated";
    else resolved = "draft";
  }
  return {
    schedulingId,
    tournamentId,
    status: resolved,
    locked,
  };
}
