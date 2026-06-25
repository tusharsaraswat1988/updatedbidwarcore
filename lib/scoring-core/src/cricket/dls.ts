/**
 * Simplified DLS (Duckworth-Lewis-Stern) calculations for limited-overs cricket.
 * Uses wicket-adjusted resource percentages — suitable for T20/ODI target revision.
 */

/** Resource multiplier by wickets lost (ICC Standard Edition approximation). */
const WICKET_RESOURCE = [1, 0.94, 0.86, 0.76, 0.65, 0.52, 0.38, 0.24, 0.12, 0.05] as const;

export function oversToLegalBalls(overs: string): number {
  const [whole = "0", part = "0"] = overs.split(".");
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
  oversBowled: string,
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
  oversBowled: string,
  wicketsLost: number,
): number {
  return 100 - resourceRemainingPercent(scheduledOvers, oversBowled, wicketsLost);
}

/** Resource available at the start of a revised innings (scaled to scheduled length). */
export function resourceAvailableForInnings(
  scheduledOvers: number,
  revisedOvers: number,
): number {
  return (revisedOvers / scheduledOvers) * 100;
}

export type DlsChaseTargetInput = {
  scheduledOvers: number;
  firstInningsRuns: number;
  firstInningsOvers: string;
  firstInningsWickets: number;
  revisedOvers: number;
};

export type DlsChaseTargetResult = {
  parScore: number;
  target: number;
  resourceFirst: number;
  resourceSecond: number;
};

/** Revised target when 2nd innings overs are reduced before or during chase. */
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

  const parScore = (input.firstInningsRuns * resourceSecond) / resourceFirst;
  const target = Math.floor(parScore) + 1;
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
  firstInningsOvers: string;
  firstInningsWickets: number;
  secondInningsRuns: number;
  secondInningsOvers: string;
  secondInningsWickets: number;
  revisedOvers: number;
};

/** Par score when rain reduces overs during a 2nd-innings chase. */
export function calculateDlsMidChasePar(input: DlsMidChaseInput): DlsChaseTargetResult {
  const r1 = Math.max(
    resourceUsedPercent(
      input.scheduledOvers,
      input.firstInningsOvers,
      input.firstInningsWickets,
    ),
    1,
  );
  const r2AtStop = Math.max(
    resourceUsedPercent(
      input.scheduledOvers,
      input.secondInningsOvers,
      input.secondInningsWickets,
    ),
    1,
  );
  const r2Revised = resourceAvailableForInnings(
    input.scheduledOvers,
    input.revisedOvers,
  );

  const parScore =
    input.secondInningsRuns +
    (input.firstInningsRuns * r2Revised) / r1 -
    (input.secondInningsRuns * r2Revised) / r2AtStop;

  const target = Math.max(Math.floor(parScore) + 1, input.secondInningsRuns + 1);
  return {
    parScore: Math.round(parScore * 100) / 100,
    target,
    resourceFirst: Math.round(r1 * 100) / 100,
    resourceSecond: Math.round(r2Revised * 100) / 100,
  };
}
