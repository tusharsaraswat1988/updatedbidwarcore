import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const mockUpdate = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: vi.fn(),
  },
  badmintonCategoriesTable: {
    id: "id",
    tournamentId: "tournament_id",
    currentStage: "current_stage",
    drawType: "draw_type",
    phase: "phase",
    updatedAt: "updated_at",
  },
  badmintonDrawsTable: {
    id: "id",
    tournamentId: "tournament_id",
    categoryId: "category_id",
    roundName: "round_name",
    roundNumber: "round_number",
    groupId: "group_id",
    metaJson: "meta_json",
  },
  badmintonFixturesTable: {
    id: "id",
    tournamentId: "tournament_id",
    categoryId: "category_id",
    drawId: "draw_id",
    status: "status",
  },
}));

import {
  advanceStage,
  initialKnockoutStageFromRounds,
  isCompleted,
  isElimination,
  isLeague,
  normalizeStage,
  promotionPersistedStage,
  resolveGateCollection,
  resolveLifecycleStage,
  resolveStageDto,
  setPromotionStage,
  stageColumnForNewCategory,
  stageDisplayLabel,
  toLifecycleStage,
  writeCategoryStage,
  type TournamentStageDto,
} from "./tournament-stage";

describe("normalizeStage", () => {
  it("accepts canonical persisted values", () => {
    expect(normalizeStage("league")).toBe("league");
    expect(normalizeStage("quarter_final")).toBe("quarter_final");
    expect(normalizeStage("semi_final")).toBe("semi_final");
    expect(normalizeStage("final")).toBe("final");
    expect(normalizeStage("completed")).toBe("completed");
  });

  it("accepts explicit aliases only", () => {
    expect(normalizeStage("QF")).toBe("quarter_final");
    expect(normalizeStage("Quarter Final")).toBe("quarter_final");
    expect(normalizeStage("semi-finals")).toBe("semi_final");
  });

  it("rejects unknown values without inventing mappings", () => {
    expect(normalizeStage("elite_8")).toBeNull();
    expect(normalizeStage("knockout")).toBeNull();
    expect(normalizeStage(123)).toBeNull();
    expect(normalizeStage("")).toBeNull();
    expect(normalizeStage(null)).toBeNull();
  });
});

describe("resolveStageDto", () => {
  it("resolves league / QF / SF / final / completed", () => {
    expect(
      resolveStageDto({
        drawType: "group_knockout",
        currentStage: "league",
      }),
    ).toEqual({
      currentStage: "league",
      lifecycleStage: "league",
      displayLabel: "League",
    });

    expect(
      resolveStageDto({
        drawType: "group_knockout",
        currentStage: "quarter_final",
      }),
    ).toEqual({
      currentStage: "quarter_final",
      lifecycleStage: "elimination",
      displayLabel: "Quarter Final",
    });

    expect(
      resolveStageDto({
        drawType: "knockout",
        currentStage: "semi_final",
      }),
    ).toEqual({
      currentStage: "semi_final",
      lifecycleStage: "elimination",
      displayLabel: "Semi Final",
    });

    expect(
      resolveStageDto({
        drawType: "knockout",
        currentStage: "final",
      }),
    ).toEqual({
      currentStage: "final",
      lifecycleStage: "elimination",
      displayLabel: "Final",
    });

    expect(
      resolveStageDto({
        drawType: "group_knockout",
        currentStage: "completed",
      }),
    ).toEqual({
      currentStage: "completed",
      lifecycleStage: "completed",
      displayLabel: "Completed",
    });
  });

  it("legacy null stage uses drawType / phase fallback (unchanged)", () => {
    expect(
      resolveStageDto({
        drawType: "group_knockout",
        currentStage: null,
      }),
    ).toEqual({
      currentStage: "league",
      lifecycleStage: "league",
      displayLabel: "League",
    });

    expect(
      resolveStageDto({
        drawType: "round_robin",
        currentStage: null,
      }),
    ).toEqual({
      currentStage: "league",
      lifecycleStage: "league",
      displayLabel: "League",
    });

    expect(
      resolveStageDto({
        drawType: "knockout",
        currentStage: null,
      }),
    ).toEqual({
      currentStage: null,
      lifecycleStage: null,
      displayLabel: null,
    });

    expect(
      resolveStageDto({
        drawType: "knockout",
        currentStage: null,
        phase: "completed",
      }),
    ).toEqual({
      currentStage: "completed",
      lifecycleStage: "completed",
      displayLabel: "Completed",
    });
  });

  it("is deterministic and does not mutate input", () => {
    const input = {
      drawType: "group_knockout",
      currentStage: "quarter_final" as string | null,
      phase: "live" as string | null,
    };
    const snapshot = structuredClone(input);
    const a = resolveStageDto(input);
    const b = resolveStageDto(input);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(input).toEqual(snapshot);
  });
});

