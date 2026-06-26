import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

type CategoryRow = typeof categoriesTable.$inferSelect;

export type CategoryTournamentGuardResult =
  | { ok: true; category: CategoryRow }
  | { ok: false; status: number; error: string };

/**
 * Validates that categoryId belongs to tournamentId.
 * Returns 403 when the category exists but belongs to a different tournament (IDOR).
 * Returns 404 when the category does not exist at all.
 */
export async function validateCategoryBelongsToTournament(
  tournamentId: number,
  categoryId: number,
): Promise<CategoryTournamentGuardResult> {
  const [category] = await db
    .select()
    .from(categoriesTable)
    .where(and(eq(categoriesTable.id, categoryId), eq(categoriesTable.tournamentId, tournamentId)));

  if (category) return { ok: true, category };

  const [anyCategory] = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId));

  if (anyCategory) {
    return { ok: false, status: 403, error: "Category does not belong to this tournament" };
  }
  return { ok: false, status: 404, error: "Category not found" };
}
