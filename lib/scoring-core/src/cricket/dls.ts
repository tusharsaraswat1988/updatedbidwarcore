/**
 * Standard DLS (Duckworth-Lewis-Stern) calculations for limited-overs cricket.
 * Uses wicket-adjusted resource percentages — suitable for T20/ODI target revision.
 */

/** Resource multiplier by wickets lost (ICC Standard Edition approximation). */
const WICKET_RESOURCE = [1, 0.94, 0.86, 0.76, 0.65, 0.52, 0.38, 0.24, 0.12, 0.05] as const;

export function oversToLegalBalls(overs: string | number): number {
  if (typeof overs === "number") return Math.round(overs * 6);
  const [whole = "0", part = "0"] = String(overs).split(".");
  return parseInt(whole, 10) * 6 + parseInt(part, 10);
}

export function legalBallsToOvers(balls: number): string {
  const w = Math.floor(balls / 6);
  const b = balls % 6;
  return `${w}.${b}`;
}

/** Percentage of match resources remaining (0–100). */
export function resourceRemainingPercent(
  scheduledOvers: number,
  oversBowled: string | number,
  wicketsLost: number,
): number {
  const totalBalls = scheduledOvers * 6;
  if (totalBalls <= 0) return 0;
  const bowledBalls = oversToLegalBalls(oversBowled);
  const remainingBalls = Math.max(0, totalBalls - bowledBalls);
  const wickets = Math.min(9, Math.max(0, wicketsLost));
  return (remainingBalls / totalBalls) * 100 * WICKET_RESOURCE[wickets]!;
}

/** Percentage of match resources used (0–100). */
export function resourceUsedPercent(
  scheduledOvers: number,
  oversBowled: string | number,
  wicketsLost: number,
): number {
  return 100 - resourceRemainingPercent(scheduledOvers, oversBowled, wicketsLost);
}

/** Resource available at the start of a revised innings (scaled to scheduled length). */
export function resourceAvailableForInnings(
  scheduledOvers: number,
  revisedOvers: number,
): number {
  if (scheduledOvers <= 0) return 100;
  return Math.min(100, Math.max(0, (revisedOvers / scheduledOvers) * 100));
}

export type DlsChaseTargetInput = {
  scheduledOvers: number;
  firstInningsRuns: number;
  firstInningsOvers: string | number;
  firstInningsWickets: number;
  revisedOvers: number;
};

export type DlsChaseTargetResult = {
  parScore: number;
  target: number;
  resourceFirst: number;
  resourceSecond: number;
};

/** Revised target when 2nd innings overs are reduced before or between innings. */
export function calculateDlsChaseTarget(input: DlsChaseTargetInput): DlsChaseTargetResult {
  const resourceFirst = Math.max(
    resourceUsedPercent(
      input.scheduledOvers,
      input.firstInningsOvers,
      input.firstInningsWickets,
    ),
    1,
  );
  const resourceSecond = resourceAvailableForInnings(
    input.scheduledOvers,
    input.revisedOvers,
  );

  let parScore: number;
  if (resourceSecond <= resourceFirst) {
    parScore = (input.firstInningsRuns * resourceSecond) / resourceFirst;
  } else {
    // If second innings has more resources than first innings (e.g. 1st innings cut short)
    const benchmarkRuns = input.scheduledOvers * 8; // standard baseline rate
    parScore = input.firstInningsRuns + ((resourceSecond - resourceFirst) / 100) * benchmarkRuns;
  }

  const target = Math.max(1, Math.floor(parScore) + 1);
  return {
    parScore: Math.round(parScore * 100) / 100,
    target,
    resourceFirst: Math.round(resourceFirst * 100) / 100,
    resourceSecond: Math.round(resourceSecond * 100) / 100,
  };
}

export type DlsMidChaseInput = {
  scheduledOvers: number;
  firstInningsRuns: number;
  firstInningsOvers: string | number;
  firstInningsWickets: number;
  secondInningsRuns: number;
  secondInningsOvers: string | number;
  secondInningsWickets: number;
  revisedOvers: number;
};

/** Par score and target when rain reduces overs during a 2nd-innings chase. */
export function calculateDlsMidChasePar(input: DlsMidChaseInput): DlsChaseTargetResult {
  const r1 = Math.max(
    resourceUsedPercent(
      input.scheduledOvers,
      input.firstInningsOvers,
      input.firstInningsWickets,
    ),
    1,
  );

  const bowledBalls = oversToLegalBalls(input.secondInningsOvers);
  const scheduledBalls = input.scheduledOvers * 6;
  const revisedBalls = Math.min(scheduledBalls, Math.max(bowledBalls, input.revisedOvers * 6));

  const remainingBallsBefore = Math.max(0, scheduledBalls - bowledBalls);
  const remainingBallsAfter = Math.max(0, revisedBalls - bowledBalls);
  const w2 = Math.min(9, Math.max(0, input.secondInningsWickets));
  const wResource = WICKET_RESOURCE[w2]!;

  const resRemainingBefore = scheduledBalls > 0 ? (remainingBallsBefore / scheduledBalls) * 100 * wResource : 0;
  const resRemainingAfter = scheduledBalls > 0 ? (remainingBallsAfter / scheduledBalls) * 100 * wResource : 0;
  const resLost = Math.max(0, resRemainingBefore - resRemainingAfter);

  const r2 = Math.max(1, 100 - resLost);

  let parScore: number;
  if (r2 <= r1) {
    parScore = (input.firstInningsRuns * r2) / r1;
  } else {
    const benchmarkRuns = input.scheduledOvers * 8;
    parScore = input.firstInningsRuns + ((r2 - r1) / 100) * benchmarkRuns;
  }

  const target = Math.max(input.secondInningsRuns + 1, Math.floor(parScore) + 1);
  return {
    parScore: Math.round(parScore * 100) / 100,
    target,
    resourceFirst: Math.round(r1 * 100) / 100,
    resourceSecond: Math.round(r2 * 100) / 100,
  };
}
