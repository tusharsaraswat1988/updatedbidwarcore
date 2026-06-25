import type { CricketInningsState, CricketScoreboardState } from "@workspace/scoring-core";

export function nextLegalBallPosition(innings: CricketInningsState): { over: number; ball: number } {
  if (innings.over === 0 && innings.ball === 0) {
    return { over: 0, ball: 1 };
  }
  if (innings.ball >= 6) {
    return { over: innings.over + 1, ball: 1 };
  }
  return { over: innings.over, ball: innings.ball + 1 };
}

/** Illegal deliveries attach to the upcoming legal ball slot. */
export function illegalBallPosition(innings: CricketInningsState): { over: number; ball: number } {
  const next = nextLegalBallPosition(innings);
  if (innings.ball === 0 && innings.over === 0 && innings.runs === 0) {
    return { over: 0, ball: 1 };
  }
  if (innings.ball >= 6) {
    return { over: innings.over + 1, ball: 1 };
  }
  return { over: innings.over, ball: innings.ball === 0 ? 1 : innings.ball };
}

export function getActiveInnings(state: CricketScoreboardState) {
  return state.innings.find((i) => i.innings === state.currentInnings) ?? null;
}

export function oversText(over: number, ball: number): string {
  return `${over}.${ball}`;
}

export function runRate(runs: number, over: number, ball: number): string {
  const overs = over + ball / 6;
  if (overs <= 0) return "0.00";
  return (runs / overs).toFixed(2);
}

export function requiredRate(
  target: number,
  runs: number,
  oversLimit: number,
  over: number,
  ball: number,
): string | null {
  const remaining = target - runs;
  const oversLeft = oversLimit - over - ball / 6;
  if (oversLeft <= 0 || remaining <= 0) return null;
  return (remaining / oversLeft).toFixed(2);
}
