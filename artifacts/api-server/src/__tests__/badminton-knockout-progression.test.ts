import { beforeEach, describe, expect, it, vi } from "vitest";

const selectQueue: unknown[][] = [];

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => selectQueue.shift() ?? [],
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => undefined,
      }),
    }),
  },
  badmintonFixturesTable: {},
}));

import { KnockoutProgressionError, advanceKnockoutWinner } from "../lib/badminton-knockout-progression";

describe("advanceKnockoutWinner conflicts", () => {
  beforeEach(() => {
    selectQueue.length = 0;
  });

  it("throws KnockoutProgressionError when next slot A is already taken", async () => {
    selectQueue.push([
      {
        id: 1,
        registrationAId: 100,
        registrationBId: 101,
        winnerAdvancesTo: 2,
        winnerRegistrationId: null,
        slotNumber: 1,
        metaJson: { advancesAs: "A" },
        status: "live",
      },
    ]);
    selectQueue.push([
      {
        id: 2,
        registrationAId: 999,
        registrationBId: null,
        winnerAdvancesTo: null,
        slotNumber: 1,
        metaJson: null,
        status: "scheduled",
      },
    ]);

    await expect(
      advanceKnockoutWinner({
        tournamentId: 1,
        fixtureId: 1,
        winnerSide: "left",
      }),
    ).rejects.toBeInstanceOf(KnockoutProgressionError);
  });
});