describe("lifecycle + predicates", () => {
  it("maps knockout literals to elimination", () => {
    expect(toLifecycleStage("quarter_final")).toBe("elimination");
    expect(toLifecycleStage("semi_final")).toBe("elimination");
    expect(toLifecycleStage("final")).toBe("elimination");
    expect(toLifecycleStage("elimination")).toBe("elimination");
  });

  it("maps league and completed unchanged", () => {
    expect(toLifecycleStage("league")).toBe("league");
    expect(toLifecycleStage("completed")).toBe("completed");
  });

  it("resolveLifecycleStage uses drawType fallback for null stage", () => {
    expect(
      resolveLifecycleStage({
        drawType: "group_knockout",
        currentStage: null,
      }),
    ).toBe("league");
  });

  it("predicates use lifecycle, not displayLabel", () => {
    const league: TournamentStageDto = {
      currentStage: "league",
      lifecycleStage: "league",
      displayLabel: "League",
    };
    const qf: TournamentStageDto = {
      currentStage: "quarter_final",
      lifecycleStage: "elimination",
      displayLabel: "Quarter Final",
    };
    const done: TournamentStageDto = {
      currentStage: "completed",
      lifecycleStage: "completed",
      displayLabel: "Completed",
    };

    expect(isLeague(league)).toBe(true);
    expect(isLeague(qf)).toBe(false);
    expect(isElimination(qf)).toBe(true);
    expect(isElimination(league)).toBe(false);
    expect(isCompleted(done)).toBe(true);
    expect(isCompleted(qf)).toBe(false);
  });
});

describe("presentation", () => {
  it("stageDisplayLabel returns human labels", () => {
    expect(stageDisplayLabel("league")).toBe("League");
    expect(stageDisplayLabel("quarter_final")).toBe("Quarter Final");
    expect(stageDisplayLabel(null)).toBeNull();
  });

  it("promotionPersistedStage returns today's P0 literal", () => {
    expect(promotionPersistedStage()).toBe("quarter_final");
  });

  it("stageColumnForNewCategory matches draw-type defaults", () => {
    expect(stageColumnForNewCategory("group_knockout")).toBe("league");
    expect(stageColumnForNewCategory("round_robin")).toBe("league");
    expect(stageColumnForNewCategory("knockout")).toBeNull();
  });
});

describe("write helpers", () => {
  it("writeCategoryStage updates currentStage via executor", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });

    await writeCategoryStage(
      { select: vi.fn(), insert: vi.fn(), delete: vi.fn(), update } as never,
      1,
      10,
      "semi_final",
    );

    expect(update).toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ currentStage: "semi_final" }),
    );
    expect(where).toHaveBeenCalled();
  });

  it("setPromotionStage writes provided stage through writeCategoryStage", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });

    const stage = await setPromotionStage(
      { select: vi.fn(), insert: vi.fn(), delete: vi.fn(), update } as never,
      1,
      10,
      "semi_final",
    );

    expect(stage).toBe("semi_final");
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ currentStage: "semi_final" }),
    );
  });

  it("initialKnockoutStageFromRounds maps first real KO round", () => {
    expect(
      initialKnockoutStageFromRounds([
        { roundNumber: 1, roundName: "Semi-Finals" },
        { roundNumber: 2, roundName: "Final" },
      ]),
    ).toBe("semi_final");
    expect(
      initialKnockoutStageFromRounds([
        { roundNumber: 1, roundName: "Quarter-Finals" },
        { roundNumber: 2, roundName: "Semi-Finals" },
        { roundNumber: 3, roundName: "Final" },
      ]),
    ).toBe("quarter_final");
    expect(
      initialKnockoutStageFromRounds([
        { roundNumber: 1, roundName: "Round of 16" },
        { roundNumber: 2, roundName: "Quarter-Finals" },
      ]),
    ).toBe("quarter_final");
  });
});

