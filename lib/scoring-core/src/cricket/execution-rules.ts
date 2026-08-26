/**
 * Scoring-facing execution fields projected from RuntimeExecutionPolicy
 * via Phase 1 Compatibility Adapter → rulesJson.
 *
 * Does NOT import Rule Engine / Catalog. Consumers read prepared match rules only.
 */

import type { MatchMeta } from "../types.ts";

/** Marker written by Phase 1 Compatibility Adapter. */
export const RUNTIME_EXECUTION_POLICY_SOURCE =
  "runtime_execution_policy" as const;

export type CricketMatchRulesJson = {
  overs?: number;
  maxWickets?: number;
  playingSquadSize?: number;
  benchSize?: number;
  ballsPerOver?: number;
  ballType?: string;
  lbwEnabled?: boolean;
  freeHitEnabled?: boolean;
  retireAtRuns?: number | null;
  powerplayEnabled?: boolean;
  powerplayOvers?: number[];
  superOverEnabled?: boolean;
  superBallEnabled?: boolean;
  playingXiEnforced?: boolean;
  legByeEnabled?: boolean;
  cricketFormat?: string;
  superOverOvers?: number;
  superOverWickets?: number;
  superOverTrigger?: string;
  tiesAllowed?: boolean;
  source?: string;
};

export type RuleResolutionBindJson = {
  resolutionId?: string;
  rulesHash?: string;
  runtimeRulesVersion?: string;
  snapshotVersion?: number;
};

/**
 * Build MatchMeta from prepared rulesJson (+ optional Prepare bind).
 * When source is RuntimeExecutionPolicy, never invent gameplay defaults.
 * Placeholder path is only for pre-Prepare session bootstrap.
 */
