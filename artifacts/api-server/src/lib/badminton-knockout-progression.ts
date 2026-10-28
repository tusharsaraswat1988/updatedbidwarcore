/**
 * Knockout winner advancement + link wiring (Sprint 1 / C5).
 */

import { and, eq } from "drizzle-orm";
import { db, badmintonFixturesTable } from "@workspace/db";
import type { BadmintonSide } from "@workspace/badminton-core";
import type { PlannedKnockoutRound } from "./badminton-knockout-plan";

export type DbExecutor = Pick<typeof db, "select" | "insert" | "delete" | "update">;

export class KnockoutProgressionError extends Error {
  readonly code = "KNOCKOUT_PROGRESSION_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "KnockoutProgressionError";
  }
}

export {
  planKnockoutBracket,
  knockoutRoundName,
  type PlannedKnockoutFixture,
  type PlannedKnockoutRound,
} from "./badminton-knockout-plan";

/**
 * After fixtures are inserted per round, wire winnerAdvancesTo by slot map.
 */
export async function wireKnockoutProgressionLinks(
  tournamentId: number,
  insertedByRound: Map<number, Array<{ id: number; slotNumber: number | null }>>,
  planned: PlannedKnockoutRound[],
  executor: DbExecutor = db,
): Promise<void> {
  for (const round of planned) {
    const inserted = insertedByRound.get(round.roundNumber) ?? [];
    const bySlot = new Map(
      inserted
        .filter((f) => f.slotNumber != null)
        .map((f) => [f.slotNumber as number, f.id]),
    );

    for (const plannedFix of round.fixtures) {
      if (!plannedFix.advancesToRoundSlot) continue;
      const fromId = bySlot.get(plannedFix.slotNumber);
      if (!fromId) continue;

      const nextRound = insertedByRound.get(plannedFix.advancesToRoundSlot.roundNumber) ?? [];
      const to = nextRound.find(
        (f) => f.slotNumber === plannedFix.advancesToRoundSlot!.slotNumber,
      );
      if (!to) continue;

      await executor
        .update(badmintonFixturesTable)
        .set({
          winnerAdvancesTo: to.id,
          metaJson: {
            advancesAs: plannedFix.advancesToRoundSlot.as,
          },
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(badmintonFixturesTable.id, fromId),
            eq(badmintonFixturesTable.tournamentId, tournamentId),
          ),
        );
    }
  }
}

/**
 * On match/fixture completion: set winnerRegistrationId and fill next-round slot.
 */
