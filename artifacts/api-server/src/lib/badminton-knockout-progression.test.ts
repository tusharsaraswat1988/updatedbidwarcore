import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSelect, mockUpdate } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
  badmintonFixturesTable: {
    id: "id",
    tournamentId: "tournament_id",
    registrationAId: "registration_a_id",
    registrationBId: "registration_b_id",
    winnerRegistrationId: "winner_registration_id",
    winnerAdvancesTo: "winner_advances_to",
    metaJson: "meta_json",
    status: "status",
    scoringMatchId: "scoring_match_id",
  },
}));

import {
  advanceKnockoutWinner,
  resetKnockoutDownstreamSlot,
  KnockoutProgressionError,
} from "./badminton-knockout-progression";

describe("badminton-knockout-progression — Revision and Reopening (P0-06, P0-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function queueSelectRows(...results: unknown[][]) {
    const queue = [...results];
    mockSelect.mockImplementation(() => {
      const rows = queue.shift() ?? [];
      return {
        from: () => ({
          where: () => ({
            limit: async () => rows,
            then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
          }),
        }),
      };
    });
    mockUpdate.mockImplementation(() => ({
      set: () => ({
        where: async () => ({}),
      }),
    }));
  }

  it("advances winner to next-round slot A when empty", async () => {
    const currentFixture = {
      id: 10,
      tournamentId: 1,
      registrationAId: 101,
      registrationBId: 102,
      winnerAdvancesTo: 20,
      metaJson: { advancesAs: "A" },
    };
    const nextFixture = {
      id: 20,
      tournamentId: 1,
      registrationAId: null,
      registrationBId: null,
      status: "unscheduled",
      scoringMatchId: null,
    };

    queueSelectRows([currentFixture], [nextFixture]);

    const result = await advanceKnockoutWinner({
      tournamentId: 1,
      fixtureId: 10,
      winnerSide: "left",
    });

    expect(result.advancedToFixtureId).toBe(20);
    expect(mockUpdate).toHaveBeenCalledTimes(2); // 1 for winnerRegistrationId, 1 for next slot
  });

  it("safely replaces unplayed downstream slot on score revision (P0-06)", async () => {
    // Current fixture was revised: previously left (101) won, but now revised to right (102)
    const currentFixture = {
      id: 10,
      tournamentId: 1,
      registrationAId: 101,
      registrationBId: 102,
      winnerRegistrationId: 101, // Previously 101 won
      winnerAdvancesTo: 20,
      metaJson: { advancesAs: "A" },
    };
    // Downstream fixture is still unplayed, but currently holds the old winner (101)
    const nextFixture = {
      id: 20,
      tournamentId: 1,
      registrationAId: 101,
      registrationBId: null,
      status: "unscheduled",
      scoringMatchId: null,
    };

    queueSelectRows([currentFixture], [nextFixture]);

    const result = await advanceKnockoutWinner({
      tournamentId: 1,
      fixtureId: 10,
      winnerSide: "right", // Revised to 102
    });

    expect(result.advancedToFixtureId).toBe(20);
  });

  it("throws KnockoutProgressionError when revising winner if downstream match has already started (P0-06)", async () => {
    const currentFixture = {
      id: 10,
      tournamentId: 1,
      registrationAId: 101,
      registrationBId: 102,
      winnerAdvancesTo: 20,
      metaJson: { advancesAs: "A" },
    };
    // Downstream fixture is already LIVE with scoring match
    const nextFixture = {
      id: 20,
      tournamentId: 1,
      registrationAId: 101,
      registrationBId: 201,
      status: "live",
      scoringMatchId: 501,
    };

    queueSelectRows([currentFixture], [nextFixture]);

    await expect(
      advanceKnockoutWinner({
        tournamentId: 1,
        fixtureId: 10,
        winnerSide: "right",
      }),
    ).rejects.toThrow(KnockoutProgressionError);
  });

  it("resets unplayed downstream slot when a match is reopened (P0-07)", async () => {
    const currentFixture = {
      id: 10,
      tournamentId: 1,
      winnerRegistrationId: 101,
      winnerAdvancesTo: 20,
      metaJson: { advancesAs: "A" },
    };
    // Downstream fixture has not started yet
    const nextFixture = {
      id: 20,
      tournamentId: 1,
      registrationAId: 101,
      registrationBId: 201,
      status: "unscheduled",
      scoringMatchId: null,
    };

    queueSelectRows([currentFixture], [nextFixture]);

    const result = await resetKnockoutDownstreamSlot({
      tournamentId: 1,
      fixtureId: 10,
    });

    expect(result.resetFixtureId).toBe(20);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("fails safely when reopening a match whose downstream fixture has already started (P0-07)", async () => {
    const currentFixture = {
      id: 10,
      tournamentId: 1,
      winnerRegistrationId: 101,
      winnerAdvancesTo: 20,
      metaJson: { advancesAs: "A" },
    };
    // Downstream fixture has started!
    const nextFixture = {
      id: 20,
      tournamentId: 1,
      registrationAId: 101,
      registrationBId: 201,
      status: "live",
      scoringMatchId: 777,
    };

    queueSelectRows([currentFixture], [nextFixture]);

    await expect(
      resetKnockoutDownstreamSlot({
        tournamentId: 1,
        fixtureId: 10,
      }),
    ).rejects.toThrow(KnockoutProgressionError);
  });
});
