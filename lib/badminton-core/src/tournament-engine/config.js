import { DEFAULT_QUALIFIERS_PER_GROUP, LEGACY_RANKING_RULES, PRODUCT_DEFAULT_RANKING_RULES, normalizeRankingRules, isTournamentEngineStage, } from "./types";
/**
 * Resolve ranking rules for a category.
 * - Explicit JSON → normalized rules
 * - Null/absent → LEGACY (existing tournaments)
 * Use PRODUCT_DEFAULT_RANKING_RULES when inserting new categories.
 */
export function resolveRankingRules(rankingRulesJson) {
    return normalizeRankingRules(rankingRulesJson) ?? LEGACY_RANKING_RULES;
}
export function resolveQualificationRules(row) {
    const qualifiersPerGroup = row.qualifiersPerGroup != null && row.qualifiersPerGroup > 0
        ? row.qualifiersPerGroup
        : null;
    const qualifierMode = row.qualifierMode === "per_group" || row.qualifierMode === "category"
        ? row.qualifierMode
        : null;
    const groupCount = row.groupCount ?? 0;
    const effectiveQualifierMode = qualifierMode ?? (groupCount > 1 ? "per_group" : "category");
    const effectiveQualifiersPerGroup = qualifiersPerGroup ?? DEFAULT_QUALIFIERS_PER_GROUP;
    return {
        qualifiersPerGroup,
        qualifierMode,
        effectiveQualifiersPerGroup,
        effectiveQualifierMode,
    };
}
/**
 * Derive a sensible initial stage from draw type when current_stage is null.
 * Existing categories keep null until first write; readers use this fallback.
 */
export function resolveCurrentStage(row) {
    if (isTournamentEngineStage(row.currentStage))
        return row.currentStage;
    if (row.phase === "completed")
        return "completed";
    if (row.drawType === "knockout")
        return null;
    if (row.drawType === "round_robin" || row.drawType === "group_knockout") {
        return "league";
    }
    return null;
}
export function initialStageForDrawType(drawType) {
    if (drawType === "round_robin" || drawType === "group_knockout")
        return "league";
    // Pure knockout: stage is set when the bracket is generated (round size known).
    return null;
}
export { PRODUCT_DEFAULT_RANKING_RULES, LEGACY_RANKING_RULES };
