import { describe, expect, it } from "vitest";
import {
  hasCompletedGames,
  resolveAssignedMarginForCommand,
  validateAssignedMarginPoints,
} from "./assigned-margin";
import type { BadmintonGameState } from "./types";

const completedGame: BadmintonGameState = {
  gameNumber: 1,
  leftScore: 21,
  rightScore: 15,
  servingSide: "left",
  intervalReached: false,
  phase: "completed",
  winner: "left",
};

describe("assigned margin helpers", () => {
  it("detects completed games", () => {
    expect(hasCompletedGames([])).toBe(false);
    expect(hasCompletedGames([completedGame])).toBe(true);
  });

  it("requires positive integer when no completed games", () => {
    expect(validateAssignedMarginPoints({ games: [] }, undefined)).toMatch(/required/i);
    expect(validateAssignedMarginPoints({ games: [] }, 0)).toMatch(/required/i);
    expect(validateAssignedMarginPoints({ games: [] }, 21)).toBeNull();
    expect(validateAssignedMarginPoints({ games: [completedGame] }, undefined)).toBeNull();
  });

  it("resolves command margin only when needed", () => {
    expect(resolveAssignedMarginForCommand({ games: [] }, 21)).toEqual({
      ok: true,
      value: 21,
    });
    expect(resolveAssignedMarginForCommand({ games: [completedGame] }, 21)).toEqual({
      ok: true,
    });
    expect(resolveAssignedMarginForCommand({ games: [] }, undefined).ok).toBe(false);
  });
});
