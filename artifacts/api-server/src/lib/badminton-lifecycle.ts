/**
 * Badminton tournament lifecycle — auto-complete categories and scoring phase
 * when all matches/fixtures for an event are finished.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  badmintonCategoriesTable,
  badmintonFixturesTable,
  badmintonMatchDetailsTable,
  scoringMatchesTable,
  tournamentsTable,
} from "@workspace/db";
import { isBadmintonTerminalMatchStatus } from "@workspace/badminton-core";
import { broadcastTournamentUpdate } from "./badminton-broadcast";

const ACTIVE_MATCH_STATUSES = new Set(["live", "paused", "scheduled"]);
const CLOSED_FIXTURE_STATUSES = new Set(["walkover", "cancelled", "completed"]);
const STARTED_CATEGORY_PHASES = new Set(["draw_generated", "live", "completed"]);

export type LifecycleRefreshResult = {
  categoriesUpdated: number[];
  tournamentScoringPhase: string | null;
  tournamentCompleted: boolean;
};

type MatchRow = {
  id: number;
  status: string;
  categoryId: number | null;
};

type FixtureRow = {
  id: number;
  categoryId: number;
  scoringMatchId: number | null;
  status: string;
};

function isOpenFixture(f: FixtureRow): boolean {
  if (f.scoringMatchId != null) return false;
  return !CLOSED_FIXTURE_STATUSES.has(f.status);
}

function categoryHasStarted(
  category: { id: number; phase: string },
  fixtures: FixtureRow[],
  matches: MatchRow[],
): boolean {
  if (STARTED_CATEGORY_PHASES.has(category.phase)) return true;
  return (
    fixtures.some((f) => f.categoryId === category.id) ||
    matches.some((m) => m.categoryId === category.id)
  );
}

function isCategoryComplete(
  category: { id: number; phase: string },
  fixtures: FixtureRow[],
  matches: MatchRow[],
): boolean {
  if (!categoryHasStarted(category, fixtures, matches)) return false;

  const catMatches = matches.filter((m) => m.categoryId === category.id);
  const catFixtures = fixtures.filter((f) => f.categoryId === category.id);

  const remainingMatches = catMatches.filter((m) => ACTIVE_MATCH_STATUSES.has(m.status));
  const openFixtures = catFixtures.filter(isOpenFixture);
  if (remainingMatches.length > 0 || openFixtures.length > 0) return false;

  const hasFinished = catMatches.some((m) => isBadmintonTerminalMatchStatus(m.status));
  if (hasFinished) return true;

  if (catFixtures.length === 0) return false;

  return catFixtures.every(
    (f) => f.scoringMatchId != null || CLOSED_FIXTURE_STATUSES.has(f.status),
  );
}

/**
 * Re-evaluate category phases and tournament scoringPhase after scoring changes.
 * Only moves scoringPhase between active ↔ completed (never touches disabled).
 */
export async function refreshBadmintonLifecycle(
  tournamentId: number,
): Promise<LifecycleRefreshResult> {
  const [tournament] = await db
    .select({
      scoringPhase: tournamentsTable.scoringPhase,
      scoringEnabled: tournamentsTable.scoringEnabled,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament?.scoringEnabled) {
    return {
      categoriesUpdated: [],
      tournamentScoringPhase: null,
      tournamentCompleted: false,
    };
  }

  const categories = await db
    .select({
      id: badmintonCategoriesTable.id,
      phase: badmintonCategoriesTable.phase,
    })
    .from(badmintonCategoriesTable)
    .where(eq(badmintonCategoriesTable.tournamentId, tournamentId));

  const matchRows = await db
    .select({
      id: scoringMatchesTable.id,
      status: scoringMatchesTable.status,
      categoryId: badmintonMatchDetailsTable.categoryId,
    })
    .from(scoringMatchesTable)
    .innerJoin(
      badmintonMatchDetailsTable,
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, scoringMatchesTable.id),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
      ),
    )
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, "badminton"),
      ),
    );

  const fixtures = await db
    .select({
      id: badmintonFixturesTable.id,
      categoryId: badmintonFixturesTable.categoryId,
      scoringMatchId: badmintonFixturesTable.scoringMatchId,
      status: badmintonFixturesTable.status,
    })
    .from(badmintonFixturesTable)
    .where(eq(badmintonFixturesTable.tournamentId, tournamentId));

  const phaseById = new Map(categories.map((c) => [c.id, c.phase]));
  const categoriesUpdated: number[] = [];

  for (const category of categories) {
    const complete = isCategoryComplete(category, fixtures, matchRows);
    const currentPhase = phaseById.get(category.id) ?? category.phase;

    if (complete && currentPhase !== "completed") {
      await db
        .update(badmintonCategoriesTable)
        .set({ phase: "completed", updatedAt: new Date() })
        .where(
          and(
            eq(badmintonCategoriesTable.id, category.id),
            eq(badmintonCategoriesTable.tournamentId, tournamentId),
          ),
        );
      phaseById.set(category.id, "completed");
      categoriesUpdated.push(category.id);
      continue;
    }

    if (
      !complete &&
      currentPhase === "completed" &&
      categoryHasStarted(category, fixtures, matchRows)
    ) {
      await db
        .update(badmintonCategoriesTable)
        .set({ phase: "live", updatedAt: new Date() })
        .where(
          and(
            eq(badmintonCategoriesTable.id, category.id),
            eq(badmintonCategoriesTable.tournamentId, tournamentId),
          ),
        );
      phaseById.set(category.id, "live");
      categoriesUpdated.push(category.id);
    }
  }

  const startedCategories = categories.filter((c) =>
    categoryHasStarted(c, fixtures, matchRows),
  );

  const allStartedComplete =
    startedCategories.length > 0 &&
    startedCategories.every((c) => phaseById.get(c.id) === "completed");

  const anyLive = matchRows.some(
    (m) => m.status === "live" || m.status === "paused",
  );

  let newScoringPhase = tournament.scoringPhase;

  if (tournament.scoringPhase === "active" && allStartedComplete && !anyLive) {
    await db
      .update(tournamentsTable)
      .set({ scoringPhase: "completed", updatedAt: new Date() })
      .where(eq(tournamentsTable.id, tournamentId));
    newScoringPhase = "completed";
  } else if (
    tournament.scoringPhase === "completed" &&
    (!allStartedComplete || anyLive)
  ) {
    await db
      .update(tournamentsTable)
      .set({ scoringPhase: "active", updatedAt: new Date() })
      .where(eq(tournamentsTable.id, tournamentId));
    newScoringPhase = "active";
  }

  const result: LifecycleRefreshResult = {
    categoriesUpdated,
    tournamentScoringPhase: newScoringPhase,
    tournamentCompleted: newScoringPhase === "completed",
  };

  if (categoriesUpdated.length > 0 || newScoringPhase !== tournament.scoringPhase) {
    broadcastTournamentUpdate(tournamentId, {
      type: "lifecycle_updated",
      ...result,
    });
  }

  return result;
}

export function scheduleBadmintonLifecycleRefresh(tournamentId: number): void {
  void refreshBadmintonLifecycle(tournamentId).catch((err) => {
    console.error("[badminton-lifecycle] refresh failed:", err);
  });
}
