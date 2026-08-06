import type { MatchLifecycle, MatchLifecycleStatusId } from "./types.ts";
import { MATCH_LIFECYCLE_ORDER } from "./types.ts";

const ORDER = new Map(MATCH_LIFECYCLE_ORDER.map((s, i) => [s, i]));

export function isValidMatchLifecycleTransition(
  from: MatchLifecycleStatusId,
  to: MatchLifecycleStatusId,
  opts?: { admin?: boolean },
): boolean {
  if (from === to) return true;
  const fromIdx = ORDER.get(from);
  const toIdx = ORDER.get(to);
  if (fromIdx == null || toIdx == null) return false;

  // Archived only after Verified (unless admin).
  if (to === "archived") {
    if (from === "verified") return true;
    return !!opts?.admin;
  }

  if (from === "ready" && to === "locked") return true;
  if (toIdx === fromIdx + 1) return true;

  // Allow early planning moves before lock.
  if (
    (from === "draft" && to === "scheduled") ||
    (from === "scheduled" && to === "ready") ||
    (from === "draft" && to === "ready")
  ) {
    return true;
  }

  return false;
}

export function lifecycleAfterMatchLock(
  current: MatchLifecycleStatusId,
): MatchLifecycleStatusId {
  if (
    current === "archived" ||
    current === "verified" ||
    current === "completed" ||
    current === "live"
  ) {
    return current;
  }
  return "locked";
}

export function resolveMatchLifecycle(
  matchId: string,
  tournamentId: number,
  status: string | null | undefined,
  locked: boolean,
): MatchLifecycle {
  return {
    matchId,
    tournamentId,
    status: (status ?? (locked ? "locked" : "draft")) as MatchLifecycleStatusId,
    locked,
  };
}
