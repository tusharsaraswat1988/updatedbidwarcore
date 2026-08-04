/**
 * Tournament Stage Helper — sole abstraction for category stage vocabulary.
 *
 * P0 persists legacy literals (quarter_final / semi_final / final).
 * Lifecycle view maps those to generic elimination for engine logic.
 *
 * Future migration: change promotionPersistedStage() + toLifecycleStage() only.
 */

import { and, eq } from "drizzle-orm";
import {
  isTournamentEngineStage,
  resolveCurrentStage,
  type TournamentEngineStage,
} from "@workspace/badminton-core";
import { db, badmintonCategoriesTable } from "@workspace/db";

export type DbExecutor = Pick<typeof db, "select" | "insert" | "delete" | "update">;

/** Values stored in badminton_categories.current_stage today. */
export type PersistedTournamentStage = TournamentEngineStage;

/** Generic engine lifecycle (future DB vocabulary). */
export type LifecycleStage = "league" | "elimination" | "completed";

/**
 * Persisted stage written on successful league→knockout promotion (P0).
 * Do not scatter "quarter_final" literals — call this helper instead.
 */
export function promotionPersistedStage(): PersistedTournamentStage {
  return "quarter_final";
}

/** Map persisted / resolved stage → lifecycle stage for engine decisions. */
export function toLifecycleStage(
  stage: string | null | undefined,
): LifecycleStage | null {
  if (stage == null) return null;
  if (stage === "league") return "league";
  if (stage === "completed") return "completed";
  if (
    stage === "quarter_final" ||
    stage === "semi_final" ||
    stage === "final" ||
    stage === "elimination"
  ) {
    return "elimination";
  }
  return null;
}

export function resolveLifecycleStage(row: {
  drawType: string;
  currentStage: string | null;
  phase?: string | null;
}): LifecycleStage | null {
  return toLifecycleStage(
    resolveCurrentStage({
      drawType: row.drawType,
      currentStage: row.currentStage,
      phase: row.phase,
    }),
  );
}

export function assertPersistedStage(
  value: unknown,
): asserts value is PersistedTournamentStage {
  if (!isTournamentEngineStage(value)) {
    throw new Error(`Invalid persisted tournament stage: ${String(value)}`);
  }
}

/** Sole write path for category.current_stage. */
export async function writeCategoryStage(
  executor: DbExecutor,
  tournamentId: number,
  categoryId: number,
  stage: PersistedTournamentStage | null,
): Promise<void> {
  if (stage != null) assertPersistedStage(stage);
  await executor
    .update(badmintonCategoriesTable)
    .set({ currentStage: stage, updatedAt: new Date() })
    .where(
      and(
        eq(badmintonCategoriesTable.id, categoryId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    );
}

/** Mark category as promoted into knockout (writes today's persisted literal). */
export async function setPromotionStage(
  executor: DbExecutor,
  tournamentId: number,
  categoryId: number,
): Promise<PersistedTournamentStage> {
  const stage = promotionPersistedStage();
  await writeCategoryStage(executor, tournamentId, categoryId, stage);
  return stage;
}
