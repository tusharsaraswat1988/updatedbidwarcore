import { describe, expect, it } from "vitest";
import {
  planPairRoundRobinFixtures,
  planTeamTieGroupFixtures,
} from "./group-fixtures";

describe("planTeamTieGroupFixtures", () => {
  it("generates 15 fixtures for 3 teams with 5 pairs each (VNBL Group)", () => {
    const teams = [
      { teamId: 1, teamName: "Team A", registrationIds: [101, 102, 103, 104, 105] },
      { teamId: 2, teamName: "Team B", registrationIds: [201, 202, 203, 204, 205] },
      { teamId: 3, teamName: "Team C", registrationIds: [301, 302, 303, 304, 305] },
    ];

    const fixtures = planTeamTieGroupFixtures("Group 1", teams);
    expect(fixtures).toHaveLength(15);

    const abRubbers = fixtures.filter(
      (f) => f.metaJson.teamAId === 1 && f.metaJson.teamBId === 2,
    );
    expect(abRubbers).toHaveLength(5);
    expect(abRubbers[0]?.registrationAId).toBe(101);
    expect(abRubbers[0]?.registrationBId).toBe(201);
  });
});

describe("planPairRoundRobinFixtures — Sports-Only Pair Round-Robin (P0-03)", () => {
  it("generates exactly 6 unique fixtures for a group of 4 entrants", () => {
    const regIds = [101, 102, 103, 104];
    const fixtures = planPairRoundRobinFixtures("Group A", regIds);

    // 4 entrants: 4 * 3 / 2 = 6 unique fixtures across 3 rounds
    expect(fixtures).toHaveLength(6);

    const pairKeys = new Set<string>();
    for (const f of fixtures) {
      expect(f.registrationAId).not.toBe(f.registrationBId); // No self matches
      const key = [f.registrationAId, f.registrationBId].sort().join("-");
      expect(pairKeys.has(key)).toBe(false); // No duplicate matches
      pairKeys.add(key);
      expect(f.roundLabel).toMatch(/^Group A — Round \d+$/);
      expect(f.metaJson.algorithm).toBe("pair_round_robin");
      expect(f.metaJson.groupName).toBe("Group A");
    }

    expect(pairKeys.size).toBe(6);
  });

  it("generates exactly 10 unique fixtures for a group of 5 entrants (odd-sized group)", () => {
    const regIds = [201, 202, 203, 204, 205];
    const fixtures = planPairRoundRobinFixtures("Group B", regIds);

    // 5 entrants: 5 * 4 / 2 = 10 unique fixtures across 5 rounds
    expect(fixtures).toHaveLength(10);

    const pairKeys = new Set<string>();
    for (const f of fixtures) {
      expect(f.registrationAId).not.toBe(f.registrationBId);
      const key = [f.registrationAId, f.registrationBId].sort().join("-");
      expect(pairKeys.has(key)).toBe(false);
      pairKeys.add(key);
      expect(f.roundLabel).toMatch(/^Group B — Round \d+$/);
      expect(f.metaJson.algorithm).toBe("pair_round_robin");
    }

    expect(pairKeys.size).toBe(10);
  });

  it("handles 1-participant and empty groups cleanly without generating fixtures", () => {
    expect(planPairRoundRobinFixtures("Group Single", [99])).toHaveLength(0);
    expect(planPairRoundRobinFixtures("Group Empty", [])).toHaveLength(0);
  });
});
