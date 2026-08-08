import type { CricketBallRecordedPayload } from "../events/cricket";
import type { BallDisplayOutcome } from "./state";

export function totalRunsOnBall(payload: CricketBallRecordedPayload): number {
  return payload.runsOffBat + payload.extras.runs;
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

export function toBallDisplay(payload: CricketBallRecordedPayload): BallDisplayOutcome {
  return {
    over: payload.over,
    ball: payload.ball,
    runsOffBat: payload.runsOffBat,
    extrasType: payload.extras.type,
    extrasRuns: payload.extras.runs,
    isWicket: !!payload.wicket,
    isLegalDelivery: payload.isLegalDelivery,
    label: formatBallLabel(payload),
  };
}

/**
 * Runs that rotate the strike (batter-completed running), excluding automatic
 * wide/no-ball penalty extras. Bye/leg-bye rotate from extras.runs only.
 */
export function strikeRotatingRuns(payload: CricketBallRecordedPayload): number {
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
