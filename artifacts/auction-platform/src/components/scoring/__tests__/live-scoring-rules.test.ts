import { describe, expect, it } from "vitest";
import {
  availableDismissalTypes,
  FREE_HIT_DISMISSALS,
  SUPER_BALL_BLOCKED_DISMISSALS,
  totalRunsOnBall,
} from "@workspace/scoring-core";

describe("Live Scoring Rules & Keypad helpers", () => {
  it("filters out LBW when lbwEnabled is false", () => {
    const withLbw = availableDismissalTypes(true);
    const withoutLbw = availableDismissalTypes(false);

    expect(withLbw).toContain("lbw");
    expect(withoutLbw).not.toContain("lbw");
    expect(withoutLbw).toContain("bowled");
    expect(withoutLbw).toContain("caught");
    expect(withoutLbw).toContain("run_out");
  });

  it("identifies blocked dismissals on Super Ball", () => {
    expect(SUPER_BALL_BLOCKED_DISMISSALS).toContain("bowled");
    expect(SUPER_BALL_BLOCKED_DISMISSALS).toContain("caught");
    expect(SUPER_BALL_BLOCKED_DISMISSALS).not.toContain("run_out");
    expect(SUPER_BALL_BLOCKED_DISMISSALS).not.toContain("stumped");
  });

  it("identifies allowed dismissals on Free Hit", () => {
    expect(FREE_HIT_DISMISSALS).toContain("run_out");
    expect(FREE_HIT_DISMISSALS).toContain("hit_ball_twice");
    expect(FREE_HIT_DISMISSALS).toContain("obstructing_field");
    expect(FREE_HIT_DISMISSALS).not.toContain("bowled");
    expect(FREE_HIT_DISMISSALS).not.toContain("caught");
    expect(FREE_HIT_DISMISSALS).not.toContain("lbw");
    expect(FREE_HIT_DISMISSALS).not.toContain("stumped");
  });

  it("calculates Super Ball doubled runs for singles, doubles, fours, and sixes", () => {
    const makeBall = (runsOffBat: number, isSuperBall: boolean, extrasRuns = 0) => ({
      innings: 1,
      over: 0,
      ball: 1,
      strikerId: 10,
      nonStrikerId: 11,
      bowlerId: 20,
      runsOffBat,
      extras: { type: null, runs: extrasRuns },
      wicket: null,
      isLegalDelivery: true,
      isSuperBall,
    });

    // Normal balls
    expect(totalRunsOnBall(makeBall(0, false))).toBe(0);
    expect(totalRunsOnBall(makeBall(1, false))).toBe(1);
    expect(totalRunsOnBall(makeBall(2, false))).toBe(2);
    expect(totalRunsOnBall(makeBall(4, false))).toBe(4);
    expect(totalRunsOnBall(makeBall(6, false))).toBe(6);

    // Super balls (ALL runs doubled)
    expect(totalRunsOnBall(makeBall(0, true))).toBe(0);
    expect(totalRunsOnBall(makeBall(1, true))).toBe(2);
    expect(totalRunsOnBall(makeBall(2, true))).toBe(4);
    expect(totalRunsOnBall(makeBall(3, true))).toBe(6);
    expect(totalRunsOnBall(makeBall(4, true))).toBe(8);
    expect(totalRunsOnBall(makeBall(6, true))).toBe(12);
  });
});
