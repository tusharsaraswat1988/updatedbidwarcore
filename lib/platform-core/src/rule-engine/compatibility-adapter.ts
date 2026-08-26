/**
 * Compatibility Adapter — temporary migration bridge only.
 *
 * RuntimeExecutionPolicy → legacy rulesJson shape for the existing reducer.
 * NOT a second Rule Engine. Future removal must require zero Rule Engine changes.
 */

import type { RuntimeExecutionPolicy } from "./execution-policy.ts";

/**
 * Temporary projection consumed by MatchMeta / createInitialCricketState / reducer.
 * Extra fields beyond overs/maxWickets are ignored by the reducer today (Phase 1).
 */
export type CompatibilityRulesJson = {
  overs: number;
  maxWickets: number;
  playingSquadSize: number;
  playingXiEnforced: boolean;
  benchSize: number;
  ballsPerOver: number;
  ballType: string;
  lbwEnabled: boolean;
  legByeEnabled: boolean;
  freeHitEnabled: boolean;
  retireAtRuns: number | null;
  powerplayEnabled: boolean;
  superOverEnabled: boolean;
  superBallEnabled: boolean;
  superOverOvers: number;
  superOverWickets: number;
  superOverTrigger: string;
  tiesAllowed: boolean;
  /** Marker — never treat as gameplay authority. */
  source: "runtime_execution_policy";
};

/**
 * Project RuntimeExecutionPolicy → temporary rulesJson for the existing reducer path.
 */
export function projectRuntimeExecutionPolicyToRulesJson(
  policy: RuntimeExecutionPolicy,
): CompatibilityRulesJson {
  if (!policy.cricket) {
    throw new Error(
      `Compatibility Adapter: no cricket execution fields on policy for sport ${policy.sportId}`,
    );
  }
  const c = policy.cricket;
  return Object.freeze({
    overs: c.oversLimit,
    maxWickets: c.maxWickets,
    playingSquadSize: c.playingSquadSize,
    playingXiEnforced: c.playingXiEnforced,
    benchSize: c.benchSize,
    ballsPerOver: c.ballsPerOver,
    ballType: c.ballType,
    lbwEnabled: c.lbwEnabled,
    legByeEnabled: c.legByeEnabled,
    freeHitEnabled: c.freeHitEnabled,
    retireAtRuns: c.retireAtRuns,
    powerplayEnabled: c.powerplayEnabled,
    superOverEnabled: c.superOverEnabled,
    superBallEnabled: c.superBallEnabled,
    superOverOvers: c.superOverOvers,
    superOverWickets: c.superOverWickets,
    superOverTrigger: c.superOverTrigger,
    tiesAllowed: c.tiesAllowed,
    source: "runtime_execution_policy" as const,
  });
}
