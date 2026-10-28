import { describe, expect, it } from "vitest";
import { arrangeGroupQualifiersForKnockout } from "./badminton-promotion-engine";
import { planKnockoutBracket } from "./badminton-knockout-plan";

describe("arrangeGroupQualifiersForKnockout — Rematch Prevention (P0-04)", () => {
  it("prevents same-group rematch in Round 1 for 2 groups with 2 qualifiers each", () => {
    const qualifiers = [
      { registrationId: 101, groupId: 1, rank: 1 }, // Group A 1st
      { registrationId: 102, groupId: 1, rank: 2 }, // Group A 2nd
      { registrationId: 201, groupId: 2, rank: 1 }, // Group B 1st
      { registrationId: 202, groupId: 2, rank: 2 }, // Group B 2nd
    ];

    const seeded = arrangeGroupQualifiersForKnockout(qualifiers);
    const rounds = planKnockoutBracket(seeded);

    expect(rounds).toHaveLength(2); // Semis + Final
    const r1 = rounds[0].fixtures;
    expect(r1).toHaveLength(2);

    // Semi 1: A1 vs B2
    expect(r1[0].registrationAId).toBe(101);
    expect(r1[0].registrationBId).toBe(202);

    // Semi 2: A2 vs B1
    expect(r1[1].registrationAId).toBe(102);
    expect(r1[1].registrationBId).toBe(201);

    // Prove: No match has entrants from the same group
    for (const fix of r1) {
      const sideAGroup = fix.registrationAId! < 200 ? "A" : "B";
      const sideBGroup = fix.registrationBId! < 200 ? "A" : "B";
      expect(sideAGroup).not.toBe(sideBGroup);
    }

    // Prove: Same-group qualifiers are in opposite halves of the bracket
    const topHalf = [r1[0].registrationAId, r1[0].registrationBId];
    const bottomHalf = [r1[1].registrationAId, r1[1].registrationBId];

    expect(topHalf).toContain(101); // A1
    expect(bottomHalf).toContain(102); // A2
    expect(bottomHalf).toContain(201); // B1
    expect(topHalf).toContain(202); // B2
  });

  it("prevents same-group rematch in Round 1 for 4 groups with 2 qualifiers each", () => {
    const qualifiers = [
      { registrationId: 101, groupId: 1, rank: 1 }, // A1
      { registrationId: 102, groupId: 1, rank: 2 }, // A2
      { registrationId: 201, groupId: 2, rank: 1 }, // B1
      { registrationId: 202, groupId: 2, rank: 2 }, // B2
      { registrationId: 301, groupId: 3, rank: 1 }, // C1
      { registrationId: 302, groupId: 3, rank: 2 }, // C2
      { registrationId: 401, groupId: 4, rank: 1 }, // D1
      { registrationId: 402, groupId: 4, rank: 2 }, // D2
    ];

    const seeded = arrangeGroupQualifiersForKnockout(qualifiers);
    const rounds = planKnockoutBracket(seeded);

    expect(rounds).toHaveLength(3); // QF, SF, Final
    const qf = rounds[0].fixtures;
    expect(qf).toHaveLength(4);

    // Q1: A1 vs B2
    expect(qf[0].registrationAId).toBe(101);
    expect(qf[0].registrationBId).toBe(202);

    // Q2: C1 vs D2
    expect(qf[1].registrationAId).toBe(301);
    expect(qf[1].registrationBId).toBe(402);

    // Q3: D1 vs C2
    expect(qf[2].registrationAId).toBe(401);
    expect(qf[2].registrationBId).toBe(302);

    // Q4: A2 vs B1
    expect(qf[3].registrationAId).toBe(102);
    expect(qf[3].registrationBId).toBe(201);

    // Prove: No match has entrants from the same group
    const groupOf = (id: number) => Math.floor(id / 100);
    for (const fix of qf) {
      expect(groupOf(fix.registrationAId!)).not.toBe(groupOf(fix.registrationBId!));
    }

    // Prove: Same-group qualifiers are in opposite halves of the bracket
    const topHalf = [qf[0], qf[1]].flatMap((f) => [f.registrationAId, f.registrationBId]);
    const bottomHalf = [qf[2], qf[3]].flatMap((f) => [f.registrationAId, f.registrationBId]);

    expect(topHalf).toContain(101); // A1 in top half
    expect(bottomHalf).toContain(102); // A2 in bottom half
    expect(bottomHalf).toContain(201); // B1 in bottom half
    expect(topHalf).toContain(202); // B2 in top half
    expect(topHalf).toContain(301); // C1 in top half
    expect(bottomHalf).toContain(302); // C2 in bottom half
    expect(bottomHalf).toContain(401); // D1 in bottom half
    expect(topHalf).toContain(402); // D2 in top half
  });
});
