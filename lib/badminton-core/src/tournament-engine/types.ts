/**
 * Badminton Tournament Engine — shared types (UI-agnostic).
 *
 * Stage values are the single source of truth for Dashboard / OBS / Display / APIs.
 * Do not overload DrawStageKey (match-format inheritance) with these values.
 */

/** Category-level tournament progression stage. */
export const TOURNAMENT_ENGINE_STAGES = [
  "league",
  "quarter_final",
  "semi_final",
  "final",
  "completed",
] as const;

export type TournamentEngineStage = (typeof TOURNAMENT_ENGINE_STAGES)[number];

/** Ordered ranking criteria keys. */
export const RANKING_RULE_KEYS = [
  "wins",
  "pointsDifference",
  "headToHead",
  "random",
  /** Stable deterministic fallback used by legacy tournaments only. */
  "registrationId",
] as const;

export type RankingRuleKey = (typeof RANKING_RULE_KEYS)[number];

export type QualifierMode = "per_group" | "category";

export type TournamentEngineRankingRules = RankingRuleKey[];

export type TournamentEngineQualificationRules = {
  qualifiersPerGroup: number | null;
  qualifierMode: QualifierMode | null;
};

/**
 * Product default for every NEW category.
 * Wins → Points Difference → Head-to-Head → Random Draw.
 */
export const PRODUCT_DEFAULT_RANKING_RULES: TournamentEngineRankingRules = [
  "wins",
  "pointsDifference",
  "headToHead",
  "random",
];

/**
 * Legacy fallback for existing categories with null ranking_rules_json.
 * Preserves pre-P0.2 VNBL behavior: wins → margin → registration id.
 */
export const LEGACY_RANKING_RULES: TournamentEngineRankingRules = [
  "wins",
  "pointsDifference",
  "registrationId",
];

export const DEFAULT_QUALIFIERS_PER_GROUP = 4;

export function isTournamentEngineStage(value: unknown): value is TournamentEngineStage {
  return (
    typeof value === "string" &&
    (TOURNAMENT_ENGINE_STAGES as readonly string[]).includes(value)
  );
}

export function isRankingRuleKey(value: unknown): value is RankingRuleKey {
  return typeof value === "string" && (RANKING_RULE_KEYS as readonly string[]).includes(value);
}

export function normalizeRankingRules(
  rules: unknown,
): TournamentEngineRankingRules | null {
  if (!Array.isArray(rules) || rules.length === 0) return null;
  const out: RankingRuleKey[] = [];
  for (const item of rules) {
    if (!isRankingRuleKey(item)) return null;
    if (!out.includes(item)) out.push(item);
  }
  return out.length > 0 ? out : null;
}
