import { describe, expect, it } from "vitest";
import {
  CricketEventType,
  createEventEnvelope,
  createInitialCricketState,
  reduceCricket,
  replayCricketEvents,
  InvalidEventPayloadError,
  cricketScoringAdapter,
} from "../index";

const matchMeta = {
  matchId: 100,
  tournamentId: 10,
  homeTeamId: 1,
  awayTeamId: 2,
  oversLimit: 20,
  maxWickets: 10,
};

function createStartEnvelope(seq = 1) {
  return createEventEnvelope({
    matchId: 100,
    tournamentId: 10,
    sportSlug: "cricket",
    eventType: CricketEventType.MATCH_STARTED,
    sequence: seq,
    payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 20 },
    actorType: "organizer",
  });
}

function createBallEnvelope(
  seq: number,
  overrides: Partial<{
    innings: number;
    over: number;
    ball: number;
    strikerId: number;
    nonStrikerId: number;
    bowlerId: number;
    runsOffBat: number;
    extras: { type: "wide" | "no_ball" | "bye" | "leg_bye" | null; runs: number };
    wicket: { type: "bowled" | "caught" | "lbw" | "run_out" | "stumped"; dismissedPlayerId: number } | null;
    isLegalDelivery: boolean;
  }> = {},
) {
  return createEventEnvelope({
    matchId: 100,
    tournamentId: 10,
    sportSlug: "cricket",
    eventType: CricketEventType.BALL_RECORDED,
    sequence: seq,
    payload: {
      innings: overrides.innings ?? 1,
      over: overrides.over ?? 0,
      ball: overrides.ball ?? 1,
      strikerId: overrides.strikerId ?? 101,
      nonStrikerId: overrides.nonStrikerId ?? 102,
      bowlerId: overrides.bowlerId ?? 201,
      runsOffBat: overrides.runsOffBat ?? 0,
      extras: overrides.extras ?? { type: null, runs: 0 },
      wicket: overrides.wicket ?? null,
      isLegalDelivery: overrides.isLegalDelivery ?? true,
    },
    actorType: "organizer",
  });
}

