import { describe, expect, it } from "vitest";
import {
  getCanonicalSeedOrder,
  planKnockoutBracket,
} from "./badminton-knockout-plan";

describe("planKnockoutBracket — BWF Seeding and Byes (P0-01, P0-02)", () => {
  it("generates correct canonical seed lines where Seed 1 and Seed 2 are in opposite halves", () => {
    for (const size of [2, 4, 8, 16, 32, 64]) {
      const order = getCanonicalSeedOrder(size);
      expect(order).toHaveLength(size);
      // Seed 1 is always in the top half (first element)
      expect(order[0]).toBe(1);
      // Seed 2 is always in the bottom half (last element)
      expect(order[size - 1]).toBe(2);
      // Half-point boundary check
      const topHalf = order.slice(0, size / 2);
      const bottomHalf = order.slice(size / 2);
      expect(topHalf).toContain(1);
      expect(topHalf).not.toContain(2);
      expect(bottomHalf).toContain(2);
      expect(bottomHalf).not.toContain(1);

      if (size >= 4) {
        // Seeds 3 and 4 in balanced quarters and opposite halves
        expect(bottomHalf).toContain(3);
        expect(topHalf).toContain(4);
      }
    }
  });

  it("throws descriptive error for invalid entrant count or duplicate seeds", () => {
    expect(() => planKnockoutBracket([])).toThrow(/at least 2 entrants/);
    expect(() => planKnockoutBracket([{ id: 1, seedNumber: 1 }])).toThrow(
      /at least 2 entrants/,
    );
    expect(() =>
      planKnockoutBracket([
        { id: 1, seedNumber: 1 },
        { id: 2, seedNumber: 1 },
      ]),
    ).toThrow(/Duplicate seed number: 1/);
    expect(() =>
      planKnockoutBracket([
        { id: 1, seedNumber: 0 },
        { id: 2, seedNumber: null },
      ]),
    ).toThrow(/Invalid seed number: 0/);
    expect(() =>
      planKnockoutBracket([
        { id: 1, seedNumber: 5 },
        { id: 2, seedNumber: null },
      ]),
    ).toThrow(/Seed number 5 exceeds registration count 2/);
  });

  const testCounts = [2, 3, 4, 5, 6, 7, 8, 9, 16, 32];

  for (const count of testCounts) {
    it(`plans bracket correctly for entrant count ${count} without null-vs-null deadlocks`, () => {
      const regs = Array.from({ length: count }, (_, i) => ({
        id: 100 + i,
        // Seed top 2 entrants when count >= 2, top 4 when count >= 4
        seedNumber:
          i === 0 ? 1 : i === 1 ? 2 : count >= 4 && i === 2 ? 3 : count >= 4 && i === 3 ? 4 : null,
      }));

      const rounds = planKnockoutBracket(regs, { deterministic: true });
      const bracketSize = Math.pow(2, Math.ceil(Math.log2(count)));
      const expectedRounds = Math.log2(bracketSize);

      expect(rounds).toHaveLength(expectedRounds);
      expect(rounds[0].fixtures).toHaveLength(bracketSize / 2);
      expect(rounds[rounds.length - 1].fixtures).toHaveLength(1);
      expect(rounds[rounds.length - 1].roundName).toBe("Final");

      // Verify no null-vs-null match in Round 1
      for (const f of rounds[0].fixtures) {
        expect(f.registrationAId !== null || f.registrationBId !== null).toBe(true);
        if (f.registrationAId === null || f.registrationBId === null) {
          expect(f.status).toBe("walkover");
        } else {
          expect(f.status).toBe("unscheduled");
        }
      }

      // Verify every entrant is accounted for exactly once in Round 1
      const placedIds: number[] = [];
      for (const f of rounds[0].fixtures) {
        if (f.registrationAId != null) placedIds.push(f.registrationAId);
        if (f.registrationBId != null) placedIds.push(f.registrationBId);
      }
      expect(placedIds.sort()).toEqual(regs.map((r) => r.id).sort());

      // Verify Seed 1 and Seed 2 cannot meet before the Final
      const r1 = rounds[0].fixtures;
      if (r1.length === 1) {
        // Direct final: Seed 1 is slot A, Seed 2 is slot B
        expect(r1[0].registrationAId).toBe(100);
        expect(r1[0].registrationBId).toBe(101);
      } else {
        const mid = r1.length / 2;
        const topHalfR1 = r1.slice(0, mid);
        const bottomHalfR1 = r1.slice(mid);

        const topHalfIds = topHalfR1.flatMap((f) => [f.registrationAId, f.registrationBId]);
        const bottomHalfIds = bottomHalfR1.flatMap((f) => [f.registrationAId, f.registrationBId]);

        expect(topHalfIds).toContain(100); // Seed 1
        expect(topHalfIds).not.toContain(101); // Seed 2
        expect(bottomHalfIds).toContain(101); // Seed 2
        expect(bottomHalfIds).not.toContain(100); // Seed 1
      }

      // Verify progression links: every round links forward to next round slot until Final
      for (let r = 0; r < rounds.length - 1; r++) {
        const currentRound = rounds[r];
        const nextRound = rounds[r + 1];
        for (const f of currentRound.fixtures) {
          expect(f.advancesToRoundSlot).toBeDefined();
          expect(f.advancesToRoundSlot?.roundNumber).toBe(currentRound.roundNumber + 1);
          expect(f.advancesToRoundSlot?.slotNumber).toBeLessThanOrEqual(nextRound.fixtures.length);
        }
      }
      // Final fixture does not advance
      expect(rounds[rounds.length - 1].fixtures[0].advancesToRoundSlot).toBeNull();
    });
  }

  it("verifies 5-entrant bracket advancement path (P0-02 non-power-of-two bye allocation)", () => {
    // 5 entrants in an 8-bracket: 3 byes opposing Seeds 1, 2, 3.
    const regs = [
      { id: 101, seedNumber: 1 },
      { id: 102, seedNumber: 2 },
      { id: 103, seedNumber: 3 },
      { id: 104, seedNumber: null },
      { id: 105, seedNumber: null },
    ];
    const rounds = planKnockoutBracket(regs, { deterministic: true });
    expect(rounds).toHaveLength(3); // QF, SF, Final
    const r1 = rounds[0].fixtures; // 4 fixtures in QF
    expect(r1).toHaveLength(4);

    // Match 1: Seed 1 (101) vs Bye -> walkover
    expect(r1[0].registrationAId).toBe(101);
    expect(r1[0].registrationBId).toBeNull();
    expect(r1[0].status).toBe("walkover");

    // Match 2: Entrant vs Entrant -> played
    expect(r1[1].registrationAId).not.toBeNull();
    expect(r1[1].registrationBId).not.toBeNull();
    expect(r1[1].status).toBe("unscheduled");

    // Match 3: Seed 3 (103) vs Bye -> walkover
    expect(r1[2].registrationAId).toBe(103);
    expect(r1[2].registrationBId).toBeNull();
    expect(r1[2].status).toBe("walkover");

    // Match 4: Bye vs Seed 2 (102) -> walkover
    expect(r1[3].registrationAId).toBeNull();
    expect(r1[3].registrationBId).toBe(102);
    expect(r1[3].status).toBe("walkover");

    // ZERO null-vs-null matches!
    const nullNullMatches = r1.filter(
      (f) => f.registrationAId === null && f.registrationBId === null,
    );
    expect(nullNullMatches).toHaveLength(0);
  });
});