describe("resolveGateCollection", () => {
  const collections = [
    {
      id: 1,
      roundName: "Round of 16",
      roundNumber: 1,
      groupId: null,
      metaJson: { algorithm: "knockout" },
    },
    {
      id: 2,
      roundName: "Quarter-Finals",
      roundNumber: 2,
      groupId: null,
      metaJson: { algorithm: "knockout" },
    },
    {
      id: 3,
      roundName: "Semi-Finals",
      roundNumber: 3,
      groupId: null,
      metaJson: { algorithm: "knockout" },
    },
    {
      id: 4,
      roundName: "Final",
      roundNumber: 4,
      groupId: null,
      metaJson: { algorithm: "knockout" },
    },
  ];

  it("gates quarter_final on Quarter-Finals even when Ro16 exists", () => {
    expect(resolveGateCollection("quarter_final", collections)?.id).toBe(2);
  });

  it("gates semi_final / final by name", () => {
    expect(resolveGateCollection("semi_final", collections)?.roundName).toBe(
      "Semi-Finals",
    );
    expect(resolveGateCollection("final", collections)?.roundName).toBe("Final");
  });
});

describe("advanceStage", () => {
  function makeExecutor(opts: {
    category: { drawType: string; currentStage: string | null; phase: string };
    collections: Array<{
      id: number;
      roundName: string;
      roundNumber: number;
      groupId: null;
      metaJson: Record<string, unknown>;
    }>;
    fixturesByDrawId: Record<number, Array<{ id: number; status: string }>>;
  }) {
    const writes: string[] = [];
    const select = vi.fn().mockImplementation(() => {
      const chain: {
        from: ReturnType<typeof vi.fn>;
        where: ReturnType<typeof vi.fn>;
        orderBy: ReturnType<typeof vi.fn>;
        limit: ReturnType<typeof vi.fn>;
      } = {
        from: vi.fn(),
        where: vi.fn(),
        orderBy: vi.fn(),
        limit: vi.fn(),
      };

      // Category select: .from().where().limit()
      // Draws: .from().where().orderBy() → thenable
      // Fixtures: .from().where() → thenable
      chain.from.mockImplementation(() => chain);
      chain.where.mockImplementation(() => chain);
      chain.orderBy.mockImplementation(async () => opts.collections);
      chain.limit.mockImplementation(async () => [opts.category]);

      // When awaited after where (fixtures), return fixtures for last draw filter.
      // Drizzle where is opaque — return all fixtures flattened by probing writes.
      const thenable = {
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
          // Heuristic: if orderBy was used, collections; if limit, category already handled.
          // Fixtures query uses where without orderBy/limit await pattern.
          const drawIds = Object.keys(opts.fixturesByDrawId).map(Number);
          // Prefer returning fixtures for the gate draw that still has rows.
          for (const id of drawIds) {
            const rows = opts.fixturesByDrawId[id];
            if (rows) {
              // Return based on which gate stage would need — simplified: return
              // fixtures for the preferred gate of current category stage.
              break;
            }
          }
          const stage = opts.category.currentStage;
          let drawId =
            stage === "quarter_final"
              ? opts.collections.find((c) => c.roundName === "Quarter-Finals")?.id
              : stage === "semi_final"
                ? opts.collections.find((c) => c.roundName === "Semi-Finals")?.id
                : stage === "final"
                  ? opts.collections.find((c) => c.roundName === "Final")?.id
                  : undefined;
          // After writes, category.currentStage may lag — use last write.
          if (writes.length > 0) {
            const last = writes[writes.length - 1]!;
            drawId =
              last === "quarter_final"
                ? opts.collections.find((c) => c.roundName === "Quarter-Finals")?.id
                : last === "semi_final"
                  ? opts.collections.find((c) => c.roundName === "Semi-Finals")?.id
                  : last === "final"
                    ? opts.collections.find((c) => c.roundName === "Final")?.id
                    : drawId;
          }
          const rows = drawId != null ? (opts.fixturesByDrawId[drawId] ?? []) : [];
          return Promise.resolve(rows).then(resolve, reject);
        },
      };

      // where() returns chain that is also thenable for fixtures, and has orderBy/limit
      chain.where.mockImplementation(() => Object.assign(chain, thenable));
      return chain;
    });

    const update = vi.fn().mockImplementation(() => ({
      set: (patch: { currentStage?: string | null }) => ({
        where: async () => {
          if (patch.currentStage !== undefined && patch.currentStage != null) {
            writes.push(patch.currentStage);
            opts.category.currentStage = patch.currentStage;
          }
        },
      }),
    }));

    return {
      executor: {
        select,
        insert: vi.fn(),
        delete: vi.fn(),
        update,
      } as never,
      writes,
    };
  }

  it("advances QF → SF when Quarter-Finals fixtures are terminal", async () => {
    const { executor, writes } = makeExecutor({
      category: {
        drawType: "group_knockout",
        currentStage: "quarter_final",
        phase: "live",
      },
      collections: [
        {
          id: 10,
          roundName: "Quarter-Finals",
          roundNumber: 1,
          groupId: null,
          metaJson: { algorithm: "knockout" },
        },
        {
          id: 11,
          roundName: "Semi-Finals",
          roundNumber: 2,
          groupId: null,
          metaJson: { algorithm: "knockout" },
        },
        {
          id: 12,
          roundName: "Final",
          roundNumber: 3,
          groupId: null,
          metaJson: { algorithm: "knockout" },
        },
      ],
      fixturesByDrawId: {
        10: [
          { id: 1, status: "completed" },
          { id: 2, status: "walkover" },
          { id: 3, status: "retired" },
          { id: 4, status: "cancelled" },
        ],
        11: [
          { id: 5, status: "unscheduled" },
          { id: 6, status: "unscheduled" },
        ],
        12: [{ id: 7, status: "unscheduled" }],
      },
    });

    const result = await advanceStage(executor, 1, 10);
    expect(result.changed).toBe(true);
    expect(result.previousStage).toBe("quarter_final");
    expect(result.currentStage).toBe("semi_final");
    expect(result.transitionCount).toBe(1);
    expect(result.reason).toBe("ADVANCED");
    expect(writes).toEqual(["semi_final"]);
  });

  it("does not advance while gate has live match", async () => {
    const { executor, writes } = makeExecutor({
      category: {
        drawType: "group_knockout",
        currentStage: "quarter_final",
        phase: "live",
      },
      collections: [
        {
          id: 10,
          roundName: "Quarter-Finals",
          roundNumber: 1,
          groupId: null,
          metaJson: { algorithm: "knockout" },
        },
      ],
      fixturesByDrawId: {
        10: [
          { id: 1, status: "completed" },
          { id: 2, status: "live" },
        ],
      },
    });

    const result = await advanceStage(executor, 1, 10);
    expect(result.changed).toBe(false);
    expect(result.reason).toBe("HAS_PENDING_MATCHES");
    expect(writes).toEqual([]);
  });

  it("stays on quarter_final when Ro16 done but QF pending", async () => {
    const { executor, writes } = makeExecutor({
      category: {
        drawType: "knockout",
        currentStage: "quarter_final",
        phase: "live",
      },
      collections: [
        {
          id: 1,
          roundName: "Round of 16",
          roundNumber: 1,
          groupId: null,
          metaJson: { algorithm: "knockout" },
        },
        {
          id: 2,
          roundName: "Quarter-Finals",
          roundNumber: 2,
          groupId: null,
          metaJson: { algorithm: "knockout" },
        },
      ],
      fixturesByDrawId: {
        1: Array.from({ length: 8 }, (_, i) => ({
          id: i + 1,
          status: "completed",
        })),
        2: [
          { id: 20, status: "unscheduled" },
          { id: 21, status: "unscheduled" },
          { id: 22, status: "unscheduled" },
          { id: 23, status: "unscheduled" },
        ],
      },
    });

    const result = await advanceStage(executor, 1, 10);
    expect(result.changed).toBe(false);
    expect(result.currentStage).toBe("quarter_final");
    expect(result.reason).toBe("HAS_PENDING_MATCHES");
    expect(writes).toEqual([]);
  });

  it("Final terminal → completed", async () => {
    const { executor, writes } = makeExecutor({
      category: {
        drawType: "knockout",
        currentStage: "final",
        phase: "live",
      },
      collections: [
        {
          id: 99,
          roundName: "Final",
          roundNumber: 1,
          groupId: null,
          metaJson: { algorithm: "knockout" },
        },
      ],
      fixturesByDrawId: {
        99: [{ id: 1, status: "completed" }],
      },
    });

    const result = await advanceStage(executor, 1, 10);
    expect(result.changed).toBe(true);
    expect(result.currentStage).toBe("completed");
    expect(result.completed).toBe(true);
    expect(result.reason).toBe("ADVANCED");
    expect(writes).toEqual(["completed"]);
  });

  it("already completed is a no-op", async () => {
    const { executor, writes } = makeExecutor({
      category: {
        drawType: "knockout",
        currentStage: "completed",
        phase: "completed",
      },
      collections: [],
      fixturesByDrawId: {},
    });

    const result = await advanceStage(executor, 1, 10);
    expect(result.changed).toBe(false);
    expect(result.transitionCount).toBe(0);
    expect(result.reason).toBe("TOURNAMENT_COMPLETED");
    expect(writes).toEqual([]);
  });

  it("cascades SF → Final → completed when all terminal", async () => {
    const { executor, writes } = makeExecutor({
      category: {
        drawType: "group_knockout",
        currentStage: "semi_final",
        phase: "live",
      },
      collections: [
        {
          id: 11,
          roundName: "Semi-Finals",
          roundNumber: 1,
          groupId: null,
          metaJson: { algorithm: "knockout" },
        },
        {
          id: 12,
          roundName: "Final",
          roundNumber: 2,
          groupId: null,
          metaJson: { algorithm: "knockout" },
        },
      ],
      fixturesByDrawId: {
        11: [
          { id: 1, status: "completed" },
          { id: 2, status: "disqualified" },
        ],
        12: [{ id: 3, status: "abandoned" }],
      },
    });

    const result = await advanceStage(executor, 1, 10);
    expect(result.changed).toBe(true);
    expect(result.currentStage).toBe("completed");
    expect(result.transitionCount).toBe(2);
    expect(writes).toEqual(["final", "completed"]);
  });
});

