import { describe, expect, it } from "vitest";
import {
  createInitialCricketState,
  createEventEnvelope,
  CricketEventType,
  reduceCricket,
  replayCricketEvents,
  expectedNextBall,
  assertExpectedSequence,
  SequenceConflictError,
  InvalidEventPayloadError,
  type MatchMeta,
  type CricketScoreboardState,
  type ScoringEventEnvelope,
} from "../index";

const matchMeta: MatchMeta = {
  matchId: 100,
  tournamentId: 10,
  homeTeamId: 1,
  awayTeamId: 2,
  oversLimit: 5,
};

function startMatch(options: { oversLimit?: number } = {}): CricketScoreboardState {
  const oversLimit = options.oversLimit ?? 5;
  let state = reduceCricket(
    createInitialCricketState({ ...matchMeta, oversLimit }),
    createEventEnvelope({
      matchId: 100,
      tournamentId: 10,
      sportSlug: "cricket",
      eventType: CricketEventType.MATCH_STARTED,
      sequence: 1,
      payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit },
      actorType: "organizer",
    }),
    { enforceLiveRules: true },
  );

  state = reduceCricket(
    state,
    createEventEnvelope({
      matchId: 100,
      tournamentId: 10,
      sportSlug: "cricket",
      eventType: CricketEventType.LINEUP_SET,
      sequence: 2,
      payload: { teamId: 1, playerIds: [101, 102, 103, 104, 105], battingOrder: [101, 102, 103] },
      actorType: "organizer",
    }),
    { enforceLiveRules: true },
  );

  state = reduceCricket(
    state,
    createEventEnvelope({
      matchId: 100,
      tournamentId: 10,
      sportSlug: "cricket",
      eventType: CricketEventType.LINEUP_SET,
      sequence: 3,
      payload: { teamId: 2, playerIds: [201, 202, 203] },
      actorType: "organizer",
    }),
    { enforceLiveRules: true },
  );

  return state;
}

function ball(
  seq: number,
  overrides: Partial<{
    innings: number;
    over: number;
    ball: number;
    strikerId: number;
    nonStrikerId: number | null;
    bowlerId: number;
    runsOffBat: number;
    extras: { type: "wide" | "no_ball" | "bye" | "leg_bye" | "penalty" | null; runs: number };
    wicket: { type: "bowled" | "caught" | "lbw" | "run_out" | "stumped"; dismissedPlayerId: number } | null;
    isLegalDelivery: boolean;
  }> = {},
): ScoringEventEnvelope {
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
      nonStrikerId: overrides.nonStrikerId !== undefined ? overrides.nonStrikerId : 102,
      bowlerId: overrides.bowlerId ?? 201,
      runsOffBat: overrides.runsOffBat ?? 0,
      extras: overrides.extras ?? { type: null, runs: 0 },
      wicket: overrides.wicket ?? null,
      isLegalDelivery: overrides.isLegalDelivery ?? true,
    },
    actorType: "scorer",
  });
}

