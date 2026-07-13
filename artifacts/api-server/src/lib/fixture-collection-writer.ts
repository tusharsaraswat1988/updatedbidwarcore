/**
 * Fixture Collection writer — single insert path for all Fixture Source Adapters.
 *
 * BidWar Scoring Architecture v1.0:
 *   Fixture Source Adapter → Fixture Collection → Fixtures
 *
 * Storage (Phase 1, no migration):
 *   Fixture Collection → badminton_draws
 *   Fixture            → badminton_fixtures
 *
 * Adapters (Auto / Manual / Import) MUST call this writer.
 * Adapters never create matches, start scoring, or schedule courts.
 *
 * @see docs/superpowers/specs/2026-07-13-draw-fixtures-module-design.md
 */

import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  badmintonCategoriesTable,
  badmintonDrawsTable,
  badmintonFixturesTable,
  type BadmintonDraw,
  type BadmintonFixture,
} from "@workspace/db";

/** Product collection kinds (extensible). Legacy rows may still use knockout_round. */
export type FixtureCollectionKind = "generated" | "imported" | "manual";

export type FixtureWriterInput = {
  slotNumber?: number | null;
  registrationAId?: number | null;
  registrationBId?: number | null;
  status?: string;
  winnerAdvancesTo?: number | null;
  loserAdvancesTo?: number | null;
  courtId?: number | null;
  scheduledAt?: Date | null;
  metaJson?: Record<string, unknown> | null;
};

export type CreateFixtureCollectionInput = {
  tournamentId: number;
  categoryId: number;
  /** Organizer-owned collection name (suggest defaults: Main Draw, Manual Fixtures, …). */
  roundName: string;
  drawKind: FixtureCollectionKind;
  roundNumber?: number;
  totalRounds?: number | null;
  status?: string;
  groupId?: string | null;
  metaJson?: Record<string, unknown> | null;
  fixtures: FixtureWriterInput[];
  /**
   * Legacy Auto Generate behavior: set category.phase = "live" after write.
   * Manual / Import leave category phase unchanged.
   */
  markCategoryLive?: boolean;
};

export type CreateFixturesResult = {
  collection: BadmintonDraw;
  fixtures: BadmintonFixture[];
};

/**
 * Single write path: insert Fixture Collection (badminton_draws) then Fixtures.
 */
export async function createFixtureCollection(
  input: CreateFixtureCollectionInput,
): Promise<CreateFixturesResult> {
  const [collection] = await db
    .insert(badmintonDrawsTable)
    .values({
      tournamentId: input.tournamentId,
      categoryId: input.categoryId,
      roundName: input.roundName,
      roundNumber: input.roundNumber ?? 1,
      totalRounds: input.totalRounds ?? null,
      drawKind: input.drawKind,
      status: input.status ?? "active",
      groupId: input.groupId ?? null,
      metaJson: input.metaJson ?? null,
    })
    .returning();

  if (input.fixtures.length === 0) {
    if (input.markCategoryLive) {
      await markCategoryLive(input.tournamentId, input.categoryId);
    }
    return { collection, fixtures: [] };
  }

  const fixtures = await db
    .insert(badmintonFixturesTable)
    .values(
      input.fixtures.map((f) => ({
        tournamentId: input.tournamentId,
        categoryId: input.categoryId,
        drawId: collection.id,
        slotNumber: f.slotNumber ?? null,
        registrationAId: f.registrationAId ?? null,
        registrationBId: f.registrationBId ?? null,
        status: f.status ?? "unscheduled",
        winnerAdvancesTo: f.winnerAdvancesTo ?? null,
        loserAdvancesTo: f.loserAdvancesTo ?? null,
        courtId: f.courtId ?? null,
        scheduledAt: f.scheduledAt ?? null,
        metaJson: f.metaJson ?? null,
      })),
    )
    .returning();

  if (input.markCategoryLive) {
    await markCategoryLive(input.tournamentId, input.categoryId);
  }

  return { collection, fixtures };
}

async function markCategoryLive(tournamentId: number, categoryId: number): Promise<void> {
  await db
    .update(badmintonCategoriesTable)
    .set({ phase: "live", updatedAt: new Date() })
    .where(
      and(
        eq(badmintonCategoriesTable.id, categoryId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    );
}

/**
 * Import adapter — Phase 1 stub only.
 * No parser / no backend processing. Future Excel/CSV/PDF plug in here.
 */
export function importFixtureCollectionStub(): never {
  throw Object.assign(new Error("Import adapter not implemented (Phase 1 stub)"), {
    status: 501,
    code: "IMPORT_NOT_IMPLEMENTED",
  });
}
