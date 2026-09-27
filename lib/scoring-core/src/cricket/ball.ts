import type { CricketBallRecordedPayload } from "../events/cricket";
import type { BallDisplayOutcome, CricketInningsState } from "./state";

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

/**
 * Authoritatively determines whether the quota of overs for an innings has completed.
 * In CricketInningsState, over is 0-indexed (e.g. over 0..4 for a 5-over match).
 * When over 4 finishes with 6 legal balls, innings.over is 4 and innings.ball is 6.
 */
export function isOversComplete(innings: CricketInningsState, oversLimit?: number): boolean {
  const limit = oversLimit ?? innings.oversLimit;
  if (!limit || limit <= 0) return false;
  return (
    innings.over >= limit ||
    (innings.over === limit - 1 && innings.ball >= 6) ||
    expectedNextBall(innings).over >= limit
  );
}

export function totalRunsOnBall(payload: CricketBallRecordedPayload): number {
  const batRuns = payload.isSuperBall
    ? payload.runsOffBat * 2
    : payload.runsOffBat;
  return batRuns + payload.extras.runs;
}

export function formatBallLabel(payload: CricketBallRecordedPayload): string {
  if (payload.wicket) return "W";
  const extra = payload.extras.type;
  const runs = totalRunsOnBall(payload);
  if (extra === "wide") return runs > 1 ? `Wd+${runs - 1}` : "Wd";
  if (extra === "no_ball") return runs > 1 ? `Nb+${runs - 1}` : "Nb";
  if (extra === "penalty") return `P${runs}`;
  if (runs === 0) return "·";
  return String(runs);
}

export function toBallDisplay(
  payload: CricketBallRecordedPayload,
): BallDisplayOutcome {
  return {
    over: payload.over,
    ball: payload.ball,
    runsOffBat: payload.isSuperBall
      ? payload.runsOffBat * 2
      : payload.runsOffBat,
    extrasType: payload.extras.type,
    extrasRuns: payload.extras.runs,
    isWicket: !!payload.wicket,
    isLegalDelivery: payload.isLegalDelivery,
    label: formatBallLabel(payload),
    isSuperBall: payload.isSuperBall,
  };
}

/**
 * Runs that rotate the strike (batter-completed running), excluding automatic
 * wide/no-ball penalty extras. Bye/leg-bye rotate from extras.runs only.
 */
export function strikeRotatingRuns(
  payload: CricketBallRecordedPayload,
): number {
  const extra = payload.extras.type;
  if (extra === "bye" || extra === "leg_bye") {
    return payload.extras.runs;
  }
  if (extra === "wide" || extra === "no_ball") {
    // Automatic 1-run penalty does not rotate; additional extras do (e.g. Wd+2).
    const additional = Math.max(0, payload.extras.runs - 1);
    return payload.runsOffBat + additional;
  }
  return payload.runsOffBat;
}

/** Swap striker/non-striker when an odd number of strike-rotating runs are completed. */
export function shouldSwapStrike(payload: CricketBallRecordedPayload): boolean {
  return strikeRotatingRuns(payload) % 2 === 1;
}

export function oversDisplay(over: number, ball: number): string {
  return `${over}.${ball}`;
}
