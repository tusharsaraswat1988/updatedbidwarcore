import { describe, expect, it } from "vitest";
import { planKnockoutBracket } from "./badminton-knockout-plan";

describe("planKnockoutBracket", () => {
  it("builds a 4-player bracket with semi + final and progression metadata", () => {
    const regs = [
      { id: 1, seedNumber: 1 },
      { id: 2, seedNumber: 2 },
      { id: 3, seedNumber: null },
      { id: 4, seedNumber: null },
    ];
    const rounds = planKnockoutBracket(regs);
    expect(rounds).toHaveLength(2);
    expect(rounds[0].fixtures).toHaveLength(2);
    expect(rounds[1].fixtures).toHaveLength(1);
    expect(rounds[0].fixtures[0].advancesToRoundSlot).toEqual({
      roundNumber: 2,
      slotNumber: 1,
      as: "A",
    });
    expect(rounds[0].fixtures[1].advancesToRoundSlot).toEqual({
      roundNumber: 2,
      slotNumber: 1,
      as: "B",
    });
    expect(rounds[1].fixtures[0].advancesToRoundSlot).toBeNull();
  });

  it("pads byes for non-power-of-two entries", () => {
    const regs = [
      { id: 1, seedNumber: 1 },
      { id: 2, seedNumber: 2 },
      { id: 3, seedNumber: 3 },
    ];
    const rounds = planKnockoutBracket(regs);
    expect(rounds[0].fixtures).toHaveLength(2);
    const byes = rounds[0].fixtures.filter((f) => f.status === "walkover");
    expect(byes.length).toBeGreaterThanOrEqual(1);
  });
});
