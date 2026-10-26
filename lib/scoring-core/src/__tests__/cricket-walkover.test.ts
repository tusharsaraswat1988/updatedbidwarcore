import { describe, expect, it } from "vitest";
import {
  CricketEventType,
  createInitialCricketState,
  reduceCricket,
  InvalidEventPayloadError,
  cricketScoringAdapter,
  buildStandingsFromMatches,
  buildCricketScorecardFromEvents,
  type ScoringEventEnvelope,
  type MatchMeta,
} from "../index";

function makeMeta(overrides?: Partial<MatchMeta>): MatchMeta {
  return {
    matchId: 101,
    tournamentId: 1,
    homeTeamId: 10,
    awayTeamId: 20,
    oversLimit: 20,
    maxWickets: 10,
    ...overrides,
  };
}

function makeEnv(
  eventType: string,
  payload: Record<string, unknown>,
  sequence = 1,
): ScoringEventEnvelope {
  return {
    matchId: 101,
    tournamentId: 1,
    sportSlug: "cricket",
    eventType,
    eventVersion: 1,
    sequence,
    actorType: "admin",
    payload,
  };
}

describe("Cricket Walkover Support", () => {
  describe("1. Reducer Walkover from Scheduled State (Pre-Toss)", () => {
    it("awards walkover to Home Team before toss", () => {
      const meta = makeMeta();
      const state = createInitialCricketState(meta);

      const event = makeEnv(CricketEventType.WALKOVER_AWARDED, {
        winnerTeamId: 10,
        reason: "Away team forfeited / no show",
      });

      const next = reduceCricket(state, event, { enforceLiveRules: true });

      expect(next.matchStatus).toBe("walkover");
      expect(next.sessionStatus).toBe("idle");
      expect(next.winnerTeamId).toBe(10);
      expect(next.resultText).toBe("Won by Walkover (Away team forfeited / no show)");
      expect(next.innings).toHaveLength(0);
    });

    it("awards walkover to Away Team before toss without a reason string", () => {
      const meta = makeMeta();
      const state = createInitialCricketState(meta);

      const event = makeEnv(CricketEventType.WALKOVER_AWARDED, {
        winnerTeamId: 20,
      });

      const next = reduceCricket(state, event, { enforceLiveRules: true });

      expect(next.matchStatus).toBe("walkover");
      expect(next.sessionStatus).toBe("idle");
      expect(next.winnerTeamId).toBe(20);
      expect(next.resultText).toBe("Won by Walkover");
      expect(next.innings).toHaveLength(0);
    });
  });

  describe("2. Reducer Walkover from Live / In-Progress State", () => {
    it("awards walkover midway through the first innings and marks in-progress innings as completed", () => {
      const meta = makeMeta();
      let state = createInitialCricketState(meta);

      // Start match
      state = reduceCricket(
        state,
        makeEnv(CricketEventType.MATCH_STARTED, {
          tossWinnerTeamId: 10,
          electedTo: "bat",
          oversLimit: 20,
        }, 1),
        { enforceLiveRules: true },
      );

      // Set lineups
      state = reduceCricket(
        state,
        makeEnv(CricketEventType.LINEUP_SET, {
          teamId: 10,
          playerIds: [101, 102, 103],
        }, 2),
        { enforceLiveRules: true },
      );
      state = reduceCricket(
        state,
        makeEnv(CricketEventType.LINEUP_SET, {
          teamId: 20,
          playerIds: [201, 202, 203],
        }, 3),
        { enforceLiveRules: true },
      );

      // Record a ball
      state = reduceCricket(
        state,
        makeEnv(CricketEventType.BALL_RECORDED, {
          innings: 1,
          over: 0,
          ball: 1,
          strikerId: 101,
          nonStrikerId: 102,
          bowlerId: 201,
          runsOffBat: 4,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        }, 4),
        { enforceLiveRules: true },
      );

      expect(state.matchStatus).toBe("live");
      expect(state.innings[0]?.phase).toBe("in_progress");

      // Award walkover to team 20 (Away team)
      state = reduceCricket(
        state,
        makeEnv(CricketEventType.WALKOVER_AWARDED, {
          winnerTeamId: 20,
          reason: "Team 10 conceded match",
        }, 5),
        { enforceLiveRules: true },
      );

      expect(state.matchStatus).toBe("walkover");
      expect(state.sessionStatus).toBe("idle");
      expect(state.winnerTeamId).toBe(20);
      expect(state.resultText).toBe("Won by Walkover (Team 10 conceded match)");
      expect(state.innings[0]?.phase).toBe("completed");
    });

    it("awards walkover while match is paused", () => {
      const meta = makeMeta();
      let state = createInitialCricketState(meta);

      state = reduceCricket(
        state,
        makeEnv(CricketEventType.MATCH_STARTED, {
          tossWinnerTeamId: 10,
          electedTo: "bat",
          oversLimit: 20,
        }, 1),
        { enforceLiveRules: true },
      );
      state = reduceCricket(
        state,
        makeEnv(CricketEventType.MATCH_INTERRUPTED, {
          reason: "Rain delay",
        }, 2),
        { enforceLiveRules: true },
      );

      expect(state.sessionStatus).toBe("paused");

      state = reduceCricket(
        state,
        makeEnv(CricketEventType.WALKOVER_AWARDED, {
          winnerTeamId: 10,
          reason: "Opponent unable to restart",
        }, 3),
        { enforceLiveRules: true },
      );

      expect(state.matchStatus).toBe("walkover");
      expect(state.sessionStatus).toBe("idle");
      expect(state.winnerTeamId).toBe(10);
    });
  });

  describe("3. Validation & Edge Cases", () => {
    it("rejects walkover if winnerTeamId is not home or away team", () => {
      const meta = makeMeta({ homeTeamId: 10, awayTeamId: 20 });
      const state = createInitialCricketState(meta);

      expect(() => {
        reduceCricket(
          state,
          makeEnv(CricketEventType.WALKOVER_AWARDED, {
            winnerTeamId: 999,
          }),
          { enforceLiveRules: true },
        );
      }).toThrow(InvalidEventPayloadError);
    });

    it("rejects walkover if match is already completed", () => {
      const meta = makeMeta();
      let state = createInitialCricketState(meta);
      state = { ...state, matchStatus: "completed" };

      expect(() => {
        reduceCricket(
          state,
          makeEnv(CricketEventType.WALKOVER_AWARDED, {
            winnerTeamId: 10,
          }),
          { enforceLiveRules: true },
        );
      }).toThrow(InvalidEventPayloadError);
    });

    it("rejects walkover if match is already abandoned", () => {
      const meta = makeMeta();
      let state = createInitialCricketState(meta);
      state = { ...state, matchStatus: "abandoned" };

      expect(() => {
        reduceCricket(
          state,
          makeEnv(CricketEventType.WALKOVER_AWARDED, {
            winnerTeamId: 10,
          }),
          { enforceLiveRules: true },
        );
      }).toThrow(InvalidEventPayloadError);
    });

    it("rejects walkover if match is already in walkover state (duplicate)", () => {
      const meta = makeMeta();
      let state = createInitialCricketState(meta);
      state = reduceCricket(
        state,
        makeEnv(CricketEventType.WALKOVER_AWARDED, { winnerTeamId: 10 }),
        { enforceLiveRules: true },
      );

      expect(() => {
        reduceCricket(
          state,
          makeEnv(CricketEventType.WALKOVER_AWARDED, { winnerTeamId: 20 }),
          { enforceLiveRules: true },
        );
      }).toThrow(InvalidEventPayloadError);
    });

    it("rejects subsequent ball events after walkover has been awarded", () => {
      const meta = makeMeta();
      let state = createInitialCricketState(meta);

      state = reduceCricket(
        state,
        makeEnv(CricketEventType.MATCH_STARTED, {
          tossWinnerTeamId: 10,
          electedTo: "bat",
          oversLimit: 20,
        }, 1),
        { enforceLiveRules: true },
      );
      state = reduceCricket(
        state,
        makeEnv(CricketEventType.WALKOVER_AWARDED, { winnerTeamId: 10 }, 2),
        { enforceLiveRules: true },
      );

      expect(() => {
        reduceCricket(
          state,
          makeEnv(CricketEventType.BALL_RECORDED, {
            innings: 1,
            over: 0,
            ball: 1,
            strikerId: 101,
            nonStrikerId: 102,
            bowlerId: 201,
            runsOffBat: 1,
            extras: { type: null, runs: 0 },
            wicket: null,
            isLegalDelivery: true,
          }, 3),
          { enforceLiveRules: true },
        );
      }).toThrow(InvalidEventPayloadError);
    });
  });

  describe("4. Adapter Validation and Projection", () => {
    it("CricketScoringAdapter projects walkover match to terminal status with winner and result text", () => {
      const adapter = cricketScoringAdapter;
      const meta = makeMeta();

      const event = makeEnv(CricketEventType.WALKOVER_AWARDED, {
        winnerTeamId: 10,
        reason: "Forfeit",
      });

      const state = adapter.replay(meta, [event]);
      const projected = adapter.projectMatchFromState(state);

      expect(projected.matchStatus).toBe("walkover");
      expect(projected.winnerTeamId).toBe(10);
      expect(projected.resultSummary).toBe("Won by Walkover (Forfeit)");
    });

    it("CricketScoringAdapter validateBeforeAppend rejects appending events after walkover", () => {
      const adapter = cricketScoringAdapter;
      const meta = makeMeta();

      const state = adapter.replay(meta, [
        makeEnv(CricketEventType.WALKOVER_AWARDED, { winnerTeamId: 10 }, 1),
      ]);

      const nextEvent = makeEnv(CricketEventType.MATCH_ABANDONED, { reason: "test" }, 2);
      const validation = adapter.validateBeforeAppend({
        tournamentId: 1,
        matchId: 101,
        eventType: nextEvent.eventType,
        payload: nextEvent.payload,
        matchStatus: state.matchStatus,
      });

      expect(validation.ok).toBe(false);
      if (!validation.ok) {
        expect(validation.code).toBe("MATCH_CLOSED");
      }
    });
  });

  describe("5. Deterministic Event Replay", () => {
    it("replays full event stream to exact same terminal walkover state", () => {
      const meta = makeMeta();
      const events: ScoringEventEnvelope[] = [
        makeEnv(CricketEventType.MATCH_STARTED, {
          tossWinnerTeamId: 10,
          electedTo: "bat",
          oversLimit: 20,
        }, 1),
        makeEnv(CricketEventType.LINEUP_SET, {
          teamId: 10,
          playerIds: [101, 102, 103],
        }, 2),
        makeEnv(CricketEventType.LINEUP_SET, {
          teamId: 20,
          playerIds: [201, 202, 203],
        }, 3),
        makeEnv(CricketEventType.BALL_RECORDED, {
          innings: 1,
          over: 0,
          ball: 1,
          strikerId: 101,
          nonStrikerId: 102,
          bowlerId: 201,
          runsOffBat: 6,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        }, 4),
        makeEnv(CricketEventType.WALKOVER_AWARDED, {
          winnerTeamId: 20,
          reason: "Opposition abandoned ground",
        }, 5),
      ];

      let state = createInitialCricketState(meta);
      for (const ev of events) {
        state = reduceCricket(state, ev, { enforceLiveRules: true });
      }

      expect(state.matchStatus).toBe("walkover");
      expect(state.winnerTeamId).toBe(20);
      expect(state.resultText).toBe("Won by Walkover (Opposition abandoned ground)");
      expect(state.lastSequence).toBe(5);
    });
  });

  describe("6. Scorecard Generation for Walkover Matches", () => {
    it("builds empty scorecard for pre-toss walkover without fake statistics", () => {
      const event = makeEnv(CricketEventType.WALKOVER_AWARDED, { winnerTeamId: 10 });
      const scorecard = buildCricketScorecardFromEvents(101, [event], { homeTeamId: 10, awayTeamId: 20 });

      expect(scorecard.innings).toHaveLength(0);
    });
  });

  describe("7. Standings and Net Run Rate (NRR) Invariants", () => {
    it("awards 2 points to winner, 0 points to loser, +1 played, and exactly 0 NRR change", () => {
      const standings = buildStandingsFromMatches(
        [10, 20],
        [
          {
            matchId: 101,
            status: "walkover",
            homeTeamId: 10,
            awayTeamId: 20,
            summary: {
              homeTeamId: 10,
              awayTeamId: 20,
              winnerTeamId: 10,
              resultText: "Won by Walkover",
              matchStatus: "walkover",
              oversLimit: 20,
              currentInnings: 1,
              innings: [],
            },
          },
        ],
      );

      const winnerRow = standings.find((r) => r.teamId === 10)!;
      const loserRow = standings.find((r) => r.teamId === 20)!;

      expect(winnerRow).toBeDefined();
      expect(loserRow).toBeDefined();

      // Played & Results
      expect(winnerRow.played).toBe(1);
      expect(winnerRow.won).toBe(1);
      expect(winnerRow.lost).toBe(0);
      expect(winnerRow.tied).toBe(0);
      expect(winnerRow.noResult).toBe(0);
      expect(winnerRow.points).toBe(2);

      expect(loserRow.played).toBe(1);
      expect(loserRow.won).toBe(0);
      expect(loserRow.lost).toBe(1);
      expect(loserRow.tied).toBe(0);
      expect(loserRow.noResult).toBe(0);
      expect(loserRow.points).toBe(0);

      // NRR & Stats must remain exactly 0
      expect(winnerRow.runsScored).toBe(0);
      expect(winnerRow.oversFaced).toBe(0);
      expect(winnerRow.runsConceded).toBe(0);
      expect(winnerRow.oversBowled).toBe(0);
      expect(winnerRow.netRunRate).toBe(0);

      expect(loserRow.runsScored).toBe(0);
      expect(loserRow.oversFaced).toBe(0);
      expect(loserRow.runsConceded).toBe(0);
      expect(loserRow.oversBowled).toBe(0);
      expect(loserRow.netRunRate).toBe(0);
    });

    it("maintains accurate standings in a multi-match tournament with mixed normal, abandoned, and walkover matches", () => {
      // Team 1 plays Team 2: Normal match, Team 1 wins
      // Team 2 plays Team 3: Walkover awarded to Team 3
      // Team 1 plays Team 3: Abandoned (no result)
      const standings = buildStandingsFromMatches(
        [1, 2, 3],
        [
          {
            matchId: 1,
            status: "completed",
            homeTeamId: 1,
            awayTeamId: 2,
            summary: {
              homeTeamId: 1,
              awayTeamId: 2,
              winnerTeamId: 1,
              resultText: "Team 1 won by 50 runs",
              matchStatus: "completed",
              oversLimit: 20,
              currentInnings: 2,
              innings: [
                { innings: 1, battingTeamId: 1, bowlingTeamId: 2, runs: 180, wickets: 4, overs: "20.0", phase: "completed" },
                { innings: 2, battingTeamId: 2, bowlingTeamId: 1, runs: 130, wickets: 8, overs: "20.0", phase: "completed" },
              ],
            },
          },
          {
            matchId: 2,
            status: "walkover",
            homeTeamId: 2,
            awayTeamId: 3,
            summary: {
              homeTeamId: 2,
              awayTeamId: 3,
              winnerTeamId: 3,
              resultText: "Won by Walkover",
              matchStatus: "walkover",
              oversLimit: 20,
              currentInnings: 1,
              innings: [],
            },
          },
          {
            matchId: 3,
            status: "abandoned",
            homeTeamId: 1,
            awayTeamId: 3,
            summary: {
              homeTeamId: 1,
              awayTeamId: 3,
              winnerTeamId: null,
              resultText: "Match Abandoned",
              matchStatus: "abandoned",
              oversLimit: 20,
              currentInnings: 1,
              innings: [],
            },
          },
        ],
      );

      const t1 = standings.find((r) => r.teamId === 1)!;
      const t2 = standings.find((r) => r.teamId === 2)!;
      const t3 = standings.find((r) => r.teamId === 3)!;

      // Team 1: 1 win (2pts) + 1 abandoned (1pt) = 3pts, positive NRR
      expect(t1.played).toBe(2);
      expect(t1.won).toBe(1);
      expect(t1.noResult).toBe(1);
      expect(t1.points).toBe(3);
      expect(t1.netRunRate).toBeGreaterThan(0);

      // Team 3: 1 walkover win (2pts) + 1 abandoned (1pt) = 3pts, 0 NRR
      expect(t3.played).toBe(2);
      expect(t3.won).toBe(1);
      expect(t3.noResult).toBe(1);
      expect(t3.points).toBe(3);
      expect(t3.netRunRate).toBe(0);

      // Team 2: 1 normal loss (0pts) + 1 walkover loss (0pts) = 0pts
      expect(t2.played).toBe(2);
      expect(t2.lost).toBe(2);
      expect(t2.points).toBe(0);
      expect(t2.netRunRate).toBeLessThan(0);
    });
  });
});
