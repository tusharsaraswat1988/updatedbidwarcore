/**
 * League → Knockout Promotion Engine.
 *
 * Explicit orchestration only. Never auto-promote from standings rebuilds.
 * Reuses standings, knockout planner, fixture writer, and progression wiring.
 */

import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import {
  db,
  badmintonCategoriesTable,
  badmintonDrawsTable,
  badmintonFixturesTable,
  tournamentsTable,
  type BadmintonDraw,
  type BadmintonFixture,
} from "@workspace/db";
import { getCategoryPairStandings } from "./badminton-league-service";
import { getTournamentEngineConfig } from "./badminton-tournament-engine";
import { planKnockoutBracket } from "./badminton-knockout-plan";
import { createFixtureCollection } from "./fixture-collection-writer";
import {
  advanceKnockoutWinner,
  wireKnockoutProgressionLinks,
} from "./badminton-knockout-progression";
import {
  advanceStage,
  initialKnockoutStageFromRounds,
  isLeague,
  promotionPersistedStage,
  resolveStageDto,
  setPromotionStage,
  type PersistedTournamentStage,
  type TournamentStageDto,
} from "./tournament-stage";
import { logger } from "./logger";

/** P0 default — scoring matches are NOT created by promotion. */
export type MatchCreationMode = "AUTO" | "MANUAL";
export const DEFAULT_MATCH_CREATION_MODE: MatchCreationMode = "MANUAL";

/** Fixture statuses that allow promotion (league complete). */
export const LEAGUE_TERMINAL_FIXTURE_STATUSES = [
  "completed",
  "walkover",
  "cancelled",
] as const;

const LEGACY_KNOCKOUT_ROUND_NAMES = new Set([
  "Final",
  "Semi-Finals",
  "Quarter-Finals",
  "Round of 16",
  "Round of 32",
  "Round of 64",
]);

export type PromotionErrorCode =
  | "TOURNAMENT_NOT_FOUND"
  | "CATEGORY_NOT_FOUND"
  | "STAGE_NOT_LEAGUE"
  | "DRAW_TYPE_NOT_PROMOTABLE"
  | "LEAGUE_NOT_COMPLETE"
  | "STANDINGS_UNAVAILABLE"
  | "QUALIFIERS_UNRESOLVABLE"
  | "DUPLICATE_QUALIFIERS"
  | "INVALID_CONFIGURATION"
  | "INCONSISTENT_TOURNAMENT_STATE"
  | "PROMOTION_FAILED";

