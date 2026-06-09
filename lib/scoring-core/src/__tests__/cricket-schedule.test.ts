import { describe, expect, it } from "vitest";
import {
  generateGroupStageSchedules,
  generateKnockoutSchedule,
  generateRoundRobinSchedule,
} from "../cricket/schedule";

describe("cricket schedule generators", () => {
  it("generates round-robin for 4 teams", () => {
    const fixtures = generateRoundRobinSchedule([1, 2, 3, 4]);
    expect(fixtures).toHaveLength(6);
    const pairs = new Set(fixtures.map((f) => [f.homeTeamId, f.awayTeamId].sort().join("-")));
    expect(pairs.size).toBe(6);
  });

  it("generates knockout for 8 teams", () => {
    const fixtures = generateKnockoutSchedule([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(fixtures.filter((f) => f.roundName === "Quarter Final")).toHaveLength(4);
    expect(fixtures.some((f) => f.roundName === "Final")).toBe(false);
  });

  it("generates group stage schedules", () => {
    const fixtures = generateGroupStageSchedules([
      { name: "A", teamIds: [1, 2] },
      { name: "B", teamIds: [3, 4] },
    ]);
    expect(fixtures).toHaveLength(2);
    expect(fixtures.every((f) => f.roundName.startsWith("A") || f.roundName.startsWith("B"))).toBe(
      true,
    );
  });
});
