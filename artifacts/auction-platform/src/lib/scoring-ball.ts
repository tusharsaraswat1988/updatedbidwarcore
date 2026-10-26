import {
  shouldSwapStrike,
  type CricketBallRecordedPayload,
  type CricketInningsState,
  type CricketScoreboardState,
} from "@workspace/scoring-core";

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

/**
 * Crease after this delivery. Odd running runs rotate strike.
 * The last legal ball of the over rotates again, so a single on ball 6 stays put.
 */
export function nextCreaseAfterBall(
  payload: Pick<
    CricketBallRecordedPayload,
    "strikerId" | "nonStrikerId" | "runsOffBat" | "extras" | "isLegalDelivery" | "ball"
  > &
    Partial<Pick<CricketBallRecordedPayload, "wicket" | "isSuperBall" | "innings" | "over" | "bowlerId">>,
  ballsPerOver = 6,
): { strikerId: number | null; nonStrikerId: number | null } {
  let strikerId: number | null = payload.strikerId;
  let nonStrikerId: number | null = payload.nonStrikerId ?? null;
  const bpo = ballsPerOver > 0 ? ballsPerOver : 6;

  if (nonStrikerId != null && shouldSwapStrike(payload as CricketBallRecordedPayload)) {
    [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
  }
  if (nonStrikerId != null && payload.isLegalDelivery && payload.ball === bpo) {
    [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
  }
  if (payload.wicket) {
    const dismissed = payload.wicket.dismissedPlayerId;
    if (strikerId === dismissed) strikerId = null;
    if (nonStrikerId === dismissed) nonStrikerId = null;
  }
  return { strikerId, nonStrikerId };
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
