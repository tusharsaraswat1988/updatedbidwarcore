import type { TeamLifecycleStatusId } from "./types.ts";
import { TEAM_LIFECYCLE_ORDER } from "./types.ts";

const ORDER = new Map(TEAM_LIFECYCLE_ORDER.map((s, i) => [s, i]));

export function isValidLifecycleTransition(
  from: TeamLifecycleStatusId,
  to: TeamLifecycleStatusId,
  opts?: { admin?: boolean },
): boolean {
  if (from === to) return true;
  const fromIdx = ORDER.get(from);
  const toIdx = ORDER.get(to);
  if (fromIdx == null || toIdx == null) return false;

  // Archived only after Completed (unless admin override).
  if (to === "archived") {
    if (from === "completed") return true;
    return !!opts?.admin;
  }

  // Allow forward steps and lock shortcut from ready → locked.
  if (from === "ready" && to === "locked") return true;
  if (toIdx === fromIdx + 1) return true;

  // Building may jump back to draft for edits before lock.
  if (from === "building" && to === "draft") return true;
  if (from === "draft" && to === "building") return true;
  if (from === "building" && to === "ready") return true;

  return false;
}

export function lifecycleAfterLock(current: TeamLifecycleStatusId): TeamLifecycleStatusId {
  if (current === "archived" || current === "completed" || current === "active") {
    return current;
  }
  return "locked";
}
