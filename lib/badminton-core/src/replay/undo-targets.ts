/**
 * Grade A Phase B — resolve which event sequences belong to the last rally undo.
 */

import { BadmintonEventType } from "../events/badminton";
import type { BadmintonEventEnvelope } from "../types";
import { resolveUndoEvents } from "../reducer/reducer";

/** Events that ride with the last POINT_WON and must rewind together. */
const BOUNDARY_AFTER_POINT = new Set<string>([
  BadmintonEventType.GAME_ENDED,
  BadmintonEventType.MATCH_ENDED,
  // S3-07 — interval/timeout after a rally must clear when that rally is undone
  BadmintonEventType.INTERVAL_STARTED,
  BadmintonEventType.INTERVAL_ENDED,
  BadmintonEventType.TIMEOUT_STARTED,
  BadmintonEventType.TIMEOUT_ENDED,
]);

/** Sequence of the most recent POINT_WON in the effective (post-undo) event log. */
export function getLastPointWonSequence(events: BadmintonEventEnvelope[]): number | null {
  const effective = resolveUndoEvents(events);

  for (let i = effective.length - 1; i >= 0; i--) {
    if (effective[i].eventType === BadmintonEventType.POINT_WON) {
      return effective[i].sequence;
    }
  }

  return null;
}

/**
 * All sequences removed when undoing the last rally:
 * the POINT_WON plus any immediately following GAME_ENDED / MATCH_ENDED /
 * INTERVAL_* / TIMEOUT_* from the same post-rally window (stops at the next
 * unrelated event such as another point).
 */
export function getUndoTargetSequences(events: BadmintonEventEnvelope[]): number[] {
  const effective = resolveUndoEvents(events);

  let lastPointIndex = -1;
  for (let i = effective.length - 1; i >= 0; i--) {
    if (effective[i].eventType === BadmintonEventType.POINT_WON) {
      lastPointIndex = i;
      break;
    }
  }

  if (lastPointIndex === -1) return [];

  const targets = [effective[lastPointIndex].sequence];

  for (let i = lastPointIndex + 1; i < effective.length; i++) {
    const ev = effective[i];
    if (BOUNDARY_AFTER_POINT.has(ev.eventType)) {
      targets.push(ev.sequence);
      continue;
    }
    break;
  }

  return targets;
}
