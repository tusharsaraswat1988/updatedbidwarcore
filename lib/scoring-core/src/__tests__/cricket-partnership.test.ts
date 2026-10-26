import { describe, it, expect } from "vitest";
import {
  CricketEventType,
  createInitialCricketState,
  reduceCricket,
  buildCricketScorecardFromEvents,
  expectedNextBall,
  isOversComplete,
  oversFromBalls,
  economy,
  oversStringToDecimal,
  type CricketBallRecordedPayload,
  type ScoringEventEnvelope,
} from "../index";

function makeEnvelope(
  eventType: string,
  sequence: number,
  payload: Record<string, unknown>,
): ScoringEventEnvelope {
  return {
    matchId: 1,
    tournamentId: 10,
    sportSlug: "cricket",
    eventType,
    eventVersion: 1,
    sequence,
    actorType: "scorer_pin",
    payload,
  };
}

describe("P1-1 & P1-2: Cricket Partnership & Balls Per Over Correctness", () => {
  it("authoritatively computes current partnership across wickets (Prompt Acceptance Case)", () => {
    // Setup match: Team 1 bats first vs Team 2
    let state = createInitialCricketState({
      matchId: 1,
      tournamentId: 10,
      homeTeamId: 1,
      awayTeamId: 2,
      oversLimit: 20,
    });

    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.MATCH_STARTED, 1, {
        innings: 1,
        oversLimit: 20,
        tossWinnerTeamId: 1,
        electedTo: "bat",
      }),
    );

    // Select openers: Batter A (101) and Batter B (102)
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BATTER_SELECTED, 2, {
        innings: 1,
        playerId: 101,
        position: "striker",
      }),
    );
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BATTER_SELECTED, 3, {
        innings: 1,
        playerId: 102,
        position: "non_striker",
      }),
    );
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BOWLER_CHANGED, 4, {
        innings: 1,
        bowlerId: 201,
      }),
    );

    expect(state.currentPartnership).toBeDefined();
    expect(state.currentPartnership?.runs).toBe(0);
    expect(state.currentPartnership?.balls).toBe(0);

    // Batter A scores 20 runs (5 boundaries of 4 runs each)
    let seq = 5;
    for (let b = 1; b <= 5; b++) {
      state = reduceCricket(
        state,
        makeEnvelope(CricketEventType.BALL_RECORDED, seq++, {
          innings: 1,
          over: 0,
          ball: b,
          strikerId: 101,
          nonStrikerId: 102,
          bowlerId: 201,
          runsOffBat: 4,
          extras: { type: null, runs: 0 },
          isLegalDelivery: true,
          wicket: null,
        } as CricketBallRecordedPayload),
      );
    }
    expect(state.currentPartnership?.runs).toBe(20);
    expect(state.currentPartnership?.batter1Runs).toBe(20);

    // Ball 6 of Over 0: Batter A takes a single -> strike rotates to Batter B, over ends -> strike stays with B
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BALL_RECORDED, seq++, {
        innings: 1,
        over: 0,
        ball: 6,
        strikerId: 101,
        nonStrikerId: 102,
        bowlerId: 201,
        runsOffBat: 1,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: null,
      } as CricketBallRecordedPayload),
    );
    // Batter A has 21, stand is 21
    expect(state.currentPartnership?.runs).toBe(21);
    expect(state.strikerId).toBe(101); // A rotated on single, rotated back on over completion -> A on strike

    // Rotate strike to B with single on 1.1
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BALL_RECORDED, seq++, {
        innings: 1,
        over: 1,
        ball: 1,
        strikerId: 101,
        nonStrikerId: 102,
        bowlerId: 202,
        runsOffBat: 1,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: null,
      } as CricketBallRecordedPayload),
    );
    expect(state.strikerId).toBe(102);

    // Batter B scores 15 runs (say three 4s and three 1s)
    // 1.2: 4 runs to B
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BALL_RECORDED, seq++, {
        innings: 1,
        over: 1,
        ball: 2,
        strikerId: 102,
        nonStrikerId: 101,
        bowlerId: 202,
        runsOffBat: 4,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: null,
      } as CricketBallRecordedPayload),
    );
    // 1.3: 4 runs to B
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BALL_RECORDED, seq++, {
        innings: 1,
        over: 1,
        ball: 3,
        strikerId: 102,
        nonStrikerId: 101,
        bowlerId: 202,
        runsOffBat: 4,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: null,
      } as CricketBallRecordedPayload),
    );
    // 1.4: 4 runs to B
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BALL_RECORDED, seq++, {
        innings: 1,
        over: 1,
        ball: 4,
        strikerId: 102,
        nonStrikerId: 101,
        bowlerId: 202,
        runsOffBat: 4,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: null,
      } as CricketBallRecordedPayload),
    );
    // 1.5: 3 runs to B
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BALL_RECORDED, seq++, {
        innings: 1,
        over: 1,
        ball: 5,
        strikerId: 102,
        nonStrikerId: 101,
        bowlerId: 202,
        runsOffBat: 3,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: null,
      } as CricketBallRecordedPayload),
    );
    // Now B has scored 15 runs. A has scored 22 runs.
    expect(state.currentPartnership?.runs).toBe(37);
    expect(state.innings[0].runs).toBe(37);

    // 1.6: Wicket falls! Batter B is dismissed (caught)
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BALL_RECORDED, seq++, {
        innings: 1,
        over: 1,
        ball: 6,
        strikerId: 101, // 101 was non-striker after the 3
        nonStrikerId: 102,
        bowlerId: 202,
        runsOffBat: 0,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: {
          type: "caught",
          dismissedPlayerId: 102,
          fielderId: 203,
        },
      } as CricketBallRecordedPayload),
    );

    // Stand 1 must be saved to completedPartnerships
    expect(state.completedPartnerships?.length).toBe(1);
    expect(state.completedPartnerships?.[0].runs).toBe(37);
    expect(state.completedPartnerships?.[0].dismissedPlayerId).toBe(102);
    expect(state.completedPartnerships?.[0].notOutPlayerId).toBe(101);

    // Current partnership must be RESET with surviving Batter A (101)
    expect(state.currentPartnership?.runs).toBe(0);
    expect(state.currentPartnership?.balls).toBe(0);
    expect(state.currentPartnership?.batter1Id).toBe(101);
    expect(state.currentPartnership?.batter2Id).toBeNull();

    // New Batter C (103) arrives
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BATTER_SELECTED, seq++, {
        innings: 1,
        playerId: 103,
        position: "striker",
      }),
    );
    expect(state.currentPartnership?.batter2Id).toBe(103);
    expect(state.currentPartnership?.runs).toBe(0);

    // Batter A later scores 10 runs, Batter C scores 8 runs:
    // Over 2: 2.1 - 2.2: Batter C scores 8 runs (two boundaries)
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BALL_RECORDED, seq++, {
        innings: 1,
        over: 2,
        ball: 1,
        strikerId: 103,
        nonStrikerId: 101,
        bowlerId: 201,
        runsOffBat: 4,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: null,
      } as CricketBallRecordedPayload),
    );
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BALL_RECORDED, seq++, {
        innings: 1,
        over: 2,
        ball: 2,
        strikerId: 103,
        nonStrikerId: 101,
        bowlerId: 201,
        runsOffBat: 4,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: null,
      } as CricketBallRecordedPayload),
    );

    // 2.3: Single to C -> rotates to A
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BALL_RECORDED, seq++, {
        innings: 1,
        over: 2,
        ball: 3,
        strikerId: 103,
        nonStrikerId: 101,
        bowlerId: 201,
        runsOffBat: 1,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: null,
      } as CricketBallRecordedPayload),
    );

    // 2.4: Batter A scores 9 runs (6 + 3) -> 2.4 six
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BALL_RECORDED, seq++, {
        innings: 1,
        over: 2,
        ball: 4,
        strikerId: 101,
        nonStrikerId: 103,
        bowlerId: 201,
        runsOffBat: 6,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: null,
      } as CricketBallRecordedPayload),
    );
    // 2.5: 3 runs to A
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BALL_RECORDED, seq++, {
        innings: 1,
        over: 2,
        ball: 5,
        strikerId: 101,
        nonStrikerId: 103,
        bowlerId: 201,
        runsOffBat: 3,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: null,
      } as CricketBallRecordedPayload),
    );

    // 2.6: Batter C faces dot ball
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BALL_RECORDED, seq++, {
        innings: 1,
        over: 2,
        ball: 6,
        strikerId: 103,
        nonStrikerId: 101,
        bowlerId: 201,
        runsOffBat: 0,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: null,
      } as CricketBallRecordedPayload),
    );

    // In this second stand:
    // C scored 4 + 4 + 1 = 9 runs.
    // A scored 6 + 3 = 9 runs.
    // Total partnership runs must be 18 runs!
    expect(state.currentPartnership?.runs).toBe(18);
    // And NOT 31 (A total innings runs) + 9 (C total innings runs) = 40!
    expect(state.currentPartnership?.runs).not.toBe(40);
  });

  it("handles retired hurt and new incoming batter without corrupting partnership", () => {
    let state = createInitialCricketState({
      matchId: 2,
      tournamentId: 10,
      homeTeamId: 1,
      awayTeamId: 2,
      oversLimit: 20,
    });

    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.MATCH_STARTED, 1, {
        innings: 1,
        oversLimit: 20,
        tossWinnerTeamId: 1,
        electedTo: "bat",
      }),
    );
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BATTER_SELECTED, 2, {
        innings: 1,
        playerId: 101,
        position: "striker",
      }),
    );
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BATTER_SELECTED, 3, {
        innings: 1,
        playerId: 102,
        position: "non_striker",
      }),
    );

    // Batter 101 scores 12 runs
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BALL_RECORDED, 4, {
        innings: 1,
        over: 0,
        ball: 1,
        strikerId: 101,
        nonStrikerId: 102,
        bowlerId: 201,
        runsOffBat: 6,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: null,
      } as CricketBallRecordedPayload),
    );
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BALL_RECORDED, 5, {
        innings: 1,
        over: 0,
        ball: 2,
        strikerId: 101,
        nonStrikerId: 102,
        bowlerId: 201,
        runsOffBat: 6,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: null,
      } as CricketBallRecordedPayload),
    );

    expect(state.currentPartnership?.runs).toBe(12);

    // Batter 101 retires hurt
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.PLAYER_RETIRED, 6, {
        innings: 1,
        teamId: 1,
        playerId: 101,
        type: "hurt",
      }),
    );

    // Stand 1 ended at 12 runs
    expect(state.completedPartnerships?.length).toBe(1);
    expect(state.completedPartnerships?.[0].runs).toBe(12);
    expect(state.completedPartnerships?.[0].dismissedPlayerId).toBe(101);
    expect(state.completedPartnerships?.[0].notOutPlayerId).toBe(102);

    // New partnership is reset with 0 runs
    expect(state.currentPartnership?.runs).toBe(0);
    expect(state.currentPartnership?.batter1Id).toBe(102);

    // New batter 103 selected
    state = reduceCricket(
      state,
      makeEnvelope(CricketEventType.BATTER_SELECTED, 7, {
        innings: 1,
        playerId: 103,
        position: "striker",
      }),
    );
    expect(state.currentPartnership?.batter2Id).toBe(103);
  });

  it("reconciles scorecard: team total == sum(batter runs) + extras, with correct bowler wickets", () => {
    const events: ScoringEventEnvelope[] = [
      makeEnvelope(CricketEventType.MATCH_STARTED, 1, {
        tossWinnerTeamId: 1,
        electedTo: "bat",
      }),
      // Ball 1: 101 hits 4 off 201
      makeEnvelope(CricketEventType.BALL_RECORDED, 2, {
        innings: 1,
        over: 0,
        ball: 1,
        strikerId: 101,
        nonStrikerId: 102,
        bowlerId: 201,
        runsOffBat: 4,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: null,
      } as CricketBallRecordedPayload),
      // Ball 2: Wide (+1)
      makeEnvelope(CricketEventType.BALL_RECORDED, 3, {
        innings: 1,
        over: 0,
        ball: 2,
        strikerId: 101,
        nonStrikerId: 102,
        bowlerId: 201,
        runsOffBat: 0,
        extras: { type: "wide", runs: 1 },
        isLegalDelivery: false,
        wicket: null,
      } as CricketBallRecordedPayload),
      // Ball 2 (legal): 101 is bowled! (bowler credited)
      makeEnvelope(CricketEventType.BALL_RECORDED, 4, {
        innings: 1,
        over: 0,
        ball: 2,
        strikerId: 101,
        nonStrikerId: 102,
        bowlerId: 201,
        runsOffBat: 0,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: {
          type: "bowled",
          dismissedPlayerId: 101,
        },
      } as CricketBallRecordedPayload),
      // Ball 3: 103 faces ball, hits 1 and runs out non-striker 102! (bowler NOT credited)
      makeEnvelope(CricketEventType.BALL_RECORDED, 5, {
        innings: 1,
        over: 0,
        ball: 3,
        strikerId: 103,
        nonStrikerId: 102,
        bowlerId: 201,
        runsOffBat: 1,
        extras: { type: null, runs: 0 },
        isLegalDelivery: true,
        wicket: {
          type: "run_out",
          dismissedPlayerId: 102,
          fielderId: 202,
        },
      } as CricketBallRecordedPayload),
      // Ball 4: Bye (+2) - bowler not charged
      makeEnvelope(CricketEventType.BALL_RECORDED, 6, {
        innings: 1,
        over: 0,
        ball: 4,
        strikerId: 103,
        nonStrikerId: 104,
        bowlerId: 201,
        runsOffBat: 0,
        extras: { type: "bye", runs: 2 },
        isLegalDelivery: true,
        wicket: null,
      } as CricketBallRecordedPayload),
    ];

    const scorecard = buildCricketScorecardFromEvents(1, events, {
      homeTeamId: 1,
      awayTeamId: 2,
    });

    const inn = scorecard.innings[0];
    expect(inn).toBeDefined();

    // Total runs: 4 (bat) + 1 (wide) + 1 (bat) + 2 (bye) = 8 runs
    expect(inn.totalRuns).toBe(8);

    // Reconcile: totalRuns == sum(batter.runs) + extras.total
    const sumBatterRuns = inn.batting.reduce((acc, b) => acc + b.runs, 0);
    expect(sumBatterRuns).toBe(5); // 4 (101) + 1 (103)
    expect(inn.extras.total).toBe(3); // 1 wide + 2 bye
    expect(inn.totalRuns).toBe(sumBatterRuns + inn.extras.total);

    // Bowler runs conceded: 4 (bat) + 1 (wide) + 1 (bat) = 6 runs. (Bye is NOT charged to bowler)
    const bowler = inn.bowling.find((b) => b.playerId === 201);
    expect(bowler?.runs).toBe(6);

    // Bowler wickets: bowled counts (+1), run_out does NOT (+0) -> exactly 1 wicket!
    expect(bowler?.wickets).toBe(1);

    // Total wickets in innings: 2
    expect(inn.totalWickets).toBe(2);

    // Partnerships in scorecard: 2 completed stands
    expect(inn.partnerships.length).toBeGreaterThanOrEqual(2);
    // Stand 1: 101 & 102 = 5 runs (4 bat + 1 wide)
    expect(inn.partnerships[0].runs).toBe(5);
    expect(inn.partnerships[0].wicket).toBe(1);
  });

  it("supports configurable ballsPerOver across ball sequence, overs completion and economy", () => {
    // 5-ball over format (The Hundred style)
    const innState = {
      innings: 1,
      battingTeamId: 1,
      bowlingTeamId: 2,
      runs: 10,
      wickets: 0,
      over: 0,
      ball: 4,
      phase: "in_progress" as const,
      kind: "normal" as const,
      oversLimit: 4,
    };

    // At ball 4 of 5: next ball is over 0 ball 5
    expect(expectedNextBall(innState, 5)).toEqual({ over: 0, ball: 5 });

    // At ball 5 of 5: next ball is over 1 ball 1
    const overCompleteState = { ...innState, ball: 5 };
    expect(expectedNextBall(overCompleteState, 5)).toEqual({ over: 1, ball: 1 });

    // isOversComplete at 4 overs (5 balls each)
    const lastOverState = { ...innState, over: 3, ball: 5 };
    expect(isOversComplete(lastOverState, 4, 5)).toBe(true);

    // Economy calculation with 5-ball over: 20 runs in 10 balls (2.0 overs) = 10.00
    expect(economy(20, 10, 5)).toBe(10);
    // Economy with 6-ball over: 20 runs in 10 balls (1.4 overs = 1.666) = 12.00
    expect(economy(20, 10, 6)).toBe(12);

    // oversFromBalls with 5-ball over: 12 balls = 2 overs and 2 balls = "2.2"
    expect(oversFromBalls(12, 5)).toBe("2.2");
    // oversStringToDecimal with 5-ball over: "2.2" = 2 + 2/5 = 2.4
    expect(oversStringToDecimal("2.2", 5)).toBe(2.4);
  });
});
