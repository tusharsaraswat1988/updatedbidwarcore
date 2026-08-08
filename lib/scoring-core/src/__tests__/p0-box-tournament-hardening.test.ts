import { describe, expect, it } from "vitest";
import {
  CricketEventType,
  createEventEnvelope,
  createInitialCricketState,
  deriveCricketMatchResult,
  reduceCricket,
  shouldSwapStrike,
  strikeRotatingRuns,
} from "../index";

const matchMeta = {
  matchId: 100,
  tournamentId: 10,
  homeTeamId: 1,
  awayTeamId: 2,
  oversLimit: 6,
  maxWickets: 10,
};

function startedWithOpeners() {
  let state = reduceCricket(
    createInitialCricketState(matchMeta),
    createEventEnvelope({
      matchId: 100,
      tournamentId: 10,
      sportSlug: "cricket",
      eventType: CricketEventType.MATCH_STARTED,
      sequence: 1,
      payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 6 },
      actorType: "organizer",
    }),
  );
  state = reduceCricket(
    state,
    createEventEnvelope({
      matchId: 100,
      tournamentId: 10,
      sportSlug: "cricket",
      eventType: CricketEventType.LINEUP_SET,
      sequence: 2,
      payload: { teamId: 1, playerIds: [101, 102, 103, 104], battingOrder: [101, 102] },
      actorType: "organizer",
    }),
  );
  return reduceCricket(
    state,
    createEventEnvelope({
      matchId: 100,
      tournamentId: 10,
      sportSlug: "cricket",
      eventType: CricketEventType.LINEUP_SET,
      sequence: 3,
      payload: { teamId: 2, playerIds: [201, 202] },
      actorType: "organizer",
    }),
  );
}

function ball(
  sequence: number,
  overrides: Record<string, unknown> = {},
) {
  return createEventEnvelope({
    matchId: 100,
    tournamentId: 10,
    sportSlug: "cricket",
    eventType: CricketEventType.BALL_RECORDED,
    sequence,
    payload: {
      innings: 1,
      over: 0,
      ball: 1,
      strikerId: 101,
      nonStrikerId: 102,
      bowlerId: 201,
      runsOffBat: 0,
      extras: { type: null, runs: 0 },
      wicket: null,
      isLegalDelivery: true,
      ...overrides,
    },
    actorType: "organizer",
  });
}

describe("P0.1 strike rotation for extras", () => {
  it("plain wide does not rotate strike", () => {
    const payload = {
      runsOffBat: 0,
      extras: { type: "wide" as const, runs: 1 },
      isLegalDelivery: false,
    };
    expect(strikeRotatingRuns(payload as never)).toBe(0);
    expect(shouldSwapStrike(payload as never)).toBe(false);
  });

  it("wide + 2 additional extras rotates strike", () => {
    const payload = {
      runsOffBat: 0,
      extras: { type: "wide" as const, runs: 3 },
      isLegalDelivery: false,
    };
    expect(strikeRotatingRuns(payload as never)).toBe(2);
    expect(shouldSwapStrike(payload as never)).toBe(false);
  });

  it("plain no-ball does not rotate; Nb + 1 off bat does", () => {
    expect(
      shouldSwapStrike({
        runsOffBat: 0,
        extras: { type: "no_ball", runs: 1 },
        isLegalDelivery: false,
      } as never),
    ).toBe(false);
    expect(
      shouldSwapStrike({
        runsOffBat: 1,
        extras: { type: "no_ball", runs: 1 },
        isLegalDelivery: false,
      } as never),
    ).toBe(true);
  });

  it("1 bye rotates strike; 2 byes do not", () => {
    expect(
      shouldSwapStrike({
        runsOffBat: 0,
        extras: { type: "bye", runs: 1 },
        isLegalDelivery: true,
      } as never),
    ).toBe(true);
    expect(
      shouldSwapStrike({
        runsOffBat: 0,
        extras: { type: "leg_bye", runs: 2 },
        isLegalDelivery: true,
      } as never),
    ).toBe(false);
  });

  it("reducer keeps strike after a plain wide", () => {
    const after = reduceCricket(
      startedWithOpeners(),
      ball(4, {
        extras: { type: "wide", runs: 1 },
        isLegalDelivery: false,
      }),
    );
    expect(after.strikerId).toBe(101);
    expect(after.nonStrikerId).toBe(102);
    expect(after.innings[0]?.runs).toBe(1);
  });
});

describe("P0.1 wicket vacates crease", () => {
  it("clears dismissed striker so replacement is required", () => {
    const after = reduceCricket(
      startedWithOpeners(),
      ball(4, {
        wicket: { type: "bowled", dismissedPlayerId: 101 },
        over: 0,
        ball: 1,
      }),
      { enforceLiveRules: true },
    );
    expect(after.innings[0]?.wickets).toBe(1);
    expect(after.strikerId).toBeNull();
    expect(after.nonStrikerId).toBe(102);
  });

  it("rejects further balls until a new batter is supplied", () => {
    const afterWicket = reduceCricket(
      startedWithOpeners(),
      ball(4, {
        wicket: { type: "bowled", dismissedPlayerId: 101 },
      }),
      { enforceLiveRules: true },
    );
    expect(() =>
      reduceCricket(
        afterWicket,
        ball(5, {
          strikerId: 102,
          nonStrikerId: 102,
          over: 0,
          ball: 2,
        }),
        { enforceLiveRules: true },
      ),
    ).toThrow(/different players|new batter/i);

    const resumed = reduceCricket(
      afterWicket,
      ball(5, {
        strikerId: 103,
        nonStrikerId: 102,
        runsOffBat: 1,
        over: 0,
        ball: 2,
      }),
      { enforceLiveRules: true },
    );
    expect(resumed.strikerId).toBe(102);
    expect(resumed.nonStrikerId).toBe(103);
  });
});

describe("P0.1 deriveCricketMatchResult uses target / DLS", () => {
  it("awards chase win when second reaches DLS target below first total", () => {
    let state = startedWithOpeners();
    state = reduceCricket(
      state,
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.INNINGS_ENDED,
        sequence: 4,
        payload: {
          innings: 1,
          reason: "overs_complete",
          runs: 80,
          wickets: 3,
          overs: "6.0",
        },
        actorType: "organizer",
      }),
    );
    expect(state.target).toBe(81);
    state = {
      ...state,
      target: 50,
      innings: state.innings.map((inn) =>
        inn.innings === 2
          ? { ...inn, runs: 50, wickets: 2, phase: "completed" as const }
          : inn,
      ),
    };
    const result = deriveCricketMatchResult(state);
    expect(result.winnerTeamId).toBe(2);
    expect(result.isTie).toBe(false);
  });

  it("ties when chase finishes on target-1", () => {
    let state = startedWithOpeners();
    state = reduceCricket(
      state,
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.INNINGS_ENDED,
        sequence: 4,
        payload: {
          innings: 1,
          reason: "overs_complete",
          runs: 60,
          wickets: 4,
          overs: "6.0",
        },
        actorType: "organizer",
      }),
    );
    state = {
      ...state,
      innings: state.innings.map((inn) =>
        inn.innings === 2
          ? { ...inn, runs: 60, wickets: 5, phase: "completed" as const }
          : inn,
      ),
    };
    const result = deriveCricketMatchResult(state);
    expect(result.isTie).toBe(true);
    expect(result.winnerTeamId).toBeNull();
  });
});
