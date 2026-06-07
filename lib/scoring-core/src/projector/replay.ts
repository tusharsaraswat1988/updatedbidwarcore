import type { ScoringEventEnvelope } from "../types";
import { validateEventSequence } from "./sequence";

export type Reducer<S> = (state: S, event: ScoringEventEnvelope) => S;

/**
 * Replay a chronologically ordered event list into a projection state.
 * Foundation for session rebuild, summary rebuild, and stats (future).
 */
export function replayEvents<S>(
  initialState: S,
  events: ScoringEventEnvelope[],
  reduce: Reducer<S>,
): S {
  const sorted = [...events].sort((a, b) => a.sequence - b.sequence);
  validateEventSequence(sorted);
  return sorted.reduce((state, event) => reduce(state, event), initialState);
}