export async function advanceKnockoutWinner(input: {
  tournamentId: number;
  fixtureId: number;
  winnerSide: BadmintonSide;
  executor?: DbExecutor;
}): Promise<{ advancedToFixtureId: number | null }> {
  const executor = input.executor ?? db;

  const [fixture] = await executor
    .select()
    .from(badmintonFixturesTable)
    .where(
      and(
        eq(badmintonFixturesTable.id, input.fixtureId),
        eq(badmintonFixturesTable.tournamentId, input.tournamentId),
      ),
    )
    .limit(1);

  if (!fixture) return { advancedToFixtureId: null };

  const winnerRegistrationId =
    input.winnerSide === "left" ? fixture.registrationAId : fixture.registrationBId;

  await executor
    .update(badmintonFixturesTable)
    .set({
      winnerRegistrationId: winnerRegistrationId ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(badmintonFixturesTable.id, input.fixtureId),
        eq(badmintonFixturesTable.tournamentId, input.tournamentId),
      ),
    );

  if (!winnerRegistrationId || !fixture.winnerAdvancesTo) {
    return { advancedToFixtureId: null };
  }

  const [next] = await executor
    .select()
    .from(badmintonFixturesTable)
    .where(
      and(
        eq(badmintonFixturesTable.id, fixture.winnerAdvancesTo),
        eq(badmintonFixturesTable.tournamentId, input.tournamentId),
      ),
    )
    .limit(1);

  if (!next) return { advancedToFixtureId: null };

  const advancesAs =
    (fixture.metaJson as { advancesAs?: "A" | "B" } | null)?.advancesAs ??
    (fixture.slotNumber != null && fixture.slotNumber % 2 === 1 ? "A" : "B");

  const patch: Partial<typeof badmintonFixturesTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  const downstreamStarted =
    next.status === "live" ||
    next.status === "completed" ||
    next.scoringMatchId != null;

  if (advancesAs === "A") {
    if (
      next.registrationAId != null &&
      next.registrationAId !== winnerRegistrationId
    ) {
      const isScoreRevision =
        fixture.winnerRegistrationId != null &&
        next.registrationAId === fixture.winnerRegistrationId;

      if (downstreamStarted) {
        throw new KnockoutProgressionError(
          `Cannot advance winner registration #${winnerRegistrationId}: downstream fixture #${next.id} has already started or completed.`,
        );
      }

      if (!isScoreRevision) {
        throw new KnockoutProgressionError(
          `Next-round slot A (fixture #${next.id}) is already assigned to registration #${next.registrationAId}. ` +
            `Cannot advance winner registration #${winnerRegistrationId}. Check bracket links in Fixtures.`,
        );
      }
      // P0-06: Downstream fixture is unplayed; safely replace previous winner with revised winner
    }
    patch.registrationAId = winnerRegistrationId;
  } else {
    if (
      next.registrationBId != null &&
      next.registrationBId !== winnerRegistrationId
    ) {
      const isScoreRevision =
        fixture.winnerRegistrationId != null &&
        next.registrationBId === fixture.winnerRegistrationId;

      if (downstreamStarted) {
        throw new KnockoutProgressionError(
          `Cannot advance winner registration #${winnerRegistrationId}: downstream fixture #${next.id} has already started or completed.`,
        );
      }

      if (!isScoreRevision) {
        throw new KnockoutProgressionError(
          `Next-round slot B (fixture #${next.id}) is already assigned to registration #${next.registrationBId}. ` +
            `Cannot advance winner registration #${winnerRegistrationId}. Check bracket links in Fixtures.`,
        );
      }
      // P0-06: Downstream fixture is unplayed; safely replace previous winner with revised winner
    }
    patch.registrationBId = winnerRegistrationId;
  }

  const nextA = (patch.registrationAId as number | null | undefined) ?? next.registrationAId;
  const nextB = (patch.registrationBId as number | null | undefined) ?? next.registrationBId;
  if (nextA && nextB && (next.status === "walkover" || next.status === "unscheduled")) {
    patch.status = "unscheduled";
  }

  await executor
    .update(badmintonFixturesTable)
    .set(patch)
    .where(
      and(
        eq(badmintonFixturesTable.id, next.id),
        eq(badmintonFixturesTable.tournamentId, input.tournamentId),
      ),
    );

  return { advancedToFixtureId: next.id };
}

/**
 * P0-07: When a match is reopened, reconcile downstream progression.
 * Resets downstream slot back to null if unplayed; fails safely if downstream match has started.
 */
export async function resetKnockoutDownstreamSlot(input: {
  tournamentId: number;
  fixtureId: number;
  executor?: DbExecutor;
}): Promise<{ resetFixtureId: number | null }> {
  const executor = input.executor ?? db;

  const [fixture] = await executor
    .select()
    .from(badmintonFixturesTable)
    .where(
      and(
        eq(badmintonFixturesTable.id, input.fixtureId),
        eq(badmintonFixturesTable.tournamentId, input.tournamentId),
      ),
    )
    .limit(1);

  if (!fixture || !fixture.winnerAdvancesTo) {
    return { resetFixtureId: null };
  }

  const [next] = await executor
    .select()
    .from(badmintonFixturesTable)
    .where(
      and(
        eq(badmintonFixturesTable.id, fixture.winnerAdvancesTo),
        eq(badmintonFixturesTable.tournamentId, input.tournamentId),
      ),
    )
    .limit(1);

  if (!next) return { resetFixtureId: null };

  const downstreamStarted =
    next.status === "live" ||
    next.status === "completed" ||
    next.scoringMatchId != null;

  if (downstreamStarted) {
    throw new KnockoutProgressionError(
      `Cannot reopen match: downstream fixture #${next.id} has already started or completed.`,
    );
  }

  const advancesAs =
    (fixture.metaJson as { advancesAs?: "A" | "B" } | null)?.advancesAs ??
    (fixture.slotNumber != null && fixture.slotNumber % 2 === 1 ? "A" : "B");

  const patch: Partial<typeof badmintonFixturesTable.$inferInsert> = {
    updatedAt: new Date(),
    status: "unscheduled",
  };

  if (advancesAs === "A") {
    patch.registrationAId = null;
  } else {
    patch.registrationBId = null;
  }

  await executor
    .update(badmintonFixturesTable)
    .set(patch)
    .where(
      and(
        eq(badmintonFixturesTable.id, next.id),
        eq(badmintonFixturesTable.tournamentId, input.tournamentId),
      ),
    );

  return { resetFixtureId: next.id };
}
