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

export type RejectMatchStateReason = "duplicate" | "stale" | "wrong_match";

export type ApplyMatchStateResult =
  | { applied: true; state: BadmintonMatchState }
  | { applied: false; reason: RejectMatchStateReason; state: BadmintonMatchState };

/**
 * Apply incoming match state only when it belongs to the same match and its
 * event sequence is strictly newer.
 *
 * - wrong_match (incoming.matchId !== expected/current): ignore
 * - duplicate (incoming === current): ignore
 * - stale / out-of-order (incoming < current): ignore
 * - newer (incoming > current): accept
 */
export function applyMatchStateIfNewer(
  current: BadmintonMatchState | null | undefined,
  incoming: BadmintonMatchState,
  expectedMatchId?: number,
): ApplyMatchStateResult {
  const expectedId = expectedMatchId ?? current?.matchId;
  if (
    expectedId != null &&
    expectedId > 0 &&
    incoming.matchId != null &&
    incoming.matchId > 0 &&
    incoming.matchId !== expectedId
  ) {
    return {
      applied: false,
      reason: "wrong_match",
      state: current ?? incoming,
    };
  }

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

/**
 * Merge SSE/POST snapshot into React Query cache with match-id + sequence guard.
 * Pass `expectedMatchId` when the cache key is match-scoped so foreign-match
 * SSE frames cannot overwrite this match (Sprint 1 / C1).
 */
export function mergeMatchStateCache(
  prev: MatchStateCache | null | undefined,
  incoming: BadmintonMatchState,
  expectedMatchId?: number,
): MatchStateCache {
  const result = applyMatchStateIfNewer(prev?.state, incoming, expectedMatchId);
  if (!result.applied) {
    return prev ?? { state: incoming, detail: null };
  }
  return {
    state: result.state,
    detail: prev?.detail ?? null,
  };
}
