import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockTransaction,
  mockSelect,
  mockInsert,
  mockUpdate,
  getCategoryPairStandings,
  getTournamentEngineConfig,
  planKnockoutBracket,
  createFixtureCollection,
  wireKnockoutProgressionLinks,
  advanceKnockoutWinner,
  loggerInfo,
  loggerWarn,
  loggerError,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  getCategoryPairStandings: vi.fn(),
  getTournamentEngineConfig: vi.fn(),
  planKnockoutBracket: vi.fn(),
  createFixtureCollection: vi.fn(),
  wireKnockoutProgressionLinks: vi.fn(),
  advanceKnockoutWinner: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
  tournamentsTable: { id: "id" },
  badmintonCategoriesTable: {
    id: "id",
    tournamentId: "tournament_id",
    promotedKnockoutAt: "promoted_knockout_at",
    promotedKnockoutDrawId: "promoted_knockout_draw_id",
    currentStage: "current_stage",
  },
  badmintonDrawsTable: {
    id: "id",
    tournamentId: "tournament_id",
    categoryId: "category_id",
    groupId: "group_id",
    roundNumber: "round_number",
    totalRounds: "total_rounds",
    roundName: "round_name",
    metaJson: "meta_json",
  },
  badmintonFixturesTable: {
    id: "id",
    tournamentId: "tournament_id",
    categoryId: "category_id",
    drawId: "draw_id",
    status: "status",
    slotNumber: "slot_number",
  },
}));

vi.mock("./badminton-league-service", () => ({
  getCategoryPairStandings: (...args: unknown[]) => getCategoryPairStandings(...args),
}));

vi.mock("./badminton-tournament-engine", () => ({
  getTournamentEngineConfig: (...args: unknown[]) => getTournamentEngineConfig(...args),
}));

vi.mock("./badminton-knockout-plan", () => ({
  planKnockoutBracket: (...args: unknown[]) => planKnockoutBracket(...args),
}));

vi.mock("./fixture-collection-writer", () => ({
  createFixtureCollection: (...args: unknown[]) => createFixtureCollection(...args),
}));

vi.mock("./badminton-knockout-progression", () => ({
  wireKnockoutProgressionLinks: (...args: unknown[]) =>
    wireKnockoutProgressionLinks(...args),
  advanceKnockoutWinner: (...args: unknown[]) => advanceKnockoutWinner(...args),
}));

vi.mock("./logger", () => ({
  logger: {
    info: (...args: unknown[]) => loggerInfo(...args),
    warn: (...args: unknown[]) => loggerWarn(...args),
    error: (...args: unknown[]) => loggerError(...args),
  },
}));

import {
  PromotionError,
  findDuplicateQualifierIds,
  promoteCategoryToKnockout,
} from "./badminton-promotion-engine";

type SelectResult = unknown[];

function queueSelects(...results: SelectResult[]) {
  const queue = [...results];
  mockSelect.mockImplementation(() => {
    const rows = queue.shift() ?? [];
    const whereResult = {
      limit: async () => rows,
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    };
    return {
      from: () => ({
        where: () => whereResult,
      }),
    };
  });
}

const baseCategory = {
  id: 10,
  tournamentId: 1,
  drawType: "group_knockout",
  phase: "live",
  currentStage: "league",
  promotedKnockoutAt: null,
  promotedKnockoutDrawId: null,
  rankingRulesJson: null,
  qualifiersPerGroup: 2,
  qualifierMode: "per_group",
};

describe("findDuplicateQualifierIds", () => {
  it("detects duplicates", () => {
    expect(findDuplicateQualifierIds([1, 2, 1, 3])).toEqual([1]);
  });

  it("returns empty when unique", () => {
    expect(findDuplicateQualifierIds([1, 2, 3])).toEqual([]);
  });
});

