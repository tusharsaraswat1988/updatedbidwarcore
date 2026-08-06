/**
 * Match Side — first-class platform concept (EPIC-05).
 *
 * Ownership:
 *
 *   Match
 *     → Match Side          (platform slot: side_a, side_b, …)
 *          → Team           OR
 *          → Participant
 *          → Roles
 *
 * A Match never owns Teams or Participants directly.
 * Presentation labels (Home/Away, Team A/B, Player A/B, Pair A/B, Lane A/B)
 * belong to Presentation Profile later — never to this layer.
 *
 * Concept only in this epic — no dedicated sides table.
 * Runtime bridges map sport storage into MatchSide views.
 */

import { MATCH_SIDE_IDS, type MatchSideId } from "../catalog/match-roles/index.ts";
import type { MatchSide, MatchSideSlotId, MatchSideSubject } from "./types.ts";

export { MATCH_SIDE_IDS, type MatchSideId };

/** Default two-sided contest slots. Multi-side events may add side_c… later. */
export const DEFAULT_MATCH_SIDE_SLOTS: readonly MatchSideSlotId[] = MATCH_SIDE_IDS;

export function emptyMatchSide(sideId: MatchSideSlotId): MatchSide {
  return {
    sideId,
    subject: null,
    roles: [],
  };
}

export function matchSideWithSubject(
  sideId: MatchSideSlotId,
  subject: MatchSideSubject,
  roles: readonly string[] = ["competitor"],
): MatchSide {
  return {
    sideId,
    subject,
    roles,
  };
}

/** True when the side has an attached Team or Participant subject. */
export function matchSideHasSubject(side: MatchSide): boolean {
  return side.subject != null;
}
