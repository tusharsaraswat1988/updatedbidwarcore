/**
 * Badminton Tournament Engine service (UI-agnostic).
 * Owns stage / ranking / qualification config resolution.
 * Does not know about screens, buttons, or navigation.
 */

import { and, eq } from "drizzle-orm";
import {
  PRODUCT_DEFAULT_RANKING_RULES,
  initialStageForDrawType,
  isTournamentEngineStage,
  normalizeRankingRules,
  resolveCurrentStage,
  resolveQualificationRules,
  resolveRankingRules,
  type QualifierMode,
  type TournamentEngineRankingRules,
  type TournamentEngineStage,
} from "@workspace/badminton-core";
import { db, badmintonCategoriesTable, badmintonGroupsTable } from "@workspace/db";

export type TournamentEngineConfigView = {
  categoryId: number;
  tournamentId: number;
  drawType: string;
  phase: string;
  currentStage: TournamentEngineStage | null;
  rankingRules: TournamentEngineRankingRules;
  rankingRulesSource: "configured" | "legacy_fallback" | "product_default";
  qualification: {
    qualifiersPerGroup: number | null;
    qualifierMode: QualifierMode | null;
    effectiveQualifiersPerGroup: number;
    effectiveQualifierMode: QualifierMode;
  };
  promotedKnockoutAt: string | null;
  canPromoteToKnockout: boolean;
};

export type TournamentEngineConfigUpdate = {
  currentStage?: TournamentEngineStage | null;
  rankingRules?: TournamentEngineRankingRules;
  qualifiersPerGroup?: number | null;
  qualifierMode?: QualifierMode | null;
};

function rankingSource(
  rankingRulesJson: unknown,
): TournamentEngineConfigView["rankingRulesSource"] {
  if (normalizeRankingRules(rankingRulesJson)) return "configured";
  return "legacy_fallback";
}

export async function getTournamentEngineConfig(
  tournamentId: number,
  categoryId: number,
): Promise<TournamentEngineConfigView | null> {
  const [cat] = await db
    .select()
    .from(badmintonCategoriesTable)
    .where(
      and(
        eq(badmintonCategoriesTable.id, categoryId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);
  if (!cat) return null;

  const groups = await db
    .select({ id: badmintonGroupsTable.id })
    .from(badmintonGroupsTable)
    .where(
      and(
        eq(badmintonGroupsTable.tournamentId, tournamentId),
        eq(badmintonGroupsTable.categoryId, categoryId),
      ),
    );

  const qualification = resolveQualificationRules({
    qualifiersPerGroup: cat.qualifiersPerGroup,
    qualifierMode: cat.qualifierMode,
    groupCount: groups.length,
  });

  const currentStage = resolveCurrentStage({
    drawType: cat.drawType,
    currentStage: cat.currentStage,
    phase: cat.phase,
  });

  const isLeagueFamily =
    cat.drawType === "round_robin" || cat.drawType === "group_knockout";

  return {
    categoryId: cat.id,
    tournamentId: cat.tournamentId,
    drawType: cat.drawType,
    phase: cat.phase,
    currentStage,
    rankingRules: resolveRankingRules(cat.rankingRulesJson),
    rankingRulesSource: rankingSource(cat.rankingRulesJson),
    qualification,
    promotedKnockoutAt: cat.promotedKnockoutAt
      ? cat.promotedKnockoutAt.toISOString()
      : null,
    canPromoteToKnockout:
      isLeagueFamily &&
      cat.drawType === "group_knockout" &&
      !cat.promotedKnockoutAt &&
      currentStage === "league",
  };
}

export async function updateTournamentEngineConfig(
  tournamentId: number,
  categoryId: number,
  update: TournamentEngineConfigUpdate,
): Promise<TournamentEngineConfigView | null> {
  const patch: Partial<typeof badmintonCategoriesTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (update.currentStage !== undefined) {
    if (update.currentStage != null && !isTournamentEngineStage(update.currentStage)) {
      throw new Error("Invalid currentStage");
    }
    patch.currentStage = update.currentStage;
  }

  if (update.rankingRules !== undefined) {
    const normalized = normalizeRankingRules(update.rankingRules);
    if (!normalized) throw new Error("Invalid rankingRules");
    patch.rankingRulesJson = normalized;
  }

  if (update.qualifiersPerGroup !== undefined) {
    if (
      update.qualifiersPerGroup != null &&
      (!Number.isInteger(update.qualifiersPerGroup) || update.qualifiersPerGroup < 1)
    ) {
      throw new Error("qualifiersPerGroup must be a positive integer or null");
    }
    patch.qualifiersPerGroup = update.qualifiersPerGroup;
  }

  if (update.qualifierMode !== undefined) {
    if (
      update.qualifierMode != null &&
      update.qualifierMode !== "per_group" &&
      update.qualifierMode !== "category"
    ) {
      throw new Error("qualifierMode must be per_group, category, or null");
    }
    patch.qualifierMode = update.qualifierMode;
  }

  const [cat] = await db
    .update(badmintonCategoriesTable)
    .set(patch)
    .where(
      and(
        eq(badmintonCategoriesTable.id, categoryId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    )
    .returning({ id: badmintonCategoriesTable.id });

  if (!cat) return null;
  return getTournamentEngineConfig(tournamentId, categoryId);
}

/** Values applied when creating a new category (product defaults). */
export function newCategoryEngineDefaults(drawType: string): {
  rankingRulesJson: TournamentEngineRankingRules;
  currentStage: TournamentEngineStage | null;
  qualifiersPerGroup: number | null;
  qualifierMode: QualifierMode | null;
} {
  const isLeagueFamily =
    drawType === "round_robin" || drawType === "group_knockout";
  return {
    rankingRulesJson: [...PRODUCT_DEFAULT_RANKING_RULES],
    currentStage: initialStageForDrawType(drawType),
    qualifiersPerGroup: isLeagueFamily ? 4 : null,
    qualifierMode: isLeagueFamily ? "per_group" : null,
  };
}
