import { describe, expect, it } from "vitest";
import {
  planRoundRobin,
  rrPairKey,
  splitIntoGroups,
} from "./badminton-round-robin-plan";
import { planGroupKnockout } from "./badminton-group-knockout-plan";
import { computeRoundRobinStandings } from "./badminton-standings";

describe("planRoundRobin", () => {
  it("produces each unordered pair exactly once for even N", () => {
    const ids = [1, 2, 3, 4];
    const { fixtures, totalRounds } = planRoundRobin(ids);
    expect(totalRounds).toBe(3);
    expect(fixtures).toHaveLength(6); // C(4,2) = 6

    const pairs = new Set(fixtures.map((f) => rrPairKey(f.registrationAId, f.registrationBId)));
    expect(pairs.size).toBe(6);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        expect(pairs.has(rrPairKey(ids[i]!, ids[j]!))).toBe(true);
      }
    }
  });

  it("supports odd N with byes (no bye rows in fixture list)", () => {
    const ids = [10, 20, 30];
    const { fixtures, totalRounds, byeByRound } = planRoundRobin(ids);
    expect(totalRounds).toBe(3); // padded to 4 → 3 rounds
    expect(fixtures).toHaveLength(3); // C(3,2) = 3
    expect(byeByRound).toHaveLength(3);

    const pairs = new Set(fixtures.map((f) => rrPairKey(f.registrationAId, f.registrationBId)));
    expect(pairs.size).toBe(3);
    expect(fixtures.every((f) => f.registrationAId > 0 && f.registrationBId > 0)).toBe(true);
  });

  it("returns empty for fewer than 2 entries", () => {
    expect(planRoundRobin([]).fixtures).toHaveLength(0);
    expect(planRoundRobin([1]).fixtures).toHaveLength(0);
  });
});

describe("splitIntoGroups", () => {
  it("defaults to up to 4 groups with balanced sizes", () => {
    const ids = [1, 2, 3, 4, 5, 6, 7, 8];
    const groups = splitIntoGroups(ids);
    expect(groups).toHaveLength(4);
    expect(groups.every((g) => g.registrationIds.length === 2)).toBe(true);
    const all = groups.flatMap((g) => g.registrationIds).sort((a, b) => a - b);
    expect(all).toEqual(ids);
  });

  it("respects groupSize", () => {
    const ids = Array.from({ length: 12 }, (_, i) => i + 1);
    const groups = splitIntoGroups(ids, { groupSize: 3 });
    expect(groups).toHaveLength(4);
    expect(groups.every((g) => g.registrationIds.length === 3)).toBe(true);
  });

  it("never creates more groups than players or singleton-heavy splits when avoidable", () => {
    const groups = splitIntoGroups([1, 2, 3], { groupCount: 4 });
    expect(groups.length).toBeLessThanOrEqual(3);
    expect(groups.every((g) => g.registrationIds.length >= 1)).toBe(true);
  });
});

describe("planGroupKnockout", () => {
  it("plans RR per group and a KO for group winners", () => {
    const ids = Array.from({ length: 8 }, (_, i) => i + 1);
    const plan = planGroupKnockout(ids, { groupCount: 4 });
    expect(plan.groups).toHaveLength(4);
    expect(plan.qualifiers).toHaveLength(4);
    expect(plan.knockout.length).toBeGreaterThanOrEqual(2); // SF + Final

    for (const g of plan.groups) {
      const pairs = new Set(
        g.plan.fixtures.map((f) => rrPairKey(f.registrationAId, f.registrationBId)),
      );
      expect(pairs.size).toBe(g.plan.fixtures.length);
    }

    const r1 = plan.knockout[0]!;
    expect(r1.fixtures.every((f) => f.registrationAId == null && f.registrationBId == null)).toBe(
      true,
    );
  });
});

describe("computeRoundRobinStandings", () => {
  it("tallies W-L from completed fixtures", () => {
    const rows = computeRoundRobinStandings(
      [
        {
          registrationAId: 1,
          registrationBId: 2,
          winnerRegistrationId: 1,
          status: "completed",
        },
        {
          registrationAId: 1,
          registrationBId: 3,
          winnerRegistrationId: 3,
          status: "completed",
        },
        {
          registrationAId: 2,
          registrationBId: 3,
          winnerRegistrationId: 2,
          status: "walkover",
        },
      ],
      [1, 2, 3],
    );
    expect(rows[0]).toMatchObject({ registrationId: 1, wins: 1, losses: 1, played: 2 });
    // 1,2,3 each have 1 win — sort by wins then losses then id
    const byId = Object.fromEntries(rows.map((r) => [r.registrationId, r]));
    expect(byId[1]).toMatchObject({ wins: 1, losses: 1 });
    expect(byId[2]).toMatchObject({ wins: 1, losses: 1 });
    expect(byId[3]).toMatchObject({ wins: 1, losses: 1 });
  });
});
