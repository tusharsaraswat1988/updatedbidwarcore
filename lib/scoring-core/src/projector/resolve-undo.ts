import { CricketEventType, type CricketBallUndonePayload } from "../events/cricket";
import type { ScoringEventEnvelope } from "../types";

/**
 * Remove ball.recorded events that were undone and drop undo markers.
 * Replay uses ascending sequence order without requiring contiguous sequences.
 */
export function resolveEventsForReplay(events: ScoringEventEnvelope[]): ScoringEventEnvelope[] {
  const undoneSequences = new Set<number>();
  for (const event of events) {
    if (event.eventType === CricketEventType.BALL_UNDONE) {
      const payload = event.payload as CricketBallUndonePayload;
      undoneSequences.add(payload.undoesSequence);
    }
  }

  return [...events]
    .filter((event) => event.eventType !== CricketEventType.BALL_UNDONE)
    .filter((event) => {
      if (event.eventType === CricketEventType.BALL_RECORDED) {
        return !undoneSequences.has(event.sequence);
      }
      return true;
    })
    .sort((a, b) => a.sequence - b.sequence);
}