describe("Server-Authoritative Cricket Ball & Over Sequencing (P0 Fix #3)", () => {
  it("A. Sequential legal balls: 0.1 → 0.2 → 0.3 → 0.4 → 0.5 → 0.6", () => {
    let state = startMatch();

    for (let b = 1; b <= 6; b++) {
      const expected = expectedNextBall(state.innings[0]!);
      expect(expected).toEqual({ over: 0, ball: b });

      state = reduceCricket(
        state,
        ball(3 + b, { over: 0, ball: b, runsOffBat: 1, isLegalDelivery: true }),
        { enforceLiveRules: true },
      );
      expect(state.innings[0]?.over).toBe(0);
      expect(state.innings[0]?.ball).toBe(b);
    }

    // After 6 legal balls: over 0 is complete, next expected delivery is over 1, ball 1
    const nextExpected = expectedNextBall(state.innings[0]!);
    expect(nextExpected).toEqual({ over: 1, ball: 1 });
  });

  it("B. Invalid jump: after 0.2, client submits 0.4 → deterministic rejection", () => {
    let state = startMatch();
    state = reduceCricket(state, ball(4, { over: 0, ball: 1, isLegalDelivery: true }), { enforceLiveRules: true });
    state = reduceCricket(state, ball(5, { over: 0, ball: 2, isLegalDelivery: true }), { enforceLiveRules: true });

    // Client jumps to 0.4
    expect(() =>
      reduceCricket(state, ball(6, { over: 0, ball: 4, isLegalDelivery: true }), { enforceLiveRules: true }),
    ).toThrow(InvalidEventPayloadError);

    expect(() =>
      reduceCricket(state, ball(6, { over: 0, ball: 4, isLegalDelivery: true }), { enforceLiveRules: true }),
    ).toThrow(/invalid delivery sequence: expected over 0 ball 3, received over 0 ball 4/);

    // State is preserved and expecting 0.3
    expect(state.innings[0]?.ball).toBe(2);
  });

  it("C. Invalid duplicate: after 0.2, client submits 0.2 again → deterministic rejection", () => {
    let state = startMatch();
    state = reduceCricket(state, ball(4, { over: 0, ball: 1, isLegalDelivery: true }), { enforceLiveRules: true });
    state = reduceCricket(state, ball(5, { over: 0, ball: 2, isLegalDelivery: true }), { enforceLiveRules: true });

    // Client submits duplicate 0.2
    expect(() =>
      reduceCricket(state, ball(6, { over: 0, ball: 2, isLegalDelivery: true }), { enforceLiveRules: true }),
    ).toThrow(InvalidEventPayloadError);

    expect(() =>
      reduceCricket(state, ball(6, { over: 0, ball: 2, isLegalDelivery: true }), { enforceLiveRules: true }),
    ).toThrow(/invalid delivery sequence: expected over 0 ball 3, received over 0 ball 2/);
  });

  it("D. Wide does not consume legal ball: 0.1 → wide → 0.2", () => {
    let state = startMatch();
    // 0.1 legal
    state = reduceCricket(state, ball(4, { over: 0, ball: 1, isLegalDelivery: true }), { enforceLiveRules: true });
    expect(state.innings[0]?.ball).toBe(1);

    // Wide at upcoming slot (0.2)
    state = reduceCricket(
      state,
      ball(5, { over: 0, ball: 2, extras: { type: "wide", runs: 1 }, isLegalDelivery: false }),
      { enforceLiveRules: true },
    );
    // Legal balls still 1!
    expect(state.innings[0]?.ball).toBe(1);
    expect(expectedNextBall(state.innings[0]!)).toEqual({ over: 0, ball: 2 });

    // Next legal ball is 0.2 (NOT 0.3!)
    state = reduceCricket(state, ball(6, { over: 0, ball: 2, isLegalDelivery: true }), { enforceLiveRules: true });
    expect(state.innings[0]?.ball).toBe(2);
  });

  it("E. No-ball does not consume legal ball: 0.1 → no-ball → 0.2", () => {
    let state = startMatch();
    // 0.1 legal
    state = reduceCricket(state, ball(4, { over: 0, ball: 1, isLegalDelivery: true }), { enforceLiveRules: true });
    expect(state.innings[0]?.ball).toBe(1);

    // No-ball at upcoming slot (0.2)
    state = reduceCricket(
      state,
      ball(5, { over: 0, ball: 2, extras: { type: "no_ball", runs: 1 }, isLegalDelivery: false }),
      { enforceLiveRules: true },
    );
    expect(state.innings[0]?.ball).toBe(1);
    expect(state.freeHitActive).toBe(true);

    // Next legal delivery is still 0.2
    state = reduceCricket(state, ball(6, { over: 0, ball: 2, isLegalDelivery: true }), { enforceLiveRules: true });
    expect(state.innings[0]?.ball).toBe(2);
    expect(state.freeHitActive).toBe(false);
  });

  it("F. Multiple illegal deliveries: 0.1 → wide → wide → no-ball → 0.2", () => {
    let state = startMatch();
    // 0.1 legal
    state = reduceCricket(state, ball(4, { over: 0, ball: 1, isLegalDelivery: true }), { enforceLiveRules: true });

    // 3 illegal deliveries at slot 0.2
    state = reduceCricket(
      state,
      ball(5, { over: 0, ball: 2, extras: { type: "wide", runs: 1 }, isLegalDelivery: false }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      ball(6, { over: 0, ball: 2, extras: { type: "wide", runs: 1 }, isLegalDelivery: false }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      ball(7, { over: 0, ball: 2, extras: { type: "no_ball", runs: 1 }, isLegalDelivery: false }),
      { enforceLiveRules: true },
    );

    // All 3 occurred, but legal ball count is still 1
    expect(state.innings[0]?.ball).toBe(1);
    expect(expectedNextBall(state.innings[0]!)).toEqual({ over: 0, ball: 2 });

    // 0.2 legal finally completes slot 2
    state = reduceCricket(state, ball(8, { over: 0, ball: 2, isLegalDelivery: true }), { enforceLiveRules: true });
    expect(state.innings[0]?.ball).toBe(2);
  });

  it("G. Over transition: 0.6 → 1.1 with strike rotation", () => {
    let state = startMatch();
    // Bowl 6 dot balls in over 0: 101 on strike, 102 non-striker
    for (let b = 1; b <= 6; b++) {
      state = reduceCricket(
        state,
        ball(3 + b, { over: 0, ball: b, strikerId: 101, nonStrikerId: 102, runsOffBat: 0, isLegalDelivery: true }),
        { enforceLiveRules: true },
      );
    }
    expect(state.innings[0]?.over).toBe(0);
    expect(state.innings[0]?.ball).toBe(6);

    // Strike rotates at end of over: 102 is now on strike!
    expect(state.strikerId).toBe(102);
    expect(state.nonStrikerId).toBe(101);

    // Over 1 begins at over 1, ball 1
    state = reduceCricket(
      state,
      ball(10, { over: 1, ball: 1, strikerId: 102, nonStrikerId: 101, bowlerId: 202, isLegalDelivery: true }),
      { enforceLiveRules: true },
    );
    expect(state.innings[0]?.over).toBe(1);
    expect(state.innings[0]?.ball).toBe(1);
  });

  it("H. Illegal delivery after 6th legal ball cannot create 7th legal delivery in over 0", () => {
    let state = startMatch();
    for (let b = 1; b <= 6; b++) {
      state = reduceCricket(
        state,
        ball(3 + b, { over: 0, ball: b, runsOffBat: 0, isLegalDelivery: true }),
        { enforceLiveRules: true },
      );
    }

    // Attempting an illegal or legal delivery claiming over 0 ball 6 or ball 7 must fail
    expect(() =>
      reduceCricket(
        state,
        ball(10, { over: 0, ball: 6, extras: { type: "wide", runs: 1 }, isLegalDelivery: false }),
        { enforceLiveRules: true },
      ),
    ).toThrow(InvalidEventPayloadError);

    // Valid illegal delivery after 0.6 belongs to over 1, ball 1
    state = reduceCricket(
      state,
      ball(10, { over: 1, ball: 1, extras: { type: "wide", runs: 1 }, isLegalDelivery: false }),
      { enforceLiveRules: true },
    );
    // Legal balls in over 0 remain 6, over 1 has 0 legal balls
    expect(state.innings[0]?.over).toBe(0);
    expect(state.innings[0]?.ball).toBe(6);
    expect(expectedNextBall(state.innings[0]!)).toEqual({ over: 1, ball: 1 });
  });

  it("I. Wicket sequence: legal ball + wicket → requires new batter → continues valid sequence", () => {
    let state = startMatch();
    // 0.1: dot ball
    state = reduceCricket(state, ball(4, { over: 0, ball: 1, isLegalDelivery: true }), { enforceLiveRules: true });

    // 0.2: wicket (striker 101 bowled)
    state = reduceCricket(
      state,
      ball(5, {
        over: 0,
        ball: 2,
        strikerId: 101,
        nonStrikerId: 102,
        wicket: { type: "bowled", dismissedPlayerId: 101 },
        isLegalDelivery: true,
      }),
      { enforceLiveRules: true },
    );
    expect(state.innings[0]?.wickets).toBe(1);
    expect(state.strikerId).toBeNull(); // Dismissed striker is cleared

    // Attempting next delivery by moving non-striker 102 to striker without selecting new striker is rejected
    expect(() =>
      reduceCricket(
        state,
        ball(6, { over: 0, ball: 3, strikerId: 102, nonStrikerId: 103, isLegalDelivery: true }),
        { enforceLiveRules: true },
      ),
    ).toThrow(/select a new batter before recording balls/);

    // Submitting 0.3 with new batter 103 succeeds
    state = reduceCricket(
      state,
      ball(6, { over: 0, ball: 3, strikerId: 103, nonStrikerId: 102, isLegalDelivery: true }),
      { enforceLiveRules: true },
    );
    expect(state.innings[0]?.ball).toBe(3);
    expect(state.strikerId).toBe(103);
  });

  it("J. Innings transition: completed innings rejects balls; 2nd innings starts fresh at 0.1", () => {
    let state = startMatch({ oversLimit: 1 });
    // Complete 1 over match (6 balls)
    for (let b = 1; b <= 6; b++) {
      state = reduceCricket(
        state,
        ball(3 + b, { over: 0, ball: b, runsOffBat: 1, isLegalDelivery: true }),
        { enforceLiveRules: true },
      );
    }

    // Try bowling ball 7 in 1-over innings → rejected (overs limit complete)
    expect(() =>
      reduceCricket(
        state,
        ball(10, { over: 1, ball: 1, isLegalDelivery: true }),
        { enforceLiveRules: true },
      ),
    ).toThrow(/overs limit \(1\) already complete/);

    // End innings 1
    state = reduceCricket(
      state,
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.INNINGS_ENDED,
        sequence: 10,
        payload: { innings: 1, reason: "overs_complete", runs: 6, wickets: 0, overs: "1.0" },
        actorType: "scorer",
      }),
      { enforceLiveRules: true },
    );

    // Innings 1 is completed. Attempting to record balls to innings 1 is rejected
    expect(() =>
      reduceCricket(
        state,
        ball(11, { innings: 1, over: 0, ball: 1, isLegalDelivery: true }),
        { enforceLiveRules: true },
      ),
    ).toThrow(/does not match current 2/);

    // Set lineup for team 2 (now batting)
    state = reduceCricket(
      state,
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.LINEUP_SET,
        sequence: 11,
        payload: { teamId: 2, playerIds: [201, 202, 203], battingOrder: [201, 202] },
        actorType: "organizer",
      }),
      { enforceLiveRules: true },
    );

    // Innings 2 starts completely fresh at over 0, ball 1
    expect(state.currentInnings).toBe(2);
    expect(state.innings[1]?.over).toBe(0);
    expect(state.innings[1]?.ball).toBe(0);
    expect(expectedNextBall(state.innings[1]!)).toEqual({ over: 0, ball: 1 });

    // Attempting to submit innings 2 starting at ball 2 is rejected
    expect(() =>
      reduceCricket(
        state,
        ball(12, { innings: 2, over: 0, ball: 2, strikerId: 201, nonStrikerId: 202, bowlerId: 101, isLegalDelivery: true }),
        { enforceLiveRules: true },
      ),
    ).toThrow(/expected over 0 ball 1, received over 0 ball 2/);

    // Correct first delivery of innings 2 succeeds
    state = reduceCricket(
      state,
      ball(12, { innings: 2, over: 0, ball: 1, strikerId: 201, nonStrikerId: 202, bowlerId: 101, isLegalDelivery: true }),
      { enforceLiveRules: true },
    );
    expect(state.innings[1]?.over).toBe(0);
    expect(state.innings[1]?.ball).toBe(1);
  });

  it("K. Concurrent append: optimistic sequence conflict rejection", () => {
    // Current committed sequence is 5.
    // Client A submits with expectedSequence: 5 → succeeds.
    // Client B concurrently submits with expectedSequence: 5 → rejected!
    expect(() => assertExpectedSequence(5, 5)).not.toThrow();
    expect(() => assertExpectedSequence(5, 6)).toThrow(SequenceConflictError);
  });

  it("L. Replay determinism: replaying event stream matches sequential live reduction", () => {
    const events: ScoringEventEnvelope[] = [
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 5 },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.LINEUP_SET,
        sequence: 2,
        payload: { teamId: 1, playerIds: [101, 102, 103], battingOrder: [101, 102] },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.LINEUP_SET,
        sequence: 3,
        payload: { teamId: 2, playerIds: [201, 202] },
        actorType: "organizer",
      }),
      ball(4, { over: 0, ball: 1, runsOffBat: 1, isLegalDelivery: true }),
      ball(5, { over: 0, ball: 2, extras: { type: "wide", runs: 1 }, isLegalDelivery: false }),
      ball(6, { over: 0, ball: 2, runsOffBat: 4, strikerId: 102, nonStrikerId: 101, isLegalDelivery: true }),
      ball(7, {
        over: 0,
        ball: 3,
        strikerId: 102,
        nonStrikerId: 101,
        wicket: { type: "bowled", dismissedPlayerId: 102 },
        isLegalDelivery: true,
      }),
    ];

    const replayed = replayCricketEvents(matchMeta, events);
    expect(replayed.innings[0]?.runs).toBe(6); // 1 + 1(wd) + 4 = 6
    expect(replayed.innings[0]?.wickets).toBe(1);
    expect(replayed.innings[0]?.over).toBe(0);
    expect(replayed.innings[0]?.ball).toBe(3);
  });

  it("M. Client tampering: deliberately incorrect over/ball position is rejected", () => {
    const state = startMatch();

    // Tampered over: claims over 1 on first ball
    expect(() =>
      reduceCricket(state, ball(4, { over: 1, ball: 1, isLegalDelivery: true }), { enforceLiveRules: true }),
    ).toThrow(/invalid delivery sequence: expected over 0 ball 1, received over 1 ball 1/);

    // Tampered ball: claims ball 3 on first ball
    expect(() =>
      reduceCricket(state, ball(4, { over: 0, ball: 3, isLegalDelivery: true }), { enforceLiveRules: true }),
    ).toThrow(/invalid delivery sequence: expected over 0 ball 1, received over 0 ball 3/);
  });
});
