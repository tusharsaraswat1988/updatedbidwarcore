import { CricketEventType, type CricketScoreboardState } from "@workspace/scoring-core";

const SETUP_SEQUENCE_RETRY_EVENTS = new Set<string>([
  CricketEventType.LINEUP_SET,
  CricketEventType.MATCH_STARTED,
  CricketEventType.BOWLER_CHANGED,
  CricketEventType.BATTER_SELECTED,
]);

/** Retry only a stale sequence. Lease conflicts and "already started" must not write again. */
export function shouldRetrySetupEventAfterConflict(
  status: number | undefined,
  code: string | undefined,
  eventType: string,
): boolean {
  return status === 409 && code === "SEQUENCE_CONFLICT" && SETUP_SEQUENCE_RETRY_EVENTS.has(eventType);
}

/**
 * The payload is already reflected on the server scoreboard.
 * A sequence-conflict retry must not append a second copy.
 */
export function setupEventAlreadyOnScoreboard(
  eventType: string,
  payload: Record<string, unknown>,
  state: CricketScoreboardState | null | undefined,
): boolean {
  if (!state) return false;

  if (eventType === CricketEventType.MATCH_STARTED) {
    return state.matchStatus !== "scheduled";
  }

  if (eventType === CricketEventType.BOWLER_CHANGED) {
    return typeof payload.bowlerId === "number" && state.bowlerId === payload.bowlerId;
  }

  if (eventType === CricketEventType.BATTER_SELECTED) {
    return (
      typeof payload.playerId === "number" &&
      (state.strikerId === payload.playerId || state.nonStrikerId === payload.playerId)
    );
  }

  if (eventType === CricketEventType.LINEUP_SET) {
    const teamId = payload.teamId;
    const playerIds = payload.playerIds;
    if (typeof teamId !== "number" || !Array.isArray(playerIds)) return false;
    const current = state.lineups?.[teamId];
    if (!current || current.length !== playerIds.length) return false;
    return current.every((id, index) => id === playerIds[index]);
  }

  return false;
}
