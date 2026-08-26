/**
 * RuntimeExecutionPolicy — runtime-facing execution contract.
 *
 * Derived once at Runtime Prepare from ResolvedRuntimeRules.
 * NOT a second Rule Engine, Rule Profile, or Snapshot.
 * Authority remains ResolvedRuntimeRules; this is the runtime face.
 */

import type {
  ConcreteRuleValue,
  ExecutableRule,
  ResolvedRuntimeRules,
} from "./types.ts";

export const RUNTIME_EXECUTION_POLICY_SCHEMA_VERSION = "1.0.0";

export type CricketRuntimeExecutionFields = {
  readonly oversLimit: number;
  readonly maxWickets: number;
  readonly playingSquadSize: number;
  readonly playingXiEnforced: boolean;
  readonly benchSize: number;
  readonly ballsPerOver: number;
  readonly ballType: string;
  readonly lbwEnabled: boolean;
  readonly legByeEnabled: boolean;
  readonly freeHitEnabled: boolean;
  readonly retireAtRuns: number | null;
  readonly powerplayEnabled: boolean;
  readonly superOverEnabled: boolean;
  readonly superBallEnabled: boolean;
  readonly superOverOvers: number;
  readonly superOverWickets: number;
  readonly superOverTrigger: string;
  readonly tiesAllowed: boolean;
};

/**
 * Runtime-facing execution contract bound for one Prepare cycle.
 * Identity fields pin the ResolvedRuntimeRules authority without embedding rule bodies on Snapshot.
 */
export type RuntimeExecutionPolicy = {
  readonly schemaVersion: string;
  readonly resolutionId: string;
  readonly rulesHash: string;
  readonly runtimeRulesVersion: string;
  readonly sportId: string;
  readonly variantId: string;
  readonly competitionTypeId: string;
  /** Cricket execution fields when sport is cricket. */
  readonly cricket: CricketRuntimeExecutionFields | null;
};

function ruleValue(
  rules: readonly ExecutableRule[],
  definitionId: string,
): ConcreteRuleValue | undefined {
  const hit = rules.find((r) => r.definitionId === definitionId);
  return hit?.value;
}

function num(
  rules: readonly ExecutableRule[],
  id: string,
  fallback: number,
): number {
  const v = ruleValue(rules, id);
  return typeof v === "number" ? v : fallback;
}

function bool(
  rules: readonly ExecutableRule[],
  id: string,
  fallback: boolean,
): boolean {
  const v = ruleValue(rules, id);
  return typeof v === "boolean" ? v : fallback;
}

function str(
  rules: readonly ExecutableRule[],
  id: string,
  fallback: string,
): string {
  const v = ruleValue(rules, id);
  return typeof v === "string" ? v : fallback;
}

function nullableNum(
  rules: readonly ExecutableRule[],
  id: string,
): number | null {
  const v = ruleValue(rules, id);
  if (v === null) return null;
  return typeof v === "number" ? v : null;
}

function buildCricketFields(
  rules: readonly ExecutableRule[],
): CricketRuntimeExecutionFields {
  return Object.freeze({
    oversLimit: num(rules, "cricket.match.overs_per_innings", 20),
    maxWickets: num(rules, "cricket.match.max_wickets", 10),
    playingSquadSize: num(rules, "cricket.match.playing_squad_size", 11),
    playingXiEnforced: bool(rules, "cricket.match.playing_xi_enforced", false),
    benchSize: num(rules, "cricket.match.bench_size", 4),
    ballsPerOver: num(rules, "cricket.match.balls_per_over", 6),
    ballType: str(rules, "cricket.match.ball_type", "leather"),
    lbwEnabled: bool(rules, "cricket.dismissal.lbw_enabled", true),
    legByeEnabled: bool(rules, "cricket.extras.leg_bye_enabled", true),
    freeHitEnabled: bool(rules, "cricket.bowling.free_hit_enabled", true),
    retireAtRuns: nullableNum(rules, "cricket.batting.retire_at_runs"),
    powerplayEnabled: bool(rules, "cricket.powerplay.enabled", true),
    superOverEnabled: bool(rules, "cricket.tie_break.super_over_enabled", true),
    superBallEnabled: bool(rules, "cricket.special.super_ball_enabled", false),
    superOverOvers: num(rules, "cricket.tie_break.super_over_overs", 1),
    superOverWickets: num(rules, "cricket.tie_break.super_over_wickets", 2),
    superOverTrigger: str(
      rules,
      "cricket.tie_break.super_over_trigger",
      "manual",
    ),
    tiesAllowed: bool(rules, "cricket.tie_break.ties_allowed", false),
  });
}

/**
 * Derive RuntimeExecutionPolicy from compiled ResolvedRuntimeRules.
 * Pure — no I/O, no CatalogRegistry, no Snapshot mutation.
 */
export function buildRuntimeExecutionPolicy(
  resolved: ResolvedRuntimeRules,
): RuntimeExecutionPolicy {
  const cricket =
    resolved.sportId === "cricket" ? buildCricketFields(resolved.rules) : null;

  return Object.freeze({
    schemaVersion: RUNTIME_EXECUTION_POLICY_SCHEMA_VERSION,
    resolutionId: resolved.resolutionId,
    rulesHash: resolved.rulesHash,
    runtimeRulesVersion: resolved.runtimeRulesVersion,
    sportId: resolved.sportId,
    variantId: resolved.variantId,
    competitionTypeId: resolved.competitionTypeId,
    cricket,
  });
}
