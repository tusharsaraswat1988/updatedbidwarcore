import type { CricketInningsState, CricketScoreboardState } from "@workspace/scoring-core";

/**
 * Authoritative next delivery position (over and legal-ball index) for an innings.
 * Both legal deliveries and extras/illegal deliveries are bowled into the upcoming slot.
 * Illegal deliveries do not advance legal ball count; legal deliveries do.
 */
export function expectedNextBall(innings: CricketInningsState): { over: number; ball: number } {
  if (innings.ball >= 6) {
    return { over: innings.over + 1, ball: 1 };
  }
  return { over: innings.over, ball: innings.ball + 1 };
}

export function nextLegalBallPosition(innings: CricketInningsState): { over: number; ball: number } {
  return expectedNextBall(innings);
}

/** Illegal deliveries attach to the upcoming legal ball slot. */
export function illegalBallPosition(innings: CricketInningsState): { over: number; ball: number } {
  return expectedNextBall(innings);
}

export function getActiveInnings(state?: CricketScoreboardState | null) {
  if (!state || !Array.isArray(state.innings)) return null;
  return state.innings.find((i) => i && i.innings === state.currentInnings) ?? null;
}

export function oversText(over?: number | null, ball?: number | null): string {
  const o = over ?? 0;
  const b = ball ?? 0;
  if (b >= 6) {
    const full = o + Math.floor(b / 6);
    const rem = b % 6;
    return rem > 0 ? `${full}.${rem}` : `${full}`;
  }
  return `${o}.${b}`;
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