describe("architecture guard — no direct stage writes outside helper", () => {
  const helperFile = "tournament-stage.ts";
  /** Scan api-server src (lib + routes), not only this directory. */
  const srcRoot = join(__dirname, "..");

  function walkTsFiles(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (name === "node_modules" || name === "dist") continue;
        out.push(...walkTsFiles(full));
      } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
        out.push(full);
      }
    }
    return out;
  }

  it("fails if currentStage is written via .set outside tournament-stage.ts", () => {
    const offenders: string[] = [];
    // Match Drizzle-style stage column writes: .set({ ... currentStage ... })
    const setStageRe = /\.set\(\s*\{[^}]*\bcurrentStage\b/s;

    for (const file of walkTsFiles(srcRoot)) {
      if (file.endsWith(helperFile)) continue;
      const text = readFileSync(file, "utf8");
      if (setStageRe.test(text)) {
        offenders.push(file.replace(srcRoot + "\\", "").replace(srcRoot + "/", ""));
      }
    }

    expect(offenders).toEqual([]);
  });

  it("fails if business code compares raw stage literals outside helper", () => {
    const offenders: string[] = [];
    // Business comparisons like currentStage === "league" (not Zod / types / tests)
    const literalCompareRe =
      /\bcurrentStage\s*===\s*["'](league|quarter_final|semi_final|final|completed)["']/;

    for (const file of walkTsFiles(srcRoot)) {
      if (file.endsWith(helperFile)) continue;
      if (file.includes(`${join("lib", "tournament-stage")}`)) continue;
      const text = readFileSync(file, "utf8");
      if (literalCompareRe.test(text)) {
        offenders.push(file.replace(srcRoot + "\\", "").replace(srcRoot + "/", ""));
      }
    }

    expect(offenders).toEqual([]);
  });
});