export class PromotionError extends Error {
  readonly code: PromotionErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: PromotionErrorCode,
    message: string,
    status = 409,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PromotionError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type PromotionBracket = {
  drawId: number;
  collections: BadmintonDraw[];
  fixtures: BadmintonFixture[];
  rounds: Array<{
    roundNumber: number;
    roundName: string;
    fixtureCount: number;
  }>;
  qualifiers: Array<{
    rank: number;
    registrationId: number;
    label: string;
    groupId: number | null;
  }>;
};

export type PromotionResult = {
  created: boolean;
  skipped: boolean;
  reason?: string;
  /** @deprecated Prefer `tournamentStage.currentStage` — string kept for API BC. */
  stage: PersistedTournamentStage;
  /** Canonical stage DTO from resolveStageDto / setPromotionStage. */
  tournamentStage: TournamentStageDto;
  bracket: PromotionBracket;
};

function isLeagueTerminalStatus(status: string): boolean {
  return (LEAGUE_TERMINAL_FIXTURE_STATUSES as readonly string[]).includes(status);
}

function isKnockoutDraw(draw: {
  groupId: string | null;
  roundName: string;
  metaJson: Record<string, unknown> | null;
}): boolean {
  if (draw.groupId != null) return false;
  const algorithm = draw.metaJson?.algorithm;
  if (algorithm === "knockout") return true;
  const adapter = draw.metaJson?.adapter;
  if (adapter === "promote_to_knockout" || adapter === "auto_generate") return true;
  return LEGACY_KNOCKOUT_ROUND_NAMES.has(draw.roundName);
}

export function findDuplicateQualifierIds(
  registrationIds: number[],
): number[] {
  const seen = new Set<number>();
  const dupes = new Set<number>();
  for (const id of registrationIds) {
    if (seen.has(id)) dupes.add(id);
    else seen.add(id);
  }
  return [...dupes];
}

/**
 * Extension point for optional Round-1 scoring match creation.
 * P0: MANUAL only — never blocks promotion success.
 */
async function maybeCreateRound1Matches(input: {
  tournamentId: number;
  categoryId: number;
  fixtures: BadmintonFixture[];
  mode: MatchCreationMode;
}): Promise<void> {
  if (input.mode !== "AUTO") return;
  // Future: bulkCreateBadmintonMatchesFromFixtures for R1 non-bye fixtures.
  logger.info(
    {
      tournamentId: input.tournamentId,
      categoryId: input.categoryId,
      fixtureCount: input.fixtures.length,
    },
    "TOURNAMENT_PROMOTION_MATCH_CREATION_SKIPPED",
  );
}

async function loadCategory(tournamentId: number, categoryId: number) {
  const [tournament] = await db
    .select({ id: tournamentsTable.id })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  if (!tournament) {
    throw new PromotionError("TOURNAMENT_NOT_FOUND", "Tournament not found.", 404);
  }

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
  if (!cat) {
    throw new PromotionError("CATEGORY_NOT_FOUND", "Category not found.", 404);
  }
  return cat;
}

async function countIncompleteLeagueFixtures(
  tournamentId: number,
  categoryId: number,
): Promise<number> {
  const leagueDraws = await db
    .select({ id: badmintonDrawsTable.id })
    .from(badmintonDrawsTable)
    .where(
      and(
        eq(badmintonDrawsTable.tournamentId, tournamentId),
        eq(badmintonDrawsTable.categoryId, categoryId),
        isNotNull(badmintonDrawsTable.groupId),
      ),
    );

  if (leagueDraws.length === 0) return 0;

  const drawIds = leagueDraws.map((d) => d.id);
  const fixtures = await db
    .select({ id: badmintonFixturesTable.id, status: badmintonFixturesTable.status })
    .from(badmintonFixturesTable)
    .where(
      and(
        eq(badmintonFixturesTable.tournamentId, tournamentId),
        eq(badmintonFixturesTable.categoryId, categoryId),
        inArray(badmintonFixturesTable.drawId, drawIds),
      ),
    );

  return fixtures.filter((f) => !isLeagueTerminalStatus(f.status)).length;
}

async function loadDrawBracket(
  tournamentId: number,
  categoryId: number,
  drawId: number,
): Promise<PromotionBracket | null> {
  const [anchor] = await db
    .select()
    .from(badmintonDrawsTable)
    .where(
      and(
        eq(badmintonDrawsTable.id, drawId),
        eq(badmintonDrawsTable.tournamentId, tournamentId),
        eq(badmintonDrawsTable.categoryId, categoryId),
      ),
    )
    .limit(1);
  if (!anchor) return null;

  const collections = await db
    .select()
    .from(badmintonDrawsTable)
    .where(
      and(
        eq(badmintonDrawsTable.tournamentId, tournamentId),
        eq(badmintonDrawsTable.categoryId, categoryId),
        isNull(badmintonDrawsTable.groupId),
      ),
    );

  const promotedCollections = collections.filter((c) => {
    const adapter = (c.metaJson as { adapter?: string } | null)?.adapter;
    if (adapter === "promote_to_knockout") return true;
    if (c.id === drawId) return true;
    if (
      anchor.totalRounds != null &&
      c.totalRounds === anchor.totalRounds &&
      isKnockoutDraw(c)
    ) {
      return true;
    }
    return false;
  });

  if (promotedCollections.length === 0) return null;

  const collectionIds = promotedCollections.map((c) => c.id);
  const fixtures =
    collectionIds.length > 0
      ? await db
          .select()
          .from(badmintonFixturesTable)
          .where(
            and(
              eq(badmintonFixturesTable.tournamentId, tournamentId),
              eq(badmintonFixturesTable.categoryId, categoryId),
              inArray(badmintonFixturesTable.drawId, collectionIds),
            ),
          )
      : [];

  const expectedRounds = anchor.totalRounds ?? promotedCollections.length;
  if (fixtures.length === 0 || promotedCollections.length < expectedRounds) {
    return null;
  }

  const sorted = promotedCollections.toSorted(
    (a, b) => a.roundNumber - b.roundNumber || a.id - b.id,
  );

  return {
    drawId: anchor.id,
    collections: sorted,
    fixtures,
    rounds: sorted.map((c) => ({
      roundNumber: c.roundNumber,
      roundName: c.roundName,
      fixtureCount: fixtures.filter((f) => f.drawId === c.id).length,
    })),
    qualifiers: [],
  };
}

async function detectLegacyKnockout(
  tournamentId: number,
  categoryId: number,
): Promise<PromotionBracket | null> {
  const draws = await db
    .select()
    .from(badmintonDrawsTable)
    .where(
      and(
        eq(badmintonDrawsTable.tournamentId, tournamentId),
        eq(badmintonDrawsTable.categoryId, categoryId),
        isNull(badmintonDrawsTable.groupId),
      ),
    );

  const knockoutDraws = draws.filter(isKnockoutDraw);
  if (knockoutDraws.length === 0) return null;

  const sorted = knockoutDraws.toSorted(
    (a, b) => a.roundNumber - b.roundNumber || a.id - b.id,
  );
  const anchor = sorted[0]!;
  const collectionIds = sorted.map((d) => d.id);
  const fixtures = await db
    .select()
    .from(badmintonFixturesTable)
    .where(
      and(
        eq(badmintonFixturesTable.tournamentId, tournamentId),
        eq(badmintonFixturesTable.categoryId, categoryId),
        inArray(badmintonFixturesTable.drawId, collectionIds),
      ),
    );

  if (fixtures.length === 0) return null;

  return {
    drawId: anchor.id,
    collections: sorted,
    fixtures,
    rounds: sorted.map((c) => ({
      roundNumber: c.roundNumber,
      roundName: c.roundName,
      fixtureCount: fixtures.filter((f) => f.drawId === c.id).length,
    })),
    qualifiers: [],
  };
}

async function advanceRound1Byes(
  tournamentId: number,
  r1Fixtures: Array<{ id: number; slotNumber: number | null }>,
  executor: Parameters<typeof wireKnockoutProgressionLinks>[3],
): Promise<void> {
  for (const f of r1Fixtures) {
    const [row] = await executor
      .select()
      .from(badmintonFixturesTable)
      .where(
        and(
          eq(badmintonFixturesTable.id, f.id),
          eq(badmintonFixturesTable.tournamentId, tournamentId),
        ),
      )
      .limit(1);
    if (!row || row.status !== "walkover") continue;
    const winnerSide =
      row.registrationAId && !row.registrationBId
        ? "left"
        : row.registrationBId && !row.registrationAId
          ? "right"
          : null;
    if (!winnerSide) continue;
    await advanceKnockoutWinner({
      tournamentId,
      fixtureId: row.id,
      winnerSide,
      executor,
    });
    await executor
      .update(badmintonFixturesTable)
      .set({
        completedAt: new Date(),
        resultSummary: "bye",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(badmintonFixturesTable.id, row.id),
          eq(badmintonFixturesTable.tournamentId, tournamentId),
        ),
      );
  }
}

/**
 * Promote a group_knockout category from league stage into knockout.
 * Idempotent hybrid behavior (created / skipped / inconsistent).
 */
export async function promoteCategoryToKnockout(
  tournamentId: number,
  categoryId: number,
  options?: { matchCreationMode?: MatchCreationMode },
): Promise<PromotionResult> {
  const startedAt = Date.now();
  const matchCreationMode = options?.matchCreationMode ?? DEFAULT_MATCH_CREATION_MODE;

  logger.info(
    { tournamentId, categoryId },
    "TOURNAMENT_PROMOTION_STARTED",
  );

  try {
    const cat = await loadCategory(tournamentId, categoryId);

    // ── Hybrid idempotency (Cases 2–4) before mutation ─────────────────────
    if (cat.promotedKnockoutAt) {
      if (cat.promotedKnockoutDrawId == null) {
        logger.error(
          { tournamentId, categoryId, stage: cat.currentStage },
          "TOURNAMENT_PROMOTION_FAILED",
        );
        throw new PromotionError(
          "INCONSISTENT_TOURNAMENT_STATE",
          "Promotion marker exists but knockout fixtures are incomplete.",
          409,
        );
      }

      const existing = await loadDrawBracket(
        tournamentId,
        categoryId,
        cat.promotedKnockoutDrawId,
      );
      if (!existing) {
        logger.error(
          {
            tournamentId,
            categoryId,
            stage: cat.currentStage,
            drawId: cat.promotedKnockoutDrawId,
          },
          "TOURNAMENT_PROMOTION_FAILED",
        );
        throw new PromotionError(
          "INCONSISTENT_TOURNAMENT_STATE",
          "Promotion marker exists but knockout fixtures are incomplete.",
          409,
        );
      }

      const tournamentStage = resolveStageDto({
        drawType: cat.drawType,
        currentStage: cat.currentStage,
        phase: cat.phase,
      });
      const stage =
        tournamentStage.currentStage ?? promotionPersistedStage();

      logger.info(
        {
          tournamentId,
          categoryId,
          stage,
          qualifierCount: 0,
          duration: Date.now() - startedAt,
        },
        "TOURNAMENT_PROMOTION_SKIPPED",
      );

      return {
        created: false,
        skipped: true,
        reason: "Knockout already generated.",
        stage,
        tournamentStage: {
          ...tournamentStage,
          currentStage: stage,
          lifecycleStage: tournamentStage.lifecycleStage ?? "elimination",
          displayLabel: tournamentStage.displayLabel,
        },
        bracket: existing,
      };
    }

    // Case 4 — legacy knockout without promotion marker
    const legacy = await detectLegacyKnockout(tournamentId, categoryId);
    if (legacy) {
      logger.warn(
        {
          tournamentId,
          categoryId,
          drawId: legacy.drawId,
          duration: Date.now() - startedAt,
        },
        "TOURNAMENT_PROMOTION_LEGACY_KNOCKOUT_DETECTED",
      );
      logger.info(
        {
          tournamentId,
          categoryId,
          stage: cat.currentStage,
          duration: Date.now() - startedAt,
        },
        "TOURNAMENT_PROMOTION_SKIPPED",
      );
      {
        const tournamentStage = resolveStageDto({
          drawType: cat.drawType,
          currentStage: cat.currentStage,
          phase: cat.phase,
        });
        const stage =
          tournamentStage.currentStage ?? promotionPersistedStage();
        return {
          created: false,
          skipped: true,
          reason: "Knockout already generated.",
          stage,
          tournamentStage: {
            ...tournamentStage,
            currentStage: stage,
            lifecycleStage: tournamentStage.lifecycleStage ?? "elimination",
            displayLabel: tournamentStage.displayLabel,
          },
          bracket: legacy,
        };
      }
    }

    // ── Validation ─────────────────────────────────────────────────────────
    if (cat.drawType !== "group_knockout") {
      throw new PromotionError(
        "DRAW_TYPE_NOT_PROMOTABLE",
        "Only group_knockout categories can be promoted to knockout.",
        400,
      );
    }

    const stageDto = resolveStageDto({
      drawType: cat.drawType,
      currentStage: cat.currentStage,
      phase: cat.phase,
    });
    if (!isLeague(stageDto)) {
      throw new PromotionError(
        "STAGE_NOT_LEAGUE",
        `Current stage must be league (resolved: ${stageDto.lifecycleStage ?? "null"}).`,
        409,
        {
          currentStage: stageDto.currentStage,
          lifecycle: stageDto.lifecycleStage,
        },
      );
    }

    const remainingFixtures = await countIncompleteLeagueFixtures(
      tournamentId,
      categoryId,
    );
    if (remainingFixtures > 0) {
      throw new PromotionError(
        "LEAGUE_NOT_COMPLETE",
        "League still has unfinished matches.",
        409,
        { remainingFixtures },
      );
    }

    const engine = await getTournamentEngineConfig(tournamentId, categoryId);
    if (!engine) {
      throw new PromotionError("CATEGORY_NOT_FOUND", "Category not found.", 404);
    }

    const { effectiveQualifiersPerGroup, effectiveQualifierMode } =
      engine.qualification;
    if (
      !Number.isInteger(effectiveQualifiersPerGroup) ||
      effectiveQualifiersPerGroup < 1
    ) {
      throw new PromotionError(
        "INVALID_CONFIGURATION",
        "Invalid qualifier configuration.",
        400,
      );
    }

    let qualifiers;
    try {
      qualifiers = await getCategoryPairStandings(tournamentId, categoryId, {
        limit: effectiveQualifiersPerGroup,
        mode: effectiveQualifierMode,
      });
    } catch (err) {
      logger.error({ err, tournamentId, categoryId }, "TOURNAMENT_PROMOTION_FAILED");
      throw new PromotionError(
        "STANDINGS_UNAVAILABLE",
        "Standings unavailable for promotion.",
        409,
      );
    }

    if (!qualifiers || qualifiers.length === 0) {
      throw new PromotionError(
        "STANDINGS_UNAVAILABLE",
        "Standings unavailable for promotion.",
        409,
      );
    }

    const registrationIds = qualifiers.map((q) => q.registrationId);
    const duplicates = findDuplicateQualifierIds(registrationIds);
    if (duplicates.length > 0) {
      throw new PromotionError(
        "DUPLICATE_QUALIFIERS",
        "Duplicate qualifiers detected.",
        409,
        { duplicates },
      );
    }

    if (qualifiers.length < 2) {
      throw new PromotionError(
        "QUALIFIERS_UNRESOLVABLE",
        "Need at least 2 qualifiers to generate a knockout bracket.",
        409,
        { qualifierCount: qualifiers.length },
      );
    }

    logger.info(
      {
        tournamentId,
        categoryId,
        stage: "league",
        qualifierCount: qualifiers.length,
        mode: effectiveQualifierMode,
        limit: effectiveQualifiersPerGroup,
      },
      "TOURNAMENT_PROMOTION_VALIDATED",
    );

    const seeded = qualifiers.map((q, index) => ({
      id: q.registrationId,
      seedNumber: index + 1,
    }));
    const plannedRounds = planKnockoutBracket(seeded);
    const totalRounds = plannedRounds.length;

    const result = await db.transaction(async (tx) => {
      const insertedByRound = new Map<
        number,
        Array<{ id: number; slotNumber: number | null }>
      >();
      let firstCollection: BadmintonDraw | null = null;
      const allFixtures: BadmintonFixture[] = [];
      const collections: BadmintonDraw[] = [];

      for (const round of plannedRounds) {
        const { collection, fixtures: insertedFixtures } =
          await createFixtureCollection({
            tournamentId,
            categoryId,
            roundName: round.roundName,
            drawKind: "generated",
            roundNumber: round.roundNumber,
            totalRounds,
            status: "active",
            metaJson: {
              adapter: "promote_to_knockout",
              algorithm: "knockout",
              legacyDrawKind: "knockout_round",
            },
            fixtures: round.fixtures.map((f) => ({
              slotNumber: f.slotNumber,
              registrationAId: f.registrationAId,
              registrationBId: f.registrationBId,
              status: f.status,
            })),
            markCategoryLive: round.roundNumber === 1,
            executor: tx,
          });
        if (!firstCollection) firstCollection = collection;
        collections.push(collection);
        insertedByRound.set(
          round.roundNumber,
          insertedFixtures.map((f) => ({ id: f.id, slotNumber: f.slotNumber })),
        );
        allFixtures.push(...insertedFixtures);
      }

      if (!firstCollection) {
        throw new PromotionError(
          "PROMOTION_FAILED",
          "Failed to create knockout draw.",
          500,
        );
      }

      await wireKnockoutProgressionLinks(
        tournamentId,
        insertedByRound,
        plannedRounds,
        tx,
      );

      const r1Inserted = insertedByRound.get(1) ?? [];
      await advanceRound1Byes(tournamentId, r1Inserted, tx);

      const initialStage = initialKnockoutStageFromRounds(plannedRounds);
      await setPromotionStage(tx, tournamentId, categoryId, initialStage);
      const settle = await advanceStage(tx, tournamentId, categoryId);
      const persistedStage =
        settle.currentStage ?? initialStage;

      const now = new Date();
      await tx
        .update(badmintonCategoriesTable)
        .set({
          promotedKnockoutAt: now,
          promotedKnockoutDrawId: firstCollection.id,
          updatedAt: now,
        })
        .where(
          and(
            eq(badmintonCategoriesTable.id, categoryId),
            eq(badmintonCategoriesTable.tournamentId, tournamentId),
          ),
        );

      return {
        firstCollection,
        collections,
        allFixtures,
        persistedStage,
      };
    });

    // Operational convenience — never part of success criteria
    const r1Fixtures = result.allFixtures.filter(
      (f) => f.drawId === result.firstCollection.id,
    );
    await maybeCreateRound1Matches({
      tournamentId,
      categoryId,
      fixtures: r1Fixtures,
      mode: matchCreationMode,
    });

    const bracket: PromotionBracket = {
      drawId: result.firstCollection.id,
      collections: result.collections,
      fixtures: result.allFixtures,
      rounds: plannedRounds.map((r) => ({
        roundNumber: r.roundNumber,
        roundName: r.roundName,
        fixtureCount: r.fixtures.length,
      })),
      qualifiers: qualifiers.map((q) => ({
        rank: q.rank,
        registrationId: q.registrationId,
        label: q.label,
        groupId: q.groupId,
      })),
    };

    const tournamentStage = resolveStageDto({
      drawType: cat.drawType,
      currentStage: result.persistedStage,
      phase: cat.phase,
    });

    logger.info(
      {
        tournamentId,
        categoryId,
        stage: result.persistedStage,
        qualifierCount: qualifiers.length,
        duration: Date.now() - startedAt,
        drawId: bracket.drawId,
      },
      "TOURNAMENT_PROMOTION_SUCCESS",
    );

    return {
      created: true,
      skipped: false,
      stage: result.persistedStage,
      tournamentStage,
      bracket,
    };
  } catch (err) {
    if (err instanceof PromotionError) {
      logger.error(
        {
          tournamentId,
          categoryId,
          code: err.code,
          details: err.details,
          duration: Date.now() - startedAt,
        },
        "TOURNAMENT_PROMOTION_FAILED",
      );
      throw err;
    }
    logger.error(
      { err, tournamentId, categoryId, duration: Date.now() - startedAt },
      "TOURNAMENT_PROMOTION_FAILED",
    );
    throw err;
  }
}
