import { describe, expect, it, vi } from "vitest";
import {
  CricketEventType,
  buildCricketScorecardFromEvents,
} from "@workspace/scoring-core";
import { nextCreaseAfterBall } from "@/lib/scoring-ball";

describe("Cricket P1 Scoring UX & Scorecard Verification", () => {
  it("includes byes and leg byes in the authoritative scorecard extras calculation", () => {
    const meta = {
      homeTeamId: 1,
      awayTeamId: 2,
    };

    const events = [
      {
        id: 1,
        matchId: 101,
        sequence: 1,
        eventType: CricketEventType.MATCH_STARTED,
        payload: {
          tossWinnerTeamId: 1,
          electedTo: "bat" as const,
          oversLimit: 20,
        },
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        matchId: 101,
        sequence: 2,
        eventType: CricketEventType.LINEUP_SET,
        payload: {
          teamId: 1,
          playerIds: [10, 11, 12],
          battingOrder: [10, 11],
        },
        createdAt: new Date().toISOString(),
      },
      {
        id: 3,
        matchId: 101,
        sequence: 3,
        eventType: CricketEventType.LINEUP_SET,
        payload: {
          teamId: 2,
          playerIds: [20, 21, 22],
          battingOrder: [20, 21],
        },
        createdAt: new Date().toISOString(),
      },
      {
        id: 4,
        matchId: 101,
        sequence: 4,
        eventType: CricketEventType.BOWLER_CHANGED,
        payload: {
          innings: 1,
          bowlerId: 20,
        },
        createdAt: new Date().toISOString(),
      },
      // Delivery 0.1: 2 Byes
      {
        id: 5,
        matchId: 101,
        sequence: 5,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 0,
          ball: 1,
          strikerId: 10,
          nonStrikerId: 11,
          bowlerId: 20,
          runsOffBat: 0,
          extras: { type: "bye" as const, runs: 2 },
          wicket: null,
          isLegalDelivery: true,
          isSuperBall: false,
        },
        createdAt: new Date().toISOString(),
      },
      // Delivery 0.2: 1 Leg Bye
      {
        id: 6,
        matchId: 101,
        sequence: 6,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 0,
          ball: 2,
          strikerId: 10,
          nonStrikerId: 11,
          bowlerId: 20,
          runsOffBat: 0,
          extras: { type: "leg_bye" as const, runs: 1 },
          wicket: null,
          isLegalDelivery: true,
          isSuperBall: false,
        },
        createdAt: new Date().toISOString(),
      },
      // Delivery 0.3: Wide (1 run)
      {
        id: 7,
        matchId: 101,
        sequence: 7,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 0,
          ball: 3,
          strikerId: 11,
          nonStrikerId: 10,
          bowlerId: 20,
          runsOffBat: 0,
          extras: { type: "wide" as const, runs: 1 },
          wicket: null,
          isLegalDelivery: false,
          isSuperBall: false,
        },
        createdAt: new Date().toISOString(),
      },
    ];

    const scorecard = buildCricketScorecardFromEvents(101, events, meta);

    expect(scorecard.innings.length).toBe(1);
    const inn = scorecard.innings[0];
    expect(inn.extras.byes).toBe(2);
    expect(inn.extras.legByes).toBe(1);
    expect(inn.extras.wides).toBe(1);
    expect(inn.extras.total).toBe(4);
    expect(inn.totalRuns).toBe(4);
  });

  it("rotates strike correctly when delivery 6 of an over has a dot vs single", () => {
    // Dot ball on delivery 6: strike swaps due to end of over
    const dotBallOverEnd = nextCreaseAfterBall(
      {
        strikerId: 10,
        nonStrikerId: 11,
        runsOffBat: 0,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        ball: 6,
      },
      6,
    );
    expect(dotBallOverEnd.strikerId).toBe(11);
    expect(dotBallOverEnd.nonStrikerId).toBe(10);

    // Single run on delivery 6: batsman runs single (swaps), then over ends (swaps back), keeping original striker
    const singleOverEnd = nextCreaseAfterBall(
      {
        strikerId: 10,
        nonStrikerId: 11,
        runsOffBat: 1,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        ball: 6,
      },
      6,
    );
    expect(singleOverEnd.strikerId).toBe(10);
    expect(singleOverEnd.nonStrikerId).toBe(11);
  });

  it("handles run out of non-striker preserving the striker end", () => {
    const runOutNonStriker = nextCreaseAfterBall(
      {
        strikerId: 10,
        nonStrikerId: 11,
        runsOffBat: 0,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        ball: 3,
        wicket: {
          type: "run_out",
          dismissedPlayerId: 11,
        },
      },
      6,
    );

    expect(runOutNonStriker.strikerId).toBe(10); // Striker preserved
    expect(runOutNonStriker.nonStrikerId).toBeNull(); // Vacant for next incoming batter
  });

  it("clears dismissed batter slot when striker is bowled", () => {
    const bowledStriker = nextCreaseAfterBall(
      {
        strikerId: 10,
        nonStrikerId: 11,
        runsOffBat: 0,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        ball: 2,
        wicket: {
          type: "bowled",
          dismissedPlayerId: 10,
        },
      },
      6,
    );

    expect(bowledStriker.strikerId).toBeNull(); // Striker out
    expect(bowledStriker.nonStrikerId).toBe(11); // Non-striker remains
  });

  it("dynamic ballsPerOver allows non-standard (e.g. 5-ball) overs to complete cleanly", () => {
    const dotBallOverEnd5 = nextCreaseAfterBall(
      {
        strikerId: 10,
        nonStrikerId: 11,
        runsOffBat: 0,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        ball: 5,
      },
      5, // 5 balls per over
    );
    expect(dotBallOverEnd5.strikerId).toBe(11);
    expect(dotBallOverEnd5.nonStrikerId).toBe(10);
  });

  describe("P1-A: Prevent optimistic state drift on rejected scoring events", () => {
    it("aborts optimistic local state updates when onBall throws/rejects", async () => {
      let localDismissedBatters: number[] = [];
      let overEndPrompt = false;
      let batterRuns: Record<number, number> = { 101: 15 };
      let pendingNewBatsman = false;

      const recordBallSimulation = async (
        input: { wicket?: { dismissedPlayerId: number }; runsOffBat: number; isLegalDelivery: boolean },
        onBall: () => Promise<void>,
      ) => {
        try {
          await onBall();
        } catch {
          // Rejection handled: do not apply optimistic state
          return;
        }

        if (input.wicket) {
          localDismissedBatters.push(input.wicket.dismissedPlayerId);
          pendingNewBatsman = true;
          delete batterRuns[input.wicket.dismissedPlayerId];
        } else if (input.runsOffBat > 0) {
          batterRuns[101] = (batterRuns[101] ?? 0) + input.runsOffBat;
        }
        if (input.isLegalDelivery) {
          overEndPrompt = true;
        }
      };

      // Simulated rejection (e.g. match lock lost or 409 sequence conflict)
      const failingOnBall = vi.fn().mockRejectedValue(new Error("Match lock lost"));

      await recordBallSimulation(
        {
          wicket: { dismissedPlayerId: 101 },
          runsOffBat: 0,
          isLegalDelivery: true,
        },
        failingOnBall,
      );

      expect(failingOnBall).toHaveBeenCalledTimes(1);
      // Verify local optimistic state did NOT mutate
      expect(localDismissedBatters).toEqual([]);
      expect(overEndPrompt).toBe(false);
      expect(pendingNewBatsman).toBe(false);
      expect(batterRuns[101]).toBe(15); // Batter runs intact
    });

    it("applies optimistic updates only after onBall resolves successfully", async () => {
      let localDismissedBatters: number[] = [];
      let overEndPrompt = false;
      let batterRuns: Record<number, number> = { 101: 15 };

      const recordBallSimulation = async (
        input: { wicket?: { dismissedPlayerId: number }; runsOffBat: number; isLegalDelivery: boolean },
        onBall: () => Promise<void>,
      ) => {
        try {
          await onBall();
        } catch {
          return;
        }

        if (input.wicket) {
          localDismissedBatters.push(input.wicket.dismissedPlayerId);
          delete batterRuns[input.wicket.dismissedPlayerId];
        } else if (input.runsOffBat > 0) {
          batterRuns[101] = (batterRuns[101] ?? 0) + input.runsOffBat;
        }
        if (input.isLegalDelivery) {
          overEndPrompt = true;
        }
      };

      const successfulOnBall = vi.fn().mockResolvedValue(undefined);

      await recordBallSimulation(
        {
          wicket: { dismissedPlayerId: 101 },
          runsOffBat: 0,
          isLegalDelivery: true,
        },
        successfulOnBall,
      );

      expect(successfulOnBall).toHaveBeenCalledTimes(1);
      expect(localDismissedBatters).toEqual([101]);
      expect(overEndPrompt).toBe(true);
      expect(batterRuns[101]).toBeUndefined();
    });
  });

  describe("P1-B: Authoritative batter runs restoration and retire-at-N prompt", () => {
    it("extracts authoritative batter runs from scorecard innings", () => {
      const mockScorecardData = {
        scorecard: {
          innings: [
            {
              innings: 1,
              batting: [
                { playerId: 10, runs: 24, balls: 14 },
                { playerId: 11, runs: 12, balls: 8 },
              ],
            },
          ],
        },
      };

      const currentInn = mockScorecardData.scorecard.innings.find((inn) => inn.innings === 1);
      const authoritativeBatterRuns: Record<number, number> = {};
      for (const b of currentInn?.batting ?? []) {
        authoritativeBatterRuns[b.playerId] = b.runs;
      }

      expect(authoritativeBatterRuns[10]).toBe(24);
      expect(authoritativeBatterRuns[11]).toBe(12);
    });

    it("triggers retire-at-N sheet immediately on first ball after page reload using authoritative initial runs", () => {
      const retireAtRuns = 25;
      const initialBatterRuns: Record<number, number> = { 10: 24 }; // Reloaded state: striker was at 24 runs
      let batterRuns: Record<number, number> = {}; // local state before effect runs
      let retireSheetOpened = false;
      let retirePromptPlayerId: number | null = null;

      // Striker scores 2 runs on first delivery after reload
      const strikerId = 10;
      const runsOffBat = 2;

      const currentRuns = batterRuns[strikerId] ?? initialBatterRuns[strikerId] ?? 0;
      const nextRuns = currentRuns + runsOffBat;
      batterRuns = { ...batterRuns, [strikerId]: nextRuns };

      if (retireAtRuns != null && nextRuns >= retireAtRuns) {
        retirePromptPlayerId = strikerId;
        retireSheetOpened = true;
      }

      expect(nextRuns).toBe(26);
      expect(retireSheetOpened).toBe(true);
      expect(retirePromptPlayerId).toBe(10);
      expect(batterRuns[10]).toBe(26);
    });
  });

  describe("P1-C: BroadcastChannel cancellation and undo handling", () => {
    it("clears active Super Ball activation upon SUPER_BALL_CANCELLED message", () => {
      let activeActivation: { matchId: number; sequence: number } | null = {
        matchId: 40,
        sequence: 12,
      };

      const handleBroadcastMessage = (data: { type: string; matchId?: number; sequence?: number }) => {
        if (data.type === "SUPER_BALL_CANCELLED") {
          if (data.matchId === undefined || data.matchId === activeActivation?.matchId) {
            activeActivation = null;
          }
        }
      };

      handleBroadcastMessage({
        type: "SUPER_BALL_CANCELLED",
        matchId: 40,
        sequence: 13,
      });

      expect(activeActivation).toBeNull();
    });

    it("clears active Super Ball activation upon SCORE_UNDONE if undone sequence <= active sequence", () => {
      let activeActivation: { matchId: number; sequence: number } | null = {
        matchId: 40,
        sequence: 15,
      };

      const handleBroadcastMessage = (data: { type: string; matchId?: number; sequence?: number }) => {
        if (data.type === "SCORE_UNDONE") {
          if (
            (data.matchId === undefined || data.matchId === activeActivation?.matchId) &&
            (data.sequence === undefined || (activeActivation && data.sequence <= activeActivation.sequence))
          ) {
            activeActivation = null;
          }
        }
      };

      // Undoing past delivery 15 rolls back sequence to 14
      handleBroadcastMessage({
        type: "SCORE_UNDONE",
        matchId: 40,
        sequence: 14,
      });

      expect(activeActivation).toBeNull();
    });

    it("does not clear active Super Ball activation if undo happened in a different match or sequence > active sequence", () => {
      let activeActivation: { matchId: number; sequence: number } | null = {
        matchId: 40,
        sequence: 10,
      };

      const handleBroadcastMessage = (data: { type: string; matchId?: number; sequence?: number }) => {
        if (data.type === "SCORE_UNDONE") {
          if (
            (data.matchId === undefined || data.matchId === activeActivation?.matchId) &&
            (data.sequence === undefined || (activeActivation && data.sequence <= activeActivation.sequence))
          ) {
            activeActivation = null;
          }
        }
      };

      // Message for different match
      handleBroadcastMessage({
        type: "SCORE_UNDONE",
        matchId: 99,
        sequence: 5,
      });
      expect(activeActivation).not.toBeNull();

      // Undo with sequence higher than active activation (e.g. subsequent ball undone)
      handleBroadcastMessage({
        type: "SCORE_UNDONE",
        matchId: 40,
        sequence: 12,
      });
      expect(activeActivation).not.toBeNull();
    });
  });

  describe("P1-D: Setup navigation reachability", () => {
    function stepIsReachable(
      step: "toss" | "batting" | "bowling" | "openers" | "bowler",
      params: {
        needsToss: boolean;
        battingId: number | null;
        bowlingId: number | null;
        needsBattingLineup: boolean;
        needsBowlingLineup: boolean;
      },
    ): boolean {
      if (params.needsToss) return step === "toss";
      if (step === "toss") return true;
      if (step === "batting") return params.battingId != null;
      if (step === "bowling") return params.bowlingId != null;
      if (step === "openers") return !params.needsBattingLineup && params.battingId != null;
      if (step === "bowler") return !params.needsBowlingLineup && params.bowlingId != null;
      return false;
    }

    it("allows direct navigation between Batting and Bowling XI after toss without rigid sequence trapping", () => {
      const state = {
        needsToss: false,
        battingId: 1,
        bowlingId: 2,
        needsBattingLineup: true, // Batting XI not yet submitted
        needsBowlingLineup: true, // Bowling XI not yet submitted
      };

      // Both Batting XI and Bowling XI are reachable
      expect(stepIsReachable("batting", state)).toBe(true);
      expect(stepIsReachable("bowling", state)).toBe(true);

      // Openers and Bowler remain guarded until respective lineups are set
      expect(stepIsReachable("openers", state)).toBe(false);
      expect(stepIsReachable("bowler", state)).toBe(false);
    });

    it("unlocks openers once batting lineup is set, and bowler once bowling lineup is set", () => {
      const stateAfterBattingSet = {
        needsToss: false,
        battingId: 1,
        bowlingId: 2,
        needsBattingLineup: false, // Batting XI set
        needsBowlingLineup: true,  // Bowling XI pending
      };

      expect(stepIsReachable("openers", stateAfterBattingSet)).toBe(true);
      expect(stepIsReachable("bowler", stateAfterBattingSet)).toBe(false);

      const stateBothSet = {
        needsToss: false,
        battingId: 1,
        bowlingId: 2,
        needsBattingLineup: false,
        needsBowlingLineup: false,
      };

      expect(stepIsReachable("openers", stateBothSet)).toBe(true);
      expect(stepIsReachable("bowler", stateBothSet)).toBe(true);
    });

    it("restricts navigation to toss only when toss has not been completed", () => {
      const preTossState = {
        needsToss: true,
        battingId: null,
        bowlingId: null,
        needsBattingLineup: true,
        needsBowlingLineup: true,
      };

      expect(stepIsReachable("toss", preTossState)).toBe(true);
      expect(stepIsReachable("batting", preTossState)).toBe(false);
      expect(stepIsReachable("bowling", preTossState)).toBe(false);
      expect(stepIsReachable("openers", preTossState)).toBe(false);
      expect(stepIsReachable("bowler", preTossState)).toBe(false);
    });
  });
});
