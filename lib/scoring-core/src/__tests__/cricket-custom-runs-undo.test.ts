import { describe, expect, it } from "vitest";
import {
  CricketEventType,
  createEventEnvelope,
  createInitialCricketState,
  reduceCricket,
  replayCricketEvents,
  buildCricketScorecardFromEvents,
  resolveEventsForReplay,
} from "../index";

const matchMeta = {
  matchId: 58,
  tournamentId: 25,
  homeTeamId: 100,
  awayTeamId: 200,
  oversLimit: 20,
};

describe("cricket scoring: custom runs (>6) and undo replay", () => {
  function createStartedMatch() {
    const started = reduceCricket(
      createInitialCricketState(matchMeta),
      createEventEnvelope({
        matchId: 58,
        tournamentId: 25,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 100, electedTo: "bat", oversLimit: 20 },
        actorType: "organizer",
      }),
    );
    return reduceCricket(
      started,
      createEventEnvelope({
        matchId: 58,
        tournamentId: 25,
        sportSlug: "cricket",
        eventType: CricketEventType.LINEUP_SET,
        sequence: 2,
        payload: { teamId: 100, playerIds: [10, 20, 30], battingOrder: [10, 20, 30] },
        actorType: "organizer",
      }),
    );
  }

  it("records runsOffBat = 5: team +5, striker +5, strike rotates (odd)", () => {
    const state = createStartedMatch();
    const ball = createEventEnvelope({
      matchId: 58,
      tournamentId: 25,
      sportSlug: "cricket",
      eventType: CricketEventType.BALL_RECORDED,
      sequence: 3,
      payload: {
        innings: 1,
        over: 0,
        ball: 1,
        strikerId: 10,
        nonStrikerId: 20,
        bowlerId: 99,
        runsOffBat: 5,
        extras: { type: null, runs: 0 },
        wicket: null,
        isLegalDelivery: true,
      },
      actorType: "scorer",
    });

    const next = reduceCricket(state, ball);
    expect(next.innings[0]?.runs).toBe(5);
    expect(next.innings[0]?.over).toBe(0);
    expect(next.innings[0]?.ball).toBe(1);
    expect(next.strikerId).toBe(20); // strike swapped
    expect(next.nonStrikerId).toBe(10);
    expect(next.thisOver).toHaveLength(1);
    expect(next.thisOver[0]?.label).toBe("5");
  });

  it("records runsOffBat = 7: team +7, striker +7, strike rotates, ball count +1", () => {
    const state = createStartedMatch();
    const ball = createEventEnvelope({
      matchId: 58,
      tournamentId: 25,
      sportSlug: "cricket",
      eventType: CricketEventType.BALL_RECORDED,
      sequence: 3,
      payload: {
        innings: 1,
        over: 0,
        ball: 1,
        strikerId: 10,
        nonStrikerId: 20,
        bowlerId: 99,
        runsOffBat: 7,
        extras: { type: null, runs: 0 },
        wicket: null,
        isLegalDelivery: true,
      },
      actorType: "scorer",
    });

    const next = reduceCricket(state, ball);
    expect(next.innings[0]?.runs).toBe(7);
    expect(next.innings[0]?.over).toBe(0);
    expect(next.innings[0]?.ball).toBe(1);
    expect(next.strikerId).toBe(20); // 7 is odd => strike swaps
    expect(next.nonStrikerId).toBe(10);
    expect(next.thisOver[0]?.label).toBe("7");

    // Check scorecard
    const events = [
      createEventEnvelope({
        matchId: 58,
        tournamentId: 25,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 100, electedTo: "bat", oversLimit: 20 },
        actorType: "organizer",
      }),
      ball,
    ];
    const scorecard = buildCricketScorecardFromEvents(58, events, { homeTeamId: 100, awayTeamId: 200 });
    const inn1 = scorecard.innings[0]!;
    expect(inn1.totalRuns).toBe(7);
    const batter10 = inn1.batting.find((b) => b.playerId === 10);
    expect(batter10?.runs).toBe(7);
    expect(batter10?.balls).toBe(1);
    expect(batter10?.fours).toBe(0); // 7 runs is not a boundary four
    expect(batter10?.sixes).toBe(0); // 7 runs is not a boundary six
    const bowler99 = inn1.bowling.find((b) => b.playerId === 99);
    expect(bowler99?.runs).toBe(7);
    expect(bowler99?.overs).toBe("0.1");
  });

  it("records runsOffBat = 8: team +8, striker +8, strike does not rotate (even)", () => {
    const state = createStartedMatch();
    const ball = createEventEnvelope({
      matchId: 58,
      tournamentId: 25,
      sportSlug: "cricket",
      eventType: CricketEventType.BALL_RECORDED,
      sequence: 3,
      payload: {
        innings: 1,
        over: 0,
        ball: 1,
        strikerId: 10,
        nonStrikerId: 20,
        bowlerId: 99,
        runsOffBat: 8,
        extras: { type: null, runs: 0 },
        wicket: null,
        isLegalDelivery: true,
      },
      actorType: "scorer",
    });

    const next = reduceCricket(state, ball);
    expect(next.innings[0]?.runs).toBe(8);
    expect(next.strikerId).toBe(10); // 8 is even => striker stays
    expect(next.nonStrikerId).toBe(20);
    expect(next.thisOver[0]?.label).toBe("8");
  });

  it("records runsOffBat = 10 and 20: team totals and strike rotation correct", () => {
    const state = createStartedMatch();
    const ball10 = createEventEnvelope({
      matchId: 58,
      tournamentId: 25,
      sportSlug: "cricket",
      eventType: CricketEventType.BALL_RECORDED,
      sequence: 3,
      payload: {
        innings: 1,
        over: 0,
        ball: 1,
        strikerId: 10,
        nonStrikerId: 20,
        bowlerId: 99,
        runsOffBat: 10,
        extras: { type: null, runs: 0 },
        wicket: null,
        isLegalDelivery: true,
      },
      actorType: "scorer",
    });
    const next10 = reduceCricket(state, ball10);
    expect(next10.innings[0]?.runs).toBe(10);
    expect(next10.strikerId).toBe(10);

    const ball20 = createEventEnvelope({
      matchId: 58,
      tournamentId: 25,
      sportSlug: "cricket",
      eventType: CricketEventType.BALL_RECORDED,
      sequence: 4,
      payload: {
        innings: 1,
        over: 0,
        ball: 2,
        strikerId: 10,
        nonStrikerId: 20,
        bowlerId: 99,
        runsOffBat: 20,
        extras: { type: null, runs: 0 },
        wicket: null,
        isLegalDelivery: true,
      },
      actorType: "scorer",
    });
    const next20 = reduceCricket(next10, ball20);
    expect(next20.innings[0]?.runs).toBe(30);
    expect(next20.innings[0]?.ball).toBe(2);
    expect(next20.strikerId).toBe(10);
  });

  it("undo on a normal ball: restores previous score, ball count, and crease state", () => {
    const events = [
      createEventEnvelope({
        matchId: 58,
        tournamentId: 25,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 100, electedTo: "bat", oversLimit: 20 },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: 58,
        tournamentId: 25,
        sportSlug: "cricket",
        eventType: CricketEventType.LINEUP_SET,
        sequence: 2,
        payload: { teamId: 100, playerIds: [10, 20], battingOrder: [10, 20] },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: 58,
        tournamentId: 25,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 3,
        payload: {
          innings: 1,
          over: 0,
          ball: 1,
          strikerId: 10,
          nonStrikerId: 20,
          bowlerId: 99,
          runsOffBat: 1,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        actorType: "scorer",
      }),
      createEventEnvelope({
        matchId: 58,
        tournamentId: 25,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_UNDONE,
        sequence: 4,
        payload: { undoesEventId: 3, undoesSequence: 3 },
        actorType: "scorer",
      }),
    ];

    const state = replayCricketEvents(matchMeta, events);
    expect(state.innings[0]?.runs).toBe(0);
    expect(state.innings[0]?.over).toBe(0);
    expect(state.innings[0]?.ball).toBe(0);
    expect(state.strikerId).toBe(10);
    expect(state.nonStrikerId).toBe(20);
    expect(state.thisOver).toHaveLength(0);
  });

  it("undo on a >6 run delivery (7 runs): completely restores previous state", () => {
    const events = [
      createEventEnvelope({
        matchId: 58,
        tournamentId: 25,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 100, electedTo: "bat", oversLimit: 20 },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: 58,
        tournamentId: 25,
        sportSlug: "cricket",
        eventType: CricketEventType.LINEUP_SET,
        sequence: 2,
        payload: { teamId: 100, playerIds: [10, 20], battingOrder: [10, 20] },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: 58,
        tournamentId: 25,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 3,
        payload: {
          innings: 1,
          over: 0,
          ball: 1,
          strikerId: 10,
          nonStrikerId: 20,
          bowlerId: 99,
          runsOffBat: 4,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        actorType: "scorer",
      }),
      createEventEnvelope({
        matchId: 58,
        tournamentId: 25,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 4,
        payload: {
          innings: 1,
          over: 0,
          ball: 2,
          strikerId: 10,
          nonStrikerId: 20,
          bowlerId: 99,
          runsOffBat: 7,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        actorType: "scorer",
      }),
    ];

    const stateBeforeUndo = replayCricketEvents(matchMeta, events);
    expect(stateBeforeUndo.innings[0]?.runs).toBe(11);
    expect(stateBeforeUndo.innings[0]?.ball).toBe(2);
    expect(stateBeforeUndo.strikerId).toBe(20); // 7 runs rotated strike

    const eventsWithUndo = [
      ...events,
      createEventEnvelope({
        matchId: 58,
        tournamentId: 25,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_UNDONE,
        sequence: 5,
        payload: { undoesEventId: 4, undoesSequence: 4 },
        actorType: "scorer",
      }),
    ];

    const stateAfterUndo = replayCricketEvents(matchMeta, eventsWithUndo);
    expect(stateAfterUndo.innings[0]?.runs).toBe(4);
    expect(stateAfterUndo.innings[0]?.ball).toBe(1);
    expect(stateAfterUndo.strikerId).toBe(10);
    expect(stateAfterUndo.nonStrikerId).toBe(20);
    expect(stateAfterUndo.thisOver).toHaveLength(1);
    expect(stateAfterUndo.thisOver[0]?.label).toBe("4");
  });
});
