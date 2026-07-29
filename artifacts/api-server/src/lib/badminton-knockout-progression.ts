/**
 * Knockout winner advancement + link wiring (Sprint 1 / C5).
 */

import { and, eq } from "drizzle-orm";
import { db, badmintonFixturesTable } from "@workspace/db";
import type { BadmintonSide } from "@workspace/badminton-core";
import type { PlannedKnockoutRound } from "./badminton-knockout-plan";

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

      await db
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
}): Promise<{ advancedToFixtureId: number | null }> {
  const [fixture] = await db
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

  await db
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

  const [next] = await db
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

  if (advancesAs === "A") {
    if (next.registrationAId == null || next.registrationAId === winnerRegistrationId) {
      patch.registrationAId = winnerRegistrationId;
    }
  } else if (next.registrationBId == null || next.registrationBId === winnerRegistrationId) {
    patch.registrationBId = winnerRegistrationId;
  }

  const nextA = (patch.registrationAId as number | null | undefined) ?? next.registrationAId;
  const nextB = (patch.registrationBId as number | null | undefined) ?? next.registrationBId;
  if (nextA && nextB && (next.status === "walkover" || next.status === "unscheduled")) {
    patch.status = "unscheduled";
  }

  await db
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
