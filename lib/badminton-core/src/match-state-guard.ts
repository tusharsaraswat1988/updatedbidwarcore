/**
 * Authoritative sequence protection for badminton match state.
 *
 * Every BadmintonMatchState carries `lastSequence` (monotonic event sequence).
 * Clients must reject incoming snapshots when incoming.lastSequence <= current.lastSequence.
 */

import type { BadmintonMatchState } from "./types";

/** Monotonic event sequence — alias for lastSequence on match state. */
export function getEventSequence(state: BadmintonMatchState | null | undefined): number {
  return state?.lastSequence ?? 0;
}

export type RejectMatchStateReason = "duplicate" | "stale";

export type ApplyMatchStateResult =
  | { applied: true; state: BadmintonMatchState }
  | { applied: false; reason: RejectMatchStateReason; state: BadmintonMatchState };

/**
 * Apply incoming match state only when its event sequence is strictly newer.
 *
 * - duplicate (incoming === current): ignore
 * - stale / out-of-order (incoming < current): ignore
 * - newer (incoming > current): accept
 */
export function applyMatchStateIfNewer(
  current: BadmintonMatchState | null | undefined,
  incoming: BadmintonMatchState,
): ApplyMatchStateResult {
  if (current == null) {
    return { applied: true, state: incoming };
  }

  const currentSeq = getEventSequence(current);
  const incomingSeq = getEventSequence(incoming);

  if (incomingSeq <= currentSeq) {
    return {
      applied: false,
      reason: incomingSeq === currentSeq ? "duplicate" : "stale",
      state: current,
    };
  }

  return { applied: true, state: incoming };
}

export type MatchStateCache = {
  state: BadmintonMatchState;
  detail: unknown;
};

/** Merge SSE/POST snapshot into React Query cache with sequence guard. */
export function mergeMatchStateCache(
  prev: MatchStateCache | null | undefined,
  incoming: BadmintonMatchState,
): MatchStateCache {
  const result = applyMatchStateIfNewer(prev?.state, incoming);
  if (!result.applied) {
    return prev ?? { state: incoming, detail: null };
  }
  return {
    state: result.state,
    detail: prev?.detail ?? null,
  };
}
