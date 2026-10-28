import { beforeEach, describe, expect, it, vi } from "vitest";

let tournamentPhase = "active";
let selectCall = 0;

const categories: Array<{ id: number; phase: string }> = [
  { id: 1, phase: "live" },
  { id: 2, phase: "live" },
];

const matchRows: Array<{ id: number; status: string; categoryId: number }> = [
  { id: 10, status: "completed", categoryId: 1 },
  { id: 11, status: "walkover", categoryId: 2 },
];

const fixtures: Array<{
  id: number;
  categoryId: number;
  scoringMatchId: number | null;
  status: string;
}> = [];

const broadcastCalls: unknown[] = [];

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: () => {
        selectCall += 1;
        if (selectCall === 1) {
          return {
            where: () => ({
              limit: async () => [{ scoringPhase: tournamentPhase, scoringEnabled: true }],
            }),
          };
        }
        if (selectCall === 2) {
          return {
            where: async () => categories.map((c) => ({ ...c })),
          };
        }
        if (selectCall === 3) {
          return {
            innerJoin: () => ({
              where: async () => matchRows,
            }),
          };
        }
        return {
          where: async () => fixtures,
        };
      },
    }),
    update: () => ({
      set: (patch: { phase?: string; scoringPhase?: string }) => ({
        where: async () => {
          if (patch.scoringPhase) tournamentPhase = patch.scoringPhase;
        },
      }),
    }),
  },
  badmintonCategoriesTable: {
    id: "id",
    tournamentId: "tournament_id",
    phase: "phase",
  },
  badmintonFixturesTable: {
    id: "id",
    categoryId: "category_id",
    tournamentId: "tournament_id",
    scoringMatchId: "scoring_match_id",
    status: "status",
  },
  badmintonMatchDetailsTable: {
    scoringMatchId: "scoring_match_id",
    tournamentId: "tournament_id",
    categoryId: "category_id",
  },
  scoringMatchesTable: {
    id: "id",
    tournamentId: "tournament_id",
    sportSlug: "sport_slug",
    status: "status",
  },
  tournamentsTable: {
    id: "id",
    scoringPhase: "scoring_phase",
    scoringEnabled: "scoring_enabled",
  },
}));

vi.mock("../lib/badminton-broadcast", () => ({
  broadcastTournamentUpdate: (_tid: number, payload: unknown) => {
    broadcastCalls.push(payload);
  },
}));

import { refreshBadmintonLifecycle } from "../lib/badminton-lifecycle";

describe("refreshBadmintonLifecycle", () => {
  beforeEach(() => {
    selectCall = 0;
    tournamentPhase = "active";
    categories.length = 0;
    categories.push({ id: 1, phase: "live" }, { id: 2, phase: "live" });
    matchRows.length = 0;
    matchRows.push(
      { id: 10, status: "completed", categoryId: 1 },
      { id: 11, status: "walkover", categoryId: 2 },
    );
    fixtures.length = 0;
    broadcastCalls.length = 0;
  });

  it("marks started categories complete and sets scoringPhase to completed when all categories complete", async () => {
    const result = await refreshBadmintonLifecycle(42);

    expect(result.tournamentCompleted).toBe(true);
    expect(result.tournamentScoringPhase).toBe("completed");
    expect(broadcastCalls.length).toBeGreaterThan(0);
  });

  it("does NOT complete tournament when unstarted category exists in setup (P0-08)", async () => {
    // Category 1 (Men's Singles): completed
    // Category 2 (Women's Singles): unstarted setup category
    categories.length = 0;
    categories.push(
      { id: 1, phase: "live" }, // Will complete from finished match
      { id: 2, phase: "setup" }, // Still in setup, no matches/fixtures
    );
    matchRows.length = 0;
    matchRows.push({ id: 10, status: "completed", categoryId: 1 });

    const result = await refreshBadmintonLifecycle(42);

    // Category 1 completed, but Category 2 is in setup
    expect(result.categoriesUpdated).toContain(1);
    expect(result.tournamentCompleted).toBe(false);
    expect(result.tournamentScoringPhase).toBe("active");
  });

  it("transitions tournament to completed after the final unstarted category finishes (P0-08)", async () => {
    // Both Category 1 and Category 2 are now complete
    categories.length = 0;
    categories.push(
      { id: 1, phase: "completed" },
      { id: 2, phase: "live" }, // Category 2 finishes its match
    );
    matchRows.length = 0;
    matchRows.push(
      { id: 10, status: "completed", categoryId: 1 },
      { id: 20, status: "completed", categoryId: 2 },
    );

    const result = await refreshBadmintonLifecycle(42);

    expect(result.tournamentCompleted).toBe(true);
    expect(result.tournamentScoringPhase).toBe("completed");
  });
});
