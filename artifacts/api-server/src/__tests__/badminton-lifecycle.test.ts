import { beforeEach, describe, expect, it, vi } from "vitest";

let tournamentPhase = "active";
let selectCall = 0;

const categories = [
  { id: 1, phase: "live" },
  { id: 2, phase: "live" },
];

const matchRows = [
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
          if (patch.phase === "completed") {
            for (const c of categories) c.phase = "completed";
          }
        },
      }),
    }),
  },
  badmintonCategoriesTable: {},
  badmintonFixturesTable: {},
  badmintonMatchDetailsTable: {},
  scoringMatchesTable: {},
  tournamentsTable: {},
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
    categories[0].phase = "live";
    categories[1].phase = "live";
    fixtures.length = 0;
    broadcastCalls.length = 0;
  });

  it("marks started categories complete and sets scoringPhase to completed", async () => {
    const result = await refreshBadmintonLifecycle(42);

    expect(result.tournamentCompleted).toBe(true);
    expect(result.tournamentScoringPhase).toBe("completed");
    expect(broadcastCalls.length).toBeGreaterThan(0);
  });
});
