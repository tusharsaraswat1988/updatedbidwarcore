import { CricketEventType, type CricketBallUndonePayload } from "../events/cricket";
import type { ScoringEventEnvelope } from "../types";

/**
 * Setup steps a scorer can walk backwards through when no delivery is left to undo.
 * Order in the log is toss → squads → openers → bowler → later batter corrections.
 */
const SETUP_STEP_EVENT_TYPES = new Set<string>([
  CricketEventType.MATCH_STARTED,
  CricketEventType.LINEUP_SET,
  CricketEventType.BATTER_SELECTED,
  CricketEventType.BOWLER_CHANGED,
]);

export type CricketUndoTarget = {
  kind: "ball" | "setup";
  event: ScoringEventEnvelope;
};

function undoneSequencesOf(events: ScoringEventEnvelope[]): Set<number> {
  const undoneSequences = new Set<number>();
  for (const event of events) {
    if (event.eventType !== CricketEventType.BALL_UNDONE) continue;
    const payload = event.payload as CricketBallUndonePayload;
    if (typeof payload?.undoesSequence === "number") {
      undoneSequences.add(payload.undoesSequence);
    }
  }
  return undoneSequences;
}

/**
 * Last thing Undo should remove.
 * A recorded ball always wins. With none left, the latest toss / squad / bowler / batter step.
 */
export function resolveCricketUndoTarget(
  events: ScoringEventEnvelope[],
): CricketUndoTarget | null {
  const undoneSequences = undoneSequencesOf(events);
  const active = events
    .filter(
      (event) =>
        event.eventType !== CricketEventType.BALL_UNDONE &&
        !undoneSequences.has(event.sequence),
    )
    .sort((a, b) => a.sequence - b.sequence);

  const lastBall = [...active]
    .reverse()
    .find((event) => event.eventType === CricketEventType.BALL_RECORDED);
  if (lastBall) return { kind: "ball", event: lastBall };

  const last = active[active.length - 1];
  if (!last || !SETUP_STEP_EVENT_TYPES.has(last.eventType)) return null;
  return { kind: "setup", event: last };
}

/**
 * Drop undo markers and every event they tombstone (balls and pre-ball setup steps).
 * Replay uses ascending sequence order without requiring contiguous sequences.
 */
export function resolveEventsForReplay(events: ScoringEventEnvelope[]): ScoringEventEnvelope[] {
  const undoneSequences = undoneSequencesOf(events);

  return [...events]
    .filter((event) => event.eventType !== CricketEventType.BALL_UNDONE)
    .filter((event) => !undoneSequences.has(event.sequence))
    .sort((a, b) => a.sequence - b.sequence);
}
