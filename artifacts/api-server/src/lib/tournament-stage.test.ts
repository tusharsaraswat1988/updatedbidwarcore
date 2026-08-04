import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  badmintonCategoriesTable: {},
}));

import {
  promotionPersistedStage,
  resolveLifecycleStage,
  toLifecycleStage,
} from "./tournament-stage";

describe("tournament-stage helper", () => {
  it("promotionPersistedStage returns today's P0 literal", () => {
    expect(promotionPersistedStage()).toBe("quarter_final");
  });

  it("maps knockout literals to lifecycle elimination", () => {
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
});
