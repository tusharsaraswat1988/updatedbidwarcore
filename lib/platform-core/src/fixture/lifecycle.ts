import type { FixtureLifecycle, FixtureLifecycleStatusId } from "./types.ts";
import { FIXTURE_LIFECYCLE_ORDER } from "./types.ts";

const ORDER = new Map(FIXTURE_LIFECYCLE_ORDER.map((s, i) => [s, i]));

export function isValidFixtureLifecycleTransition(
  from: FixtureLifecycleStatusId,
  to: FixtureLifecycleStatusId,
  opts?: { admin?: boolean },
): boolean {
  if (from === to) return true;
  const fromIdx = ORDER.get(from);
  const toIdx = ORDER.get(to);
  if (fromIdx == null || toIdx == null) return false;

  if (to === "archived") {
    if (from === "completed") return true;
    return !!opts?.admin;
  }

  // Lock freezes structure; Ready means execution may consume.
  if (from === "locked" && to === "ready") return true;
  if (from === "validated" && to === "locked") return true;
  if (from === "generated" && to === "validated") return true;
  if (from === "draft" && to === "generated") return true;

  if (toIdx === fromIdx + 1) return true;

  // Planning shortcuts before lock.
  if (
    (from === "draft" && (to === "generated" || to === "validated")) ||
    (from === "generated" && to === "validated")
  ) {
    return true;
  }

  return false;
}

/**
 * After Lock Fixture Setup (POST ready): configuration is frozen and
 * lifecycle becomes Ready so execution may consume Fixture View.
 * Generated ≠ Ready — keep them distinct; Ready is the post-lock consumer state.
 */
export function lifecycleAfterFixtureLock(
  current: FixtureLifecycleStatusId,
): FixtureLifecycleStatusId {
  if (current === "archived" || current === "completed") {
    return current;
  }
  return "ready";
}

export function resolveFixtureLifecycle(
  fixtureId: string,
  tournamentId: number,
  status: string | null | undefined,
  locked: boolean,
  hasStructure: boolean,
): FixtureLifecycle {
  let resolved = (status ?? null) as FixtureLifecycleStatusId | null;
  if (!resolved) {
    if (locked) resolved = "ready";
    else if (hasStructure) resolved = "generated";
    else resolved = "draft";
  }
  return {
    fixtureId,
    tournamentId,
    status: resolved,
    locked,
  };
}
