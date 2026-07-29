/**
 * Bulk-create scoring matches from scheduled fixtures (no toss — court start wizard).
 */

import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  badmintonCategoriesTable,
  badmintonCourtsTable,
  badmintonFixturesTable,
  badmintonRegistrationsTable,
} from "@workspace/db";
import { isPairMatchKind, mergeDoublesSideJson } from "@workspace/badminton-core";
import type { BadmintonSideInfo } from "@workspace/badminton-core";
import {
  createBadmintonMatch,
  ensureBadmintonTournament,
  BadmintonServiceError,
} from "./badminton-service";
import { canCreateMatchFromFixture } from "./fixture-scheduling";
import { buildSideJsonFromBadmintonPlayer } from "./master-sports/badminton";

export type BulkCreateMatchItem = {
  fixtureId: number;
  matchId: number;
  slotNumber: number | null;
};

export type BulkCreateMatchResult = {
  created: BulkCreateMatchItem[];
  skipped: Array<{ fixtureId: number; reason: string }>;
  failed: Array<{ fixtureId: number; error: string }>;
};

async function buildRegistrationSideJson(
  registration: { player1Id: number; player2Id: number | null },
  tournamentId: number,
  matchType: string,
): Promise<Record<string, unknown>> {
  const isPair = isPairMatchKind(matchType);
  const player1Side = await buildSideJsonFromBadmintonPlayer(
    registration.player1Id,
    tournamentId,
  );
  if (!isPair) return player1Side;
  if (registration.player2Id == null) {
    throw new Error("Doubles entry is missing a partner");
  }
  const player2Side = await buildSideJsonFromBadmintonPlayer(
    registration.player2Id,
    tournamentId,
  );
  return mergeDoublesSideJson(
    player1Side as Partial<BadmintonSideInfo>,
    player2Side as Partial<BadmintonSideInfo>,
  ) as Record<string, unknown>;
}

function fixtureSortKey(f: {
  scheduledAt: Date | string | null;
  slotNumber: number | null;
  id: number;
}): number {
  const t = f.scheduledAt ? new Date(f.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (Number.isNaN(t)) return Number.MAX_SAFE_INTEGER;
  return t * 1000 + (f.slotNumber ?? f.id);
}

export async function bulkCreateBadmintonMatchesFromFixtures(
  tournamentId: number,
  opts: { courtId?: number; fixtureIds?: number[] },
): Promise<BulkCreateMatchResult> {
  await ensureBadmintonTournament(tournamentId);

  const result: BulkCreateMatchResult = { created: [], skipped: [], failed: [] };

  const allFixtures = await db
    .select()
    .from(badmintonFixturesTable)
    .where(eq(badmintonFixturesTable.tournamentId, tournamentId));

  let scope = allFixtures;
  if (opts.fixtureIds?.length) {
    const idSet = new Set(opts.fixtureIds);
    scope = scope.filter((f) => idSet.has(f.id));
  } else if (opts.courtId != null) {
    scope = scope.filter((f) => f.courtId === opts.courtId);
  }

  const eligible: typeof scope = [];
  for (const fixture of scope) {
    const gate = canCreateMatchFromFixture(fixture);
    if (!gate.ok) {
      result.skipped.push({ fixtureId: fixture.id, reason: gate.error });
      continue;
    }
    eligible.push(fixture);
  }

  eligible.sort((a, b) => fixtureSortKey(a) - fixtureSortKey(b));

  if (eligible.length === 0) return result;

  const categoryIds = [...new Set(eligible.map((f) => f.categoryId))];
  const categories = await db
    .select()
    .from(badmintonCategoriesTable)
    .where(
      and(
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
        inArray(badmintonCategoriesTable.id, categoryIds),
      ),
    );
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const registrationIds = new Set<number>();
  for (const f of eligible) {
    if (f.registrationAId != null) registrationIds.add(f.registrationAId);
    if (f.registrationBId != null) registrationIds.add(f.registrationBId);
  }

  const registrations =
    registrationIds.size > 0
      ? await db
          .select()
          .from(badmintonRegistrationsTable)
          .where(
            and(
              eq(badmintonRegistrationsTable.tournamentId, tournamentId),
              inArray(badmintonRegistrationsTable.id, [...registrationIds]),
            ),
          )
      : [];
  const registrationById = new Map(registrations.map((r) => [r.id, r]));

  const courtIds = [
    ...new Set(eligible.map((f) => f.courtId).filter((id): id is number => id != null)),
  ];
  const courts =
    courtIds.length > 0
      ? await db
          .select()
          .from(badmintonCourtsTable)
          .where(
            and(
              eq(badmintonCourtsTable.tournamentId, tournamentId),
              inArray(badmintonCourtsTable.id, courtIds),
            ),
          )
      : [];
  const courtById = new Map(courts.map((c) => [c.id, c]));

  for (const fixture of eligible) {
    const category = categoryById.get(fixture.categoryId);
    if (!category) {
      result.failed.push({ fixtureId: fixture.id, error: "Event not found for this fixture" });
      continue;
    }

    if (fixture.registrationAId == null || fixture.registrationBId == null) {
      result.skipped.push({
        fixtureId: fixture.id,
        reason: "Both sides need an accepted entry before creating a match",
      });
      continue;
    }

    const regA = registrationById.get(fixture.registrationAId);
    const regB = registrationById.get(fixture.registrationBId);
    if (!regA || !regB) {
      result.failed.push({
        fixtureId: fixture.id,
        error: "Could not load entries for this fixture",
      });
      continue;
    }

    if (fixture.courtId == null || !fixture.scheduledAt) {
      result.skipped.push({
        fixtureId: fixture.id,
        reason: "Assign a court and time before creating a match",
      });
      continue;
    }

    try {
      const [leftSideJson, rightSideJson] = await Promise.all([
        buildRegistrationSideJson(regA, tournamentId, category.matchType),
        buildRegistrationSideJson(regB, tournamentId, category.matchType),
      ]);

      const court = courtById.get(fixture.courtId);
      const created = await createBadmintonMatch({
        tournamentId,
        categoryId: fixture.categoryId,
        fixtureId: fixture.id,
        courtId: fixture.courtId,
        courtNumber: court?.shortName?.trim() || court?.name || undefined,
        matchLabel: `${category.name} · Match ${fixture.slotNumber ?? fixture.id}`,
        matchType: category.matchType,
        leftSideJson,
        rightSideJson,
        scheduledAt: new Date(fixture.scheduledAt),
      });

      result.created.push({
        fixtureId: fixture.id,
        matchId: created.match.id,
        slotNumber: fixture.slotNumber,
      });
    } catch (err) {
      const message =
        err instanceof BadmintonServiceError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to create match";
      result.failed.push({ fixtureId: fixture.id, error: message });
    }
  }

  return result;
}
