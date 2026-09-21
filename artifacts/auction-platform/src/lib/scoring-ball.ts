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

export function getActiveInnings(state?: CricketScoreboardState | null) {
  if (!state || !Array.isArray(state.innings)) return null;
  return state.innings.find((i) => i && i.innings === state.currentInnings) ?? null;
}

export function oversText(over?: number | null, ball?: number | null): string {
  return `${over ?? 0}.${ball ?? 0}`;
}

export function runRate(runs?: number | null, over?: number | null, ball?: number | null): string {
  const overs = (over ?? 0) + (ball ?? 0) / 6;
  if (overs <= 0) return "0.00";
  return ((runs ?? 0) / overs).toFixed(2);
}

export function requiredRate(
  target?: number | null,
  runs?: number | null,
  oversLimit?: number | null,
  over?: number | null,
  ball?: number | null,
): string | null {
  if (target == null || oversLimit == null) return null;
  const remaining = target - (runs ?? 0);
  const oversLeft = oversLimit - (over ?? 0) - (ball ?? 0) / 6;
  if (oversLeft <= 0 || remaining <= 0) return null;
  return (remaining / oversLeft).toFixed(2);
}
