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

/** Swap striker/non-striker when odd runs scored off the bat (not bye/leg bye). */
export function shouldSwapStrike(payload: CricketBallRecordedPayload): boolean {
  const battingRuns =
    payload.extras.type === "bye" || payload.extras.type === "leg_bye"
      ? 0
      : payload.runsOffBat + (payload.extras.type === "wide" || payload.extras.type === "no_ball" ? payload.extras.runs : 0);
  return battingRuns % 2 === 1;
}

export function oversDisplay(over: number, ball: number): string {
  return `${over}.${ball}`;
}