describe("promoteCategoryToKnockout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
      };
      return fn(tx);
    });
    mockUpdate.mockReturnValue({
      set: () => ({
        where: async () => undefined,
      }),
    });
    wireKnockoutProgressionLinks.mockResolvedValue(undefined);
    advanceKnockoutWinner.mockResolvedValue({ advancedToFixtureId: null });
  });

  it("fails when league has unfinished fixtures", async () => {
    queueSelects(
      [{ id: 1 }], // tournament
      [baseCategory], // category
      [], // legacy knockout draws
      [{ id: 100 }], // league draws
      [
        { id: 1, status: "completed" },
        { id: 2, status: "scheduled" },
      ],
    );

    await expect(promoteCategoryToKnockout(1, 10)).rejects.toMatchObject({
      code: "LEAGUE_NOT_COMPLETE",
      details: { remainingFixtures: 1 },
    });
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "LEAGUE_NOT_COMPLETE" }),
      "TOURNAMENT_PROMOTION_FAILED",
    );
  });

  it("returns skipped when already promoted with intact bracket (idempotent)", async () => {
    const promotedAt = new Date("2026-08-03T10:00:00Z");
    queueSelects(
      [{ id: 1 }],
      [
        {
          ...baseCategory,
          currentStage: "quarter_final",
          promotedKnockoutAt: promotedAt,
          promotedKnockoutDrawId: 50,
        },
      ],
      // loadDrawBracket: anchor
      [
        {
          id: 50,
          tournamentId: 1,
          categoryId: 10,
          roundName: "Semi-Finals",
          roundNumber: 1,
          totalRounds: 2,
          groupId: null,
          metaJson: { adapter: "promote_to_knockout", algorithm: "knockout" },
        },
      ],
      // collections
      [
        {
          id: 50,
          tournamentId: 1,
          categoryId: 10,
          roundName: "Semi-Finals",
          roundNumber: 1,
          totalRounds: 2,
          groupId: null,
          metaJson: { adapter: "promote_to_knockout", algorithm: "knockout" },
        },
        {
          id: 51,
          tournamentId: 1,
          categoryId: 10,
          roundName: "Final",
          roundNumber: 2,
          totalRounds: 2,
          groupId: null,
          metaJson: { adapter: "promote_to_knockout", algorithm: "knockout" },
        },
      ],
      // fixtures
      [
        { id: 1, drawId: 50, status: "unscheduled" },
        { id: 2, drawId: 50, status: "unscheduled" },
        { id: 3, drawId: 51, status: "unscheduled" },
      ],
    );

    const result = await promoteCategoryToKnockout(1, 10);
    expect(result.created).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("Knockout already generated.");
    expect(result.bracket.drawId).toBe(50);
    expect(createFixtureCollection).not.toHaveBeenCalled();
    expect(loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 10 }),
      "TOURNAMENT_PROMOTION_SKIPPED",
    );
  });

  it("returns 409 inconsistent when marker set but fixtures missing", async () => {
    queueSelects(
      [{ id: 1 }],
      [
        {
          ...baseCategory,
          promotedKnockoutAt: new Date(),
          promotedKnockoutDrawId: 99,
        },
      ],
      [], // anchor missing
    );

    await expect(promoteCategoryToKnockout(1, 10)).rejects.toMatchObject({
      code: "INCONSISTENT_TOURNAMENT_STATE",
      status: 409,
    });
  });

  it("returns existing legacy knockout without regenerating", async () => {
    queueSelects(
      [{ id: 1 }],
      [baseCategory],
      // detectLegacyKnockout draws
      [
        {
          id: 70,
          tournamentId: 1,
          categoryId: 10,
          roundName: "Quarter-Finals",
          roundNumber: 1,
          totalRounds: 3,
          groupId: null,
          metaJson: { algorithm: "knockout", adapter: "auto_generate" },
        },
      ],
      // fixtures for legacy
      [{ id: 1, drawId: 70, status: "unscheduled" }],
    );

    const result = await promoteCategoryToKnockout(1, 10);
    expect(result.skipped).toBe(true);
    expect(result.bracket.drawId).toBe(70);
    expect(createFixtureCollection).not.toHaveBeenCalled();
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ drawId: 70 }),
      "TOURNAMENT_PROMOTION_LEGACY_KNOCKOUT_DETECTED",
    );
  });

  it("fails on duplicate qualifiers", async () => {
    queueSelects(
      [{ id: 1 }],
      [baseCategory],
      [], // legacy
      [{ id: 100 }], // league draws
      [{ id: 1, status: "completed" }], // all terminal
    );

    getTournamentEngineConfig.mockResolvedValue({
      qualification: {
        effectiveQualifiersPerGroup: 2,
        effectiveQualifierMode: "per_group",
      },
    });
    getCategoryPairStandings.mockResolvedValue([
      { rank: 1, registrationId: 5, label: "A", groupId: 1 },
      { rank: 1, registrationId: 5, label: "A", groupId: 2 },
    ]);

    await expect(promoteCategoryToKnockout(1, 10)).rejects.toMatchObject({
      code: "DUPLICATE_QUALIFIERS",
    });
  });

  it("fails on invalid qualifier configuration", async () => {
    queueSelects(
      [{ id: 1 }],
      [baseCategory],
      [],
      [{ id: 100 }],
      [{ id: 1, status: "walkover" }],
    );

    getTournamentEngineConfig.mockResolvedValue({
      qualification: {
        effectiveQualifiersPerGroup: 0,
        effectiveQualifierMode: "category",
      },
    });

    await expect(promoteCategoryToKnockout(1, 10)).rejects.toMatchObject({
      code: "INVALID_CONFIGURATION",
    });
  });

  it("rolls back when fixture creation fails inside transaction", async () => {
    const selectQueue: SelectResult[] = [
      [{ id: 1 }],
      [baseCategory],
      [],
      [{ id: 100 }],
      [{ id: 1, status: "completed" }],
    ];
    mockSelect.mockImplementation(() => {
      const rows = selectQueue.shift() ?? [];
      const whereResult = {
        limit: async () => rows,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(rows).then(resolve, reject),
      };
      return { from: () => ({ where: () => whereResult }) };
    });

    getTournamentEngineConfig.mockResolvedValue({
      qualification: {
        effectiveQualifiersPerGroup: 2,
        effectiveQualifierMode: "category",
      },
    });
    getCategoryPairStandings.mockResolvedValue([
      { rank: 1, registrationId: 11, label: "A", groupId: null },
      { rank: 2, registrationId: 12, label: "B", groupId: null },
    ]);
    planKnockoutBracket.mockReturnValue([
      {
        roundNumber: 1,
        roundName: "Final",
        fixtures: [
          {
            slotNumber: 1,
            registrationAId: 11,
            registrationBId: 12,
            status: "unscheduled",
            advancesToRoundSlot: null,
          },
        ],
      },
    ]);
    createFixtureCollection.mockRejectedValue(new Error("insert failed"));

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      try {
        await fn({ select: mockSelect, insert: mockInsert, update: mockUpdate });
      } catch (e) {
        // simulate rollback — nothing committed
        throw e;
      }
    });

    await expect(promoteCategoryToKnockout(1, 10)).rejects.toThrow("insert failed");
    expect(mockTransaction).toHaveBeenCalled();
  });

  it("successful promotion creates bracket and sets stage", async () => {
    const selectQueue: SelectResult[] = [
      [{ id: 1 }],
      [baseCategory],
      [], // legacy
      [{ id: 100 }],
      [{ id: 1, status: "completed" }, { id: 2, status: "completed" }],
    ];
    mockSelect.mockImplementation(() => {
      const rows = selectQueue.shift() ?? [];
      const whereResult = {
        limit: async () => rows,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(rows).then(resolve, reject),
      };
      return { from: () => ({ where: () => whereResult }) };
    });

    getTournamentEngineConfig.mockResolvedValue({
      qualification: {
        effectiveQualifiersPerGroup: 4,
        effectiveQualifierMode: "category",
      },
    });
    const qualifiers = [
      { rank: 1, registrationId: 11, label: "A", groupId: null },
      { rank: 2, registrationId: 12, label: "B", groupId: null },
      { rank: 3, registrationId: 13, label: "C", groupId: null },
      { rank: 4, registrationId: 14, label: "D", groupId: null },
    ];
    getCategoryPairStandings.mockResolvedValue(qualifiers);

    planKnockoutBracket.mockReturnValue([
      {
        roundNumber: 1,
        roundName: "Semi-Finals",
        fixtures: [
          {
            slotNumber: 1,
            registrationAId: 11,
            registrationBId: 14,
            status: "unscheduled",
            advancesToRoundSlot: { roundNumber: 2, slotNumber: 1, as: "A" },
          },
          {
            slotNumber: 2,
            registrationAId: 12,
            registrationBId: 13,
            status: "unscheduled",
            advancesToRoundSlot: { roundNumber: 2, slotNumber: 1, as: "B" },
          },
        ],
      },
      {
        roundNumber: 2,
        roundName: "Final",
        fixtures: [
          {
            slotNumber: 1,
            registrationAId: null,
            registrationBId: null,
            status: "unscheduled",
            advancesToRoundSlot: null,
          },
        ],
      },
    ]);

    createFixtureCollection
      .mockResolvedValueOnce({
        collection: {
          id: 200,
          roundNumber: 1,
          roundName: "Semi-Finals",
          totalRounds: 2,
        },
        fixtures: [
          { id: 301, drawId: 200, slotNumber: 1, status: "unscheduled" },
          { id: 302, drawId: 200, slotNumber: 2, status: "unscheduled" },
        ],
      })
      .mockResolvedValueOnce({
        collection: {
          id: 201,
          roundNumber: 2,
          roundName: "Final",
          totalRounds: 2,
        },
        fixtures: [{ id: 303, drawId: 201, slotNumber: 1, status: "unscheduled" }],
      });

    const result = await promoteCategoryToKnockout(1, 10);

    expect(result.created).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.stage).toBe("quarter_final");
    expect(result.bracket.qualifiers).toHaveLength(4);
    expect(result.bracket.fixtures).toHaveLength(3);
    expect(planKnockoutBracket).toHaveBeenCalledWith([
      { id: 11, seedNumber: 1 },
      { id: 12, seedNumber: 2 },
      { id: 13, seedNumber: 3 },
      { id: 14, seedNumber: 4 },
    ]);
    expect(createFixtureCollection).toHaveBeenCalledTimes(2);
    expect(wireKnockoutProgressionLinks).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
    expect(loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ qualifierCount: 4 }),
      "TOURNAMENT_PROMOTION_SUCCESS",
    );
  });
});