export function buildMatchMetaFromRules(args: {
  matchId: number;
  tournamentId: number;
  homeTeamId: number;
  awayTeamId: number;
  rules: CricketMatchRulesJson | null | undefined;
  ruleResolution?: RuleResolutionBindJson | null;
  matchTypeId?: string | null;
}): MatchMeta {
  const rules = args.rules ?? {};
  const fromPolicy = rules.source === RUNTIME_EXECUTION_POLICY_SOURCE;

  if (fromPolicy) {
    if (
      typeof rules.overs !== "number" ||
      typeof rules.maxWickets !== "number"
    ) {
      throw new Error(
        "Prepared RuntimeExecutionPolicy rulesJson missing overs/maxWickets",
      );
    }
    if (
      typeof rules.playingSquadSize !== "number" ||
      typeof rules.benchSize !== "number"
    ) {
      throw new Error(
        "Prepared RuntimeExecutionPolicy rulesJson missing playingSquadSize/benchSize",
      );
    }
    if (
      typeof rules.lbwEnabled !== "boolean" ||
      typeof rules.freeHitEnabled !== "boolean"
    ) {
      throw new Error(
        "Prepared RuntimeExecutionPolicy rulesJson missing lbwEnabled/freeHitEnabled",
      );
    }
    return {
      matchId: args.matchId,
      tournamentId: args.tournamentId,
      homeTeamId: args.homeTeamId,
      awayTeamId: args.awayTeamId,
      oversLimit: rules.overs,
      maxWickets: rules.maxWickets,
      playingSquadSize: rules.playingSquadSize,
      benchSize: rules.benchSize,
      lbwEnabled: rules.lbwEnabled,
      freeHitEnabled: rules.freeHitEnabled,
      legByeEnabled: rules.legByeEnabled ?? true,
      playingXiEnforced: rules.playingXiEnforced ?? false,
      superBallEnabled: rules.superBallEnabled ?? false,
      superOverEnabled: rules.superOverEnabled ?? true,
      superOverOvers: rules.superOverOvers ?? 1,
      superOverWickets: rules.superOverWickets ?? 2,
      superOverTrigger: rules.superOverTrigger ?? "manual",
      cricketFormat: rules.cricketFormat ?? "standard",
      retireAtRuns:
        rules.retireAtRuns === undefined
          ? null
          : (rules.retireAtRuns as number | null),
      resolutionId: args.ruleResolution?.resolutionId ?? null,
      rulesHash: args.ruleResolution?.rulesHash ?? null,
      runtimeRulesVersion: args.ruleResolution?.runtimeRulesVersion ?? null,
      executionRulesSource: RUNTIME_EXECUTION_POLICY_SOURCE,
      matchTypeId: args.matchTypeId ?? null,
    };
  }

  // Pre-Prepare placeholder bootstrap only — not gameplay authority.
  return {
    matchId: args.matchId,
    tournamentId: args.tournamentId,
    homeTeamId: args.homeTeamId,
    awayTeamId: args.awayTeamId,
    oversLimit: typeof rules.overs === "number" ? rules.overs : 20,
    maxWickets: typeof rules.maxWickets === "number" ? rules.maxWickets : 10,
    playingSquadSize:
      typeof rules.playingSquadSize === "number" ? rules.playingSquadSize : 11,
    benchSize: typeof rules.benchSize === "number" ? rules.benchSize : 4,
    lbwEnabled: typeof rules.lbwEnabled === "boolean" ? rules.lbwEnabled : true,
    freeHitEnabled:
      typeof rules.freeHitEnabled === "boolean" ? rules.freeHitEnabled : true,
    legByeEnabled:
      typeof rules.legByeEnabled === "boolean" ? rules.legByeEnabled : true,
    playingXiEnforced:
      typeof rules.playingXiEnforced === "boolean"
        ? rules.playingXiEnforced
        : false,
    superBallEnabled:
      typeof rules.superBallEnabled === "boolean"
        ? rules.superBallEnabled
        : false,
    superOverEnabled:
      typeof rules.superOverEnabled === "boolean"
        ? rules.superOverEnabled
        : true,
    superOverOvers:
      typeof rules.superOverOvers === "number" ? rules.superOverOvers : 1,
    superOverWickets:
      typeof rules.superOverWickets === "number" ? rules.superOverWickets : 2,
    superOverTrigger:
      typeof rules.superOverTrigger === "string"
        ? rules.superOverTrigger
        : "manual",
    cricketFormat:
      typeof rules.cricketFormat === "string"
        ? rules.cricketFormat
        : "standard",
    retireAtRuns:
      rules.retireAtRuns === undefined
        ? null
        : (rules.retireAtRuns as number | null),
    resolutionId: args.ruleResolution?.resolutionId ?? null,
    rulesHash: args.ruleResolution?.rulesHash ?? null,
    runtimeRulesVersion: args.ruleResolution?.runtimeRulesVersion ?? null,
    executionRulesSource: "placeholder",
    matchTypeId: args.matchTypeId ?? null,
  };
}

/** Dismissal types available under current execution rules. */
export function availableDismissalTypes(
  lbwEnabled: boolean,
): readonly string[] {
  const base = [
    "bowled",
    "caught",
    "run_out",
    "stumped",
    "hit_wicket",
    "timed_out",
    "obstructing_field",
    "hit_ball_twice",
  ] as const;
  if (lbwEnabled) {
    return [
      "bowled",
      "caught",
      "run_out",
      "stumped",
      "lbw",
      "hit_wicket",
      "timed_out",
      "obstructing_field",
      "hit_ball_twice",
    ];
  }
  return base;
}

/** Pre-match / lineup limits from prepared rulesJson (no invented XI/bench defaults). */
export function executionLimitsFromRules(
  rules: CricketMatchRulesJson | null | undefined,
): {
  oversLimit: number | null;
  playingSquadSize: number | null;
  benchSize: number | null;
  fromPolicy: boolean;
} {
  const fromPolicy = rules?.source === RUNTIME_EXECUTION_POLICY_SOURCE;
  return {
    fromPolicy,
    oversLimit: typeof rules?.overs === "number" ? rules.overs : null,
    playingSquadSize:
      typeof rules?.playingSquadSize === "number"
        ? rules.playingSquadSize
        : null,
    benchSize: typeof rules?.benchSize === "number" ? rules.benchSize : null,
  };
}
