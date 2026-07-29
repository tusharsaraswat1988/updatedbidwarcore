/**
 * Auto-generate draw writer — Sprint 4 / S4-01.
 * Branches on category.drawType and writes via createFixtureCollection.
 */

import { and, eq } from "drizzle-orm";
import { db, badmintonFixturesTable, type BadmintonDraw, type BadmintonFixture } from "@workspace/db";
import { createFixtureCollection } from "./fixture-collection-writer";
import {
  planKnockoutBracket,
  wireKnockoutProgressionLinks,
  advanceKnockoutWinner,
  type PlannedKnockoutRound,
} from "./badminton-knockout-progression";
import { planRoundRobin } from "./badminton-round-robin-plan";
import { planGroupKnockout } from "./badminton-group-knockout-plan";

export type GenerateDrawRegistration = {
  id: number;
  seedNumber: number | null;
};

export type GenerateDrawOptions = {
  groupCount?: number;
  groupSize?: number;
  qualifyPerGroup?: number;
};

export type GenerateDrawResult = {
  draw: BadmintonDraw | null;
  collection: BadmintonDraw | null;
  fixtures: BadmintonFixture[];
  rounds: Array<{ roundNumber: number; roundName: string; fixtureCount: number; groupId?: string | null }>;
  algorithm: string;
};

async function writeKnockoutCollections(input: {
  tournamentId: number;
  categoryId: number;
  plannedRounds: PlannedKnockoutRound[];
  algorithm: string;
  fixtureMeta?: (round: PlannedKnockoutRound, fixtureIndex: number) => Record<string, unknown> | null;
  markLiveOnFirst?: boolean;
}): Promise<{
  firstCollection: BadmintonDraw | null;
  allFixtures: BadmintonFixture[];
  insertedByRound: Map<number, Array<{ id: number; slotNumber: number | null }>>;
}> {
  const totalRounds = input.plannedRounds.length;
  const insertedByRound = new Map<number, Array<{ id: number; slotNumber: number | null }>>();
  let firstCollection: BadmintonDraw | null = null;
  const allFixtures: BadmintonFixture[] = [];

  for (const round of input.plannedRounds) {
    const { collection, fixtures: insertedFixtures } = await createFixtureCollection({
      tournamentId: input.tournamentId,
      categoryId: input.categoryId,
      roundName: round.roundName,
      drawKind: "generated",
      roundNumber: round.roundNumber,
      totalRounds,
      status: "active",
      metaJson: {
        adapter: "auto_generate",
        algorithm: input.algorithm,
        legacyDrawKind: "knockout_round",
        stage: input.algorithm === "group_knockout" ? "knockout" : undefined,
      },
      fixtures: round.fixtures.map((f, idx) => ({
        slotNumber: f.slotNumber,
        registrationAId: f.registrationAId,
        registrationBId: f.registrationBId,
        status: f.status,
        metaJson: input.fixtureMeta?.(round, idx) ?? null,
      })),
      markCategoryLive: input.markLiveOnFirst !== false && round.roundNumber === 1,
    });
    if (!firstCollection) firstCollection = collection;
    insertedByRound.set(
      round.roundNumber,
      insertedFixtures.map((f) => ({ id: f.id, slotNumber: f.slotNumber })),
    );
    allFixtures.push(...insertedFixtures);
  }

  await wireKnockoutProgressionLinks(
    input.tournamentId,
    insertedByRound,
    input.plannedRounds,
  );

  return { firstCollection, allFixtures, insertedByRound };
}

async function autoAdvanceKnockoutByes(
  tournamentId: number,
  insertedByRound: Map<number, Array<{ id: number; slotNumber: number | null }>>,
): Promise<void> {
  const r1Inserted = insertedByRound.get(1) ?? [];
  for (const f of r1Inserted) {
    const [row] = await db
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
    });
    await db
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

async function generateKnockoutDraw(
  tournamentId: number,
  categoryId: number,
  registrations: GenerateDrawRegistration[],
): Promise<GenerateDrawResult> {
  const plannedRounds = planKnockoutBracket(registrations);
  const { firstCollection, allFixtures, insertedByRound } = await writeKnockoutCollections({
    tournamentId,
    categoryId,
    plannedRounds,
    algorithm: "knockout",
  });
  await autoAdvanceKnockoutByes(tournamentId, insertedByRound);

  return {
    draw: firstCollection,
    collection: firstCollection,
    fixtures: allFixtures,
    rounds: plannedRounds.map((r) => ({
      roundNumber: r.roundNumber,
      roundName: r.roundName,
      fixtureCount: r.fixtures.length,
    })),
    algorithm: "knockout",
  };
}