describe("Cricket match lifecycle hardening", () => {
  describe("MATCH_STARTED reinitialization protection", () => {
    it("rejects MATCH_STARTED → BALL_RECORDED → MATCH_STARTED and never resets state", () => {
      const initial = createInitialCricketState(matchMeta);
      const started = reduceCricket(initial, createStartEnvelope(1));
      expect(started.matchStatus).toBe("live");
      expect(started.currentInnings).toBe(1);

      const afterBall = reduceCricket(
        started,
        createBallEnvelope(2, { runsOffBat: 4, over: 0, ball: 1 }),
      );
      expect(afterBall.innings[0]?.runs).toBe(4);
      expect(afterBall.innings[0]?.ball).toBe(1);

      // Second MATCH_STARTED must be rejected deterministically
      expect(() =>
        reduceCricket(
          afterBall,
          createStartEnvelope(3),
        ),
      ).toThrow(InvalidEventPayloadError);

      expect(() =>
        reduceCricket(
          afterBall,
          createStartEnvelope(3),
        ),
      ).toThrow(/match has already started/);

      // Verify state was not modified or reset
      expect(afterBall.innings[0]?.runs).toBe(4);
      expect(afterBall.innings[0]?.ball).toBe(1);
      expect(afterBall.matchStatus).toBe("live");
      expect(afterBall.currentInnings).toBe(1);
    });

    it("replaying complete event stream never allows a second start to reset state", () => {
      const events = [
        createStartEnvelope(1),
        createBallEnvelope(2, { runsOffBat: 6, over: 0, ball: 1 }),
        createStartEnvelope(3), // Malicious or buggy second start in stream
      ];

      expect(() => replayCricketEvents(matchMeta, events)).toThrow(
        InvalidEventPayloadError,
      );
    });

    it("adapter validateBeforeAppend rejects MATCH_STARTED when matchStatus is not scheduled", () => {
      const liveRes = cricketScoringAdapter.validateBeforeAppend!({
        tournamentId: 10,
        matchId: 100,
        eventType: CricketEventType.MATCH_STARTED,
        payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 20 },
        matchStatus: "live",
      });
      expect(liveRes.ok).toBe(false);
      if (!liveRes.ok) {
        expect(liveRes.code).toBe("MATCH_ALREADY_STARTED");
      }

      const completedRes = cricketScoringAdapter.validateBeforeAppend!({
        tournamentId: 10,
        matchId: 100,
        eventType: CricketEventType.MATCH_STARTED,
        payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 20 },
        matchStatus: "completed",
      });
      expect(completedRes.ok).toBe(false);
      if (!completedRes.ok) {
        expect(completedRes.code).toBe("MATCH_ALREADY_STARTED");
      }

      const scheduledRes = cricketScoringAdapter.validateBeforeAppend!({
        tournamentId: 10,
        matchId: 100,
        eventType: CricketEventType.MATCH_STARTED,
        payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 20 },
        matchStatus: "scheduled",
      });
      expect(scheduledRes.ok).toBe(true);
    });
  });

  describe("MATCH_COMPLETED validation and terminal states", () => {
    it("rejects premature MATCH_COMPLETED when match is scheduled", () => {
      const initial = createInitialCricketState(matchMeta);
      expect(() =>
        reduceCricket(
          initial,
          createEventEnvelope({
            matchId: 100,
            tournamentId: 10,
            sportSlug: "cricket",
            eventType: CricketEventType.MATCH_COMPLETED,
            sequence: 1,
            payload: {
              winnerTeamId: 1,
              margin: "10 runs",
              resultText: "Won by 10 runs",
            },
            actorType: "organizer",
          }),
        ),
      ).toThrow(/Match is not in progress/);
    });

    it("rejects premature MATCH_COMPLETED right after MATCH_STARTED", () => {
      const started = reduceCricket(
        createInitialCricketState(matchMeta),
        createStartEnvelope(1),
      );

      expect(() =>
        reduceCricket(
          started,
          createEventEnvelope({
            matchId: 100,
            tournamentId: 10,
            sportSlug: "cricket",
            eventType: CricketEventType.MATCH_COMPLETED,
            sequence: 2,
            payload: {
              winnerTeamId: 1,
              margin: "10 runs",
              resultText: "Won by 10 runs",
            },
            actorType: "organizer",
          }),
        ),
      ).toThrow(/first innings is still in progress/);
    });

    it("rejects premature MATCH_COMPLETED mid-first innings", () => {
      const started = reduceCricket(
        createInitialCricketState(matchMeta),
        createStartEnvelope(1),
      );
      const afterBalls = reduceCricket(
        started,
        createBallEnvelope(2, { runsOffBat: 4 }),
      );

      expect(() =>
        reduceCricket(
          afterBalls,
          createEventEnvelope({
            matchId: 100,
            tournamentId: 10,
            sportSlug: "cricket",
            eventType: CricketEventType.MATCH_COMPLETED,
            sequence: 3,
            payload: {
              winnerTeamId: 1,
              margin: "10 runs",
              resultText: "Won by 10 runs",
            },
            actorType: "organizer",
          }),
        ),
      ).toThrow(/first innings is still in progress/);
    });

    it("rejects premature MATCH_COMPLETED mid-second innings when chase is not terminal", () => {
      const live = reduceCricket(
        createInitialCricketState(matchMeta),
        createStartEnvelope(1),
      );
      // End innings 1: 150 runs, target = 151
      const inn1End = reduceCricket(
        live,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.INNINGS_ENDED,
          sequence: 2,
          payload: {
            innings: 1,
            reason: "overs_complete",
            runs: 150,
            wickets: 5,
            overs: "20.0",
          },
          actorType: "organizer",
        }),
      );

      // Innings 2 just started, 0 balls bowled (0 runs < target 151)
      expect(() =>
        reduceCricket(
          inn1End,
          createEventEnvelope({
            matchId: 100,
            tournamentId: 10,
            sportSlug: "cricket",
            eventType: CricketEventType.MATCH_COMPLETED,
            sequence: 3,
            payload: {
              winnerTeamId: 1,
              margin: "150 runs",
              resultText: "Won by 150 runs",
            },
            actorType: "organizer",
          }),
        ),
      ).toThrow(/second innings is still in progress/);

      // Bowl a few balls: 10/1 in 2nd innings (not reached target 151, not all out, not overs complete)
      const inn2Balls = reduceCricket(
        inn1End,
        createBallEnvelope(3, {
          innings: 2,
          strikerId: 201,
          nonStrikerId: 202,
          bowlerId: 101,
          runsOffBat: 4,
          over: 0,
          ball: 1,
        }),
      );

      expect(() =>
        reduceCricket(
          inn2Balls,
          createEventEnvelope({
            matchId: 100,
            tournamentId: 10,
            sportSlug: "cricket",
            eventType: CricketEventType.MATCH_COMPLETED,
            sequence: 4,
            payload: {
              winnerTeamId: 1,
              margin: "147 runs",
              resultText: "Won by 147 runs",
            },
            actorType: "organizer",
          }),
        ),
      ).toThrow(/second innings is still in progress/);
    });

    it("accepts MATCH_COMPLETED when second innings ended via INNINGS_ENDED", () => {
      const live = reduceCricket(
        createInitialCricketState(matchMeta),
        createStartEnvelope(1),
      );
      const inn1End = reduceCricket(
        live,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.INNINGS_ENDED,
          sequence: 2,
          payload: {
            innings: 1,
            reason: "overs_complete",
            runs: 150,
            wickets: 5,
            overs: "20.0",
          },
          actorType: "organizer",
        }),
      );
      const inn2End = reduceCricket(
        inn1End,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.INNINGS_ENDED,
          sequence: 3,
          payload: {
            innings: 2,
            reason: "overs_complete",
            runs: 130,
            wickets: 7,
            overs: "20.0",
          },
          actorType: "organizer",
        }),
      );

      const completed = reduceCricket(
        inn2End,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.MATCH_COMPLETED,
          sequence: 4,
          payload: {
            winnerTeamId: 1,
            margin: "20 runs",
            resultText: "Team 1 won by 20 runs",
          },
          actorType: "organizer",
        }),
      );

      expect(completed.matchStatus).toBe("completed");
      expect(completed.sessionStatus).toBe("idle");
      expect(completed.winnerTeamId).toBe(1);
    });

    it("accepts MATCH_COMPLETED when second innings reaches chase target", () => {
      const live = reduceCricket(
        createInitialCricketState(matchMeta),
        createStartEnvelope(1),
      );
      // Innings 1: 50 runs -> target = 51
      const inn1End = reduceCricket(
        live,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.INNINGS_ENDED,
          sequence: 2,
          payload: {
            innings: 1,
            reason: "all_out",
            runs: 50,
            wickets: 10,
            overs: "10.0",
          },
          actorType: "organizer",
        }),
      );

      // Innings 2 hits runs to reach 52 (>= target 51)
      const chaseWon = reduceCricket(
        inn1End,
        createBallEnvelope(3, {
          innings: 2,
          strikerId: 201,
          nonStrikerId: 202,
          bowlerId: 101,
          runsOffBat: 20,
          over: 0,
          ball: 1,
        }),
      );
      const chaseWon2 = reduceCricket(
        chaseWon,
        createBallEnvelope(4, {
          innings: 2,
          strikerId: 201,
          nonStrikerId: 202,
          bowlerId: 101,
          runsOffBat: 20,
          over: 0,
          ball: 2,
        }),
      );
      const chaseWon3 = reduceCricket(
        chaseWon2,
        createBallEnvelope(5, {
          innings: 2,
          strikerId: 201,
          nonStrikerId: 202,
          bowlerId: 101,
          runsOffBat: 12,
          over: 0,
          ball: 3,
        }),
      );

      expect(chaseWon3.innings[1]?.runs).toBe(52);
      expect(chaseWon3.target).toBe(51);

      const completed = reduceCricket(
        chaseWon3,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.MATCH_COMPLETED,
          sequence: 6,
          payload: {
            winnerTeamId: 2,
            margin: "10 wkts",
            resultText: "Team 2 won by 10 wickets",
          },
          actorType: "organizer",
        }),
      );

      expect(completed.matchStatus).toBe("completed");
      expect(completed.winnerTeamId).toBe(2);
      expect(completed.innings[1]?.phase).toBe("completed");
    });

    it("accepts MATCH_COMPLETED when second innings is all out", () => {
      const live = reduceCricket(
        createInitialCricketState({ ...matchMeta, maxWickets: 2 }),
        createStartEnvelope(1),
      );
      const inn1End = reduceCricket(
        live,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.INNINGS_ENDED,
          sequence: 2,
          payload: {
            innings: 1,
            reason: "overs_complete",
            runs: 100,
            wickets: 1,
            overs: "20.0",
          },
          actorType: "organizer",
        }),
      );

      // Innings 2 loses 2 wickets (maxWickets: 2)
      const w1 = reduceCricket(
        inn1End,
        createBallEnvelope(3, {
          innings: 2,
          strikerId: 201,
          nonStrikerId: 202,
          bowlerId: 101,
          runsOffBat: 0,
          wicket: { type: "bowled", dismissedPlayerId: 201 },
          over: 0,
          ball: 1,
        }),
      );
      const w2 = reduceCricket(
        w1,
        createBallEnvelope(4, {
          innings: 2,
          strikerId: 203,
          nonStrikerId: 202,
          bowlerId: 101,
          runsOffBat: 0,
          wicket: { type: "bowled", dismissedPlayerId: 203 },
          over: 0,
          ball: 2,
        }),
      );

      expect(w2.innings[1]?.wickets).toBe(2);

      const completed = reduceCricket(
        w2,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.MATCH_COMPLETED,
          sequence: 5,
          payload: {
            winnerTeamId: 1,
            margin: "100 runs",
            resultText: "Team 1 won by 100 runs",
          },
          actorType: "organizer",
        }),
      );

      expect(completed.matchStatus).toBe("completed");
    });

    it("accepts MATCH_COMPLETED with DLS target revision", () => {
      const live = reduceCricket(
        createInitialCricketState(matchMeta),
        createStartEnvelope(1),
      );
      const inn1End = reduceCricket(
        live,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.INNINGS_ENDED,
          sequence: 2,
          payload: {
            innings: 1,
            reason: "overs_complete",
            runs: 160,
            wickets: 4,
            overs: "20.0",
          },
          actorType: "organizer",
        }),
      );

      // Rain interruption and DLS applied: revised overs 10, target 90
      const dlsState = reduceCricket(
        inn1End,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.DLS_APPLIED,
          sequence: 3,
          payload: {
            innings: 2,
            revisedOvers: 10,
            parScore: 89,
            target: 90,
          },
          actorType: "organizer",
        }),
      );

      expect(dlsState.target).toBe(90);

      // End innings 2 after 10 overs with 92 runs
      const inn2End = reduceCricket(
        dlsState,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.INNINGS_ENDED,
          sequence: 4,
          payload: {
            innings: 2,
            reason: "target_reached",
            runs: 92,
            wickets: 3,
            overs: "9.2",
          },
          actorType: "organizer",
        }),
      );

      const completed = reduceCricket(
        inn2End,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.MATCH_COMPLETED,
          sequence: 5,
          payload: {
            winnerTeamId: 2,
            margin: "7 wkts (DLS)",
            resultText: "Team 2 won by 7 wickets (DLS)",
          },
          actorType: "organizer",
        }),
      );

      expect(completed.matchStatus).toBe("completed");
      expect(completed.winnerTeamId).toBe(2);
    });

    it("handles Super Over lifecycle before completion", () => {
      const live = reduceCricket(
        createInitialCricketState({
          ...matchMeta,
          superOverEnabled: true,
          superOverTrigger: "knockout_tie",
          matchTypeId: "semi_final",
          superOverWickets: 2,
        }),
        createStartEnvelope(1),
      );

      // Innings 1: 50 runs
      const inn1End = reduceCricket(
        live,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.INNINGS_ENDED,
          sequence: 2,
          payload: {
            innings: 1,
            reason: "overs_complete",
            runs: 50,
            wickets: 5,
            overs: "5.0",
          },
          actorType: "organizer",
        }),
      );

      // Innings 2: 50 runs (Tie)
      const inn2End = reduceCricket(
        inn1End,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.INNINGS_ENDED,
          sequence: 3,
          payload: {
            innings: 2,
            reason: "super_over_required",
            runs: 50,
            wickets: 4,
            overs: "5.0",
          },
          actorType: "organizer",
        }),
      );

      // Start Super Over 1 (innings 3)
      const super1 = reduceCricket(
        inn2End,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.SUPER_OVER_STARTED,
          sequence: 4,
          payload: {
            innings: 3,
            battingTeamId: 1,
            bowlingTeamId: 2,
            oversLimit: 1,
          },
          actorType: "organizer",
        }),
      );

      // Super Over 1 in progress: MATCH_COMPLETED must be rejected
      expect(() =>
        reduceCricket(
          super1,
          createEventEnvelope({
            matchId: 100,
            tournamentId: 10,
            sportSlug: "cricket",
            eventType: CricketEventType.MATCH_COMPLETED,
            sequence: 5,
            payload: {
              winnerTeamId: 1,
              margin: "Super Over",
              resultText: "Won in Super Over",
            },
            actorType: "organizer",
          }),
        ),
      ).toThrow(/Super Over is in progress/);

      // End Super Over 1: 10 runs
      const super1End = reduceCricket(
        super1,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.INNINGS_ENDED,
          sequence: 5,
          payload: {
            innings: 3,
            reason: "overs_complete",
            runs: 10,
            wickets: 1,
            overs: "1.0",
          },
          actorType: "organizer",
        }),
      );

      // Start Super Over 2 (innings 4)
      const super2 = reduceCricket(
        super1End,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.SUPER_OVER_STARTED,
          sequence: 6,
          payload: {
            innings: 4,
            battingTeamId: 2,
            bowlingTeamId: 1,
            oversLimit: 1,
          },
          actorType: "organizer",
        }),
      );

      // Super Over 2 in progress: rejected
      expect(() =>
        reduceCricket(
          super2,
          createEventEnvelope({
            matchId: 100,
            tournamentId: 10,
            sportSlug: "cricket",
            eventType: CricketEventType.MATCH_COMPLETED,
            sequence: 7,
            payload: {
              winnerTeamId: 2,
              margin: "Super Over",
              resultText: "Won in Super Over",
            },
            actorType: "organizer",
          }),
        ),
      ).toThrow(/second Super Over innings is still in progress/);

      // End Super Over 2: 12 runs (Team 2 wins)
      const super2End = reduceCricket(
        super2,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.INNINGS_ENDED,
          sequence: 7,
          payload: {
            innings: 4,
            reason: "target_reached",
            runs: 12,
            wickets: 0,
            overs: "0.5",
          },
          actorType: "organizer",
        }),
      );

      // Now valid to complete
      const completed = reduceCricket(
        super2End,
        createEventEnvelope({
          matchId: 100,
          tournamentId: 10,
          sportSlug: "cricket",
          eventType: CricketEventType.MATCH_COMPLETED,
          sequence: 8,
          payload: {
            winnerTeamId: 2,
            margin: "Super Over",
            resultText: "Won in Super Over",
          },
          actorType: "organizer",
        }),
      );

      expect(completed.matchStatus).toBe("completed");
      expect(completed.winnerTeamId).toBe(2);
    });

    it("adapter validateBeforeAppend rejects MATCH_COMPLETED when matchStatus is not live", () => {
      const scheduledRes = cricketScoringAdapter.validateBeforeAppend!({
        tournamentId: 10,
        matchId: 100,
        eventType: CricketEventType.MATCH_COMPLETED,
        payload: {
          winnerTeamId: 1,
          margin: "10 runs",
          resultText: "Won by 10 runs",
        },
        matchStatus: "scheduled",
      });
      expect(scheduledRes.ok).toBe(false);
      if (!scheduledRes.ok) {
        expect(scheduledRes.code).toBe("MATCH_NOT_LIVE");
      }

      const completedRes = cricketScoringAdapter.validateBeforeAppend!({
        tournamentId: 10,
        matchId: 100,
        eventType: CricketEventType.MATCH_COMPLETED,
        payload: {
          winnerTeamId: 1,
          margin: "10 runs",
          resultText: "Won by 10 runs",
        },
        matchStatus: "completed",
      });
      expect(completedRes.ok).toBe(false);
      if (!completedRes.ok) {
        expect(completedRes.code).toBe("MATCH_NOT_LIVE");
      }

      const liveRes = cricketScoringAdapter.validateBeforeAppend!({
        tournamentId: 10,
        matchId: 100,
        eventType: CricketEventType.MATCH_COMPLETED,
        payload: {
          winnerTeamId: 1,
          margin: "10 runs",
          resultText: "Won by 10 runs",
        },
        matchStatus: "live",
      });
      expect(liveRes.ok).toBe(true);
    });
  });
});
