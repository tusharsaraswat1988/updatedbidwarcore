import { SequenceConflictError } from "./errors";

/** Last applied per-match sequence, or 0 when no events exist. */
export function getCurrentSequence(lastEventSeq: number | null | undefined): number {
  return lastEventSeq ?? 0;
}

/** Next sequence number for a new event append. */
export function nextSequence(lastEventSeq: number | null | undefined): number {
  return getCurrentSequence(lastEventSeq) + 1;
}

/**
 * Optimistic concurrency check for event append.
 * Client sends expectedSequence = last known sequence before append.
 */
export function assertExpectedSequence(
  expectedSequence: number,
  currentSequence: number,
): void {
  if (expectedSequence !== currentSequence) {
    throw new SequenceConflictError(expectedSequence, currentSequence);
  }
}

/** Validate events are in strict ascending sequence with no gaps (for replay). */
export function validateEventSequence(events: { sequence: number }[]): void {
  for (let i = 0; i < events.length; i++) {
    const expected = i + 1;
    const actual = events[i]?.sequence;
    if (actual !== expected) {
      throw new Error(
        `Event sequence gap at index ${i}: expected ${expected}, got ${actual ?? "undefined"}`,
      );
    }
  }
}