async function generateRoundRobinDraw(
  tournamentId: number,
  categoryId: number,
  registrations: GenerateDrawRegistration[],
): Promise<GenerateDrawResult> {
  const ids = registrations.map((r) => r.id);
  const plan = planRoundRobin(ids);

  const { collection, fixtures } = await createFixtureCollection({
    tournamentId,
    categoryId,
    roundName: "Round Robin",
    drawKind: "generated",
    roundNumber: 1,
    totalRounds: plan.totalRounds,
    status: "active",
    groupId: null,
    metaJson: {
      adapter: "auto_generate",
      algorithm: "round_robin",
      totalRounds: plan.totalRounds,
      byeByRound: plan.byeByRound,
    },
    fixtures: plan.fixtures.map((f) => ({
      slotNumber: f.slotNumber,
      registrationAId: f.registrationAId,
      registrationBId: f.registrationBId,
      status: f.status,
      metaJson: {
        roundIndex: f.roundIndex,
        roundName: f.roundName,
      },
    })),
    markCategoryLive: true,
  });

  return {
    draw: collection,
    collection,
    fixtures,
    rounds: [
      {
        roundNumber: 1,
        roundName: "Round Robin",
        fixtureCount: fixtures.length,
      },
    ],
    algorithm: "round_robin",
  };
}

async function generateGroupKnockoutDraw(
  tournamentId: number,
  categoryId: number,
  registrations: GenerateDrawRegistration[],
  options?: GenerateDrawOptions,
): Promise<GenerateDrawResult> {
  // Preserve seed order when present, then unseeded.
  const seeds = registrations
    .filter((r) => r.seedNumber != null)
    .sort((a, b) => (a.seedNumber ?? 99) - (b.seedNumber ?? 99));
  const unseeded = registrations.filter((r) => r.seedNumber == null);
  const orderedIds = [...seeds, ...unseeded].map((r) => r.id);

  const plan = planGroupKnockout(orderedIds, {
    groupCount: options?.groupCount,
    groupSize: options?.groupSize,
    qualifyPerGroup: options?.qualifyPerGroup,
  });

  let firstCollection: BadmintonDraw | null = null;
  const allFixtures: BadmintonFixture[] = [];
  const rounds: GenerateDrawResult["rounds"] = [];

  for (const group of plan.groups) {
    if (group.plan.fixtures.length === 0) continue;
    const { collection, fixtures } = await createFixtureCollection({
      tournamentId,
      categoryId,
      roundName: group.label,
      drawKind: "generated",
      roundNumber: 1,
      totalRounds: group.plan.totalRounds,
      status: "active",
      groupId: group.groupId,
      metaJson: {
        adapter: "auto_generate",
        algorithm: "group_knockout",
        stage: "group",
        groupId: group.groupId,
        groupLabel: group.label,
        registrationIds: group.registrationIds,
        byeByRound: group.plan.byeByRound,
      },
      fixtures: group.plan.fixtures.map((f) => ({
        slotNumber: f.slotNumber,
        registrationAId: f.registrationAId,
        registrationBId: f.registrationBId,
        status: f.status,
        metaJson: {
          roundIndex: f.roundIndex,
          roundName: f.roundName,
          groupId: group.groupId,
        },
      })),
      markCategoryLive: firstCollection == null,
    });
    if (!firstCollection) firstCollection = collection;
    allFixtures.push(...fixtures);
    rounds.push({
      roundNumber: 1,
      roundName: group.label,
      fixtureCount: fixtures.length,
      groupId: group.groupId,
    });
  }

  if (plan.knockout.length > 0) {
    const { firstCollection: koFirst, allFixtures: koFixtures, insertedByRound } =
      await writeKnockoutCollections({
        tournamentId,
        categoryId,
        plannedRounds: plan.knockout,
        algorithm: "group_knockout",
        markLiveOnFirst: firstCollection == null,
        fixtureMeta: (round, fixtureIndex) => {
          if (round.roundNumber !== 1) return null;
          const f = plan.knockout[0]?.fixtures[fixtureIndex];
          if (!f?.qualifierMeta) return null;
          return { qualifierMeta: f.qualifierMeta, stage: "knockout" };
        },
      });
    if (!firstCollection) firstCollection = koFirst;
    allFixtures.push(...koFixtures);
    for (const r of plan.knockout) {
      rounds.push({
        roundNumber: r.roundNumber,
        roundName: r.roundName,
        fixtureCount: r.fixtures.length,
      });
    }
    // Only auto-advance byes that already have one side filled (unlikely for TBD KO).
    await autoAdvanceKnockoutByes(tournamentId, insertedByRound);
  }

  return {
    draw: firstCollection,
    collection: firstCollection,
    fixtures: allFixtures,
    rounds,
    algorithm: "group_knockout",
  };
}

export async function generateCategoryDraw(input: {
  tournamentId: number;
  categoryId: number;
  drawType: string;
  registrations: GenerateDrawRegistration[];
  options?: GenerateDrawOptions;
}): Promise<GenerateDrawResult> {
  const drawType = input.drawType || "knockout";

  if (drawType === "round_robin") {
    return generateRoundRobinDraw(
      input.tournamentId,
      input.categoryId,
      input.registrations,
    );
  }

  if (drawType === "group_knockout") {
    return generateGroupKnockoutDraw(
      input.tournamentId,
      input.categoryId,
      input.registrations,
      input.options,
    );
  }

  // Default / knockout
  return generateKnockoutDraw(
    input.tournamentId,
    input.categoryId,
    input.registrations,
  );
}
