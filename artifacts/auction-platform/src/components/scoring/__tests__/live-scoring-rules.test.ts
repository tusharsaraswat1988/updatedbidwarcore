import { describe, expect, it } from "vitest";
import {
  availableDismissalTypes,
  FREE_HIT_DISMISSALS,
  SUPER_BALL_BLOCKED_DISMISSALS,
  totalRunsOnBall,
  parseCricketEventPayload,
  CricketEventType,
} from "@workspace/scoring-core";
import { suggestInningsEndReason } from "@/lib/scoring-match-logic";
import { nextCreaseAfterBall } from "@/lib/scoring-ball";
import { shareNewerMatchDetail } from "@/hooks/use-scoring-match";
import type { ScoringMatchDetail } from "@/lib/scoring-api";

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

  it("rotates strike on a single and keeps it on a double", () => {
    const base = {
      innings: 1,
      over: 0,
      ball: 1,
      strikerId: 10,
      nonStrikerId: 11,
      bowlerId: 20,
      extras: { type: null, runs: 0 },
      wicket: null,
      isLegalDelivery: true,
    };
    expect(nextCreaseAfterBall({ ...base, runsOffBat: 1 })).toEqual({
      strikerId: 11,
      nonStrikerId: 10,
    });
    expect(nextCreaseAfterBall({ ...base, runsOffBat: 2 })).toEqual({
      strikerId: 10,
      nonStrikerId: 11,
    });
    expect(nextCreaseAfterBall({ ...base, runsOffBat: 3, ball: 4 })).toEqual({
      strikerId: 11,
      nonStrikerId: 10,
    });
  });

  it("does not rotate a single on the last ball of the over", () => {
    expect(
      nextCreaseAfterBall({
        innings: 1,
        over: 0,
        ball: 6,
        strikerId: 10,
        nonStrikerId: 11,
        bowlerId: 20,
        runsOffBat: 1,
        extras: { type: null, runs: 0 },
        wicket: null,
        isLegalDelivery: true,
      }),
    ).toEqual({ strikerId: 10, nonStrikerId: 11 });
  });

  it("keeps a newer crease when an older poll arrives late", () => {
    const newer = {
      lastSequence: 4,
      state: { lastSequence: 4, strikerId: 11, nonStrikerId: 10 },
    } as ScoringMatchDetail;
    const older = {
      lastSequence: 3,
      state: { lastSequence: 3, strikerId: 10, nonStrikerId: 11 },
    } as ScoringMatchDetail;
    expect(shareNewerMatchDetail(newer, older)).toBe(newer);
    expect(shareNewerMatchDetail(older, newer).state.strikerId).toBe(11);
  });

  describe("Emergency End Innings & suggestInningsEndReason contract", () => {
    it("suggests all_out when wickets reach maxWickets", () => {
      const state = {
        currentInnings: 1,
        maxWickets: 10,
        oversLimit: 20,
        innings: [
          {
            innings: 1,
            battingTeamId: 1,
            bowlingTeamId: 2,
            runs: 145,
            wickets: 10,
            over: 15,
            ball: 3,
            phase: "in_progress" as const,
          },
        ],
      };

      const reason = suggestInningsEndReason(state as any);
      expect(reason).toBe("all_out");
      expect(typeof reason).toBe("string");
    });

    it("suggests target_reached when 2nd innings reaches chase target", () => {
      const state = {
        currentInnings: 2,
        target: 150,
        maxWickets: 10,
        oversLimit: 20,
        innings: [
          {
            innings: 1,
            battingTeamId: 1,
            bowlingTeamId: 2,
            runs: 149,
            wickets: 8,
            over: 20,
            ball: 0,
            phase: "completed" as const,
          },
          {
            innings: 2,
            battingTeamId: 2,
            bowlingTeamId: 1,
            runs: 152,
            wickets: 4,
            over: 18,
            ball: 2,
            phase: "in_progress" as const,
          },
        ],
      };

      const reason = suggestInningsEndReason(state as any);
      expect(reason).toBe("target_reached");
    });

    it("suggests overs_complete when over limit is reached", () => {
      const state = {
        currentInnings: 1,
        maxWickets: 10,
        oversLimit: 20,
        innings: [
          {
            innings: 1,
            battingTeamId: 1,
            bowlingTeamId: 2,
            runs: 170,
            wickets: 5,
            over: 20,
            ball: 0,
            phase: "in_progress" as const,
          },
        ],
      };

      const reason = suggestInningsEndReason(state as any);
      expect(reason).toBe("overs_complete");
    });

    it("builds valid cricket.innings.ended payload when all batsmen are exhausted", () => {
      const state = {
        currentInnings: 1,
        maxWickets: 10,
        oversLimit: 20,
        innings: [
          {
            innings: 1,
            battingTeamId: 1,
            bowlingTeamId: 2,
            runs: 110,
            wickets: 10,
            over: 14,
            ball: 2,
            phase: "in_progress" as const,
          },
        ],
      };

      const suggest = suggestInningsEndReason(state as any);
      const inn = state.innings[0];

      // Exact payload generated by LiveScoringPad emergency button
      const payload = {
        innings: state.currentInnings,
        reason: suggest,
        runs: inn.runs,
        wickets: inn.wickets,
        overs: `${inn.over}.${inn.ball}`,
      };

      const parsed = parseCricketEventPayload(CricketEventType.INNINGS_ENDED, payload);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.payload.reason).toBe("all_out");
        expect(parsed.payload.runs).toBe(110);
        expect(parsed.payload.wickets).toBe(10);
        expect(parsed.payload.overs).toBe("14.2");
      }
    });
  });
});
