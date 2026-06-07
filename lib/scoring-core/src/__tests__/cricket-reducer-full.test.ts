import { describe, expect, it } from "vitest";
import {
  CricketEventType,
  createEventEnvelope,
  createInitialCricketState,
  replayCricketEvents,
  reduceCricket,
  resolveEventsForReplay,
} from "../index";

const matchMeta = {
  matchId: 100,
  tournamentId: 10,
  homeTeamId: 1,
  awayTeamId: 2,
  oversLimit: 20,
};

function startedState() {
  return reduceCricket(
    createInitialCricketState(matchMeta),
    createEventEnvelope({
      matchId: 100,
      tournamentId: 10,
      sportSlug: "cricket",
      eventType: CricketEventType.MATCH_STARTED,
      sequence: 1,
      payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 20 },
      actorType: "organizer",
    }),
  );
}

function ballEvent(
  sequence: number,
  overrides: Partial<{
    runsOffBat: number;
    extras: { type: "wide" | "no_ball" | "bye" | "leg_bye" | null; runs: number };
    wicket: { type: "bowled"; dismissedPlayerId: number } | null;
    isLegalDelivery: boolean;
    over: number;
    ball: number;
    strikerId: number;
    nonStrikerId: number;
  }> = {},
) {
  return createEventEnvelope({
    matchId: 100,
    tournamentId: 10,
    sportSlug: "cricket",
    eventType: CricketEventType.BALL_RECORDED,
    sequence,
    payload: {
      innings: 1,
      over: overrides.over ?? 0,
      ball: overrides.ball ?? 1,
      strikerId: overrides.strikerId ?? 101,
      nonStrikerId: overrides.nonStrikerId ?? 102,
      bowlerId: 201,
      runsOffBat: overrides.runsOffBat ?? 0,
      extras: overrides.extras ?? { type: null, runs: 0 },
      wicket: overrides.wicket ?? null,
      isLegalDelivery: overrides.isLegalDelivery ?? true,
    },
    actorType: "organizer",
  });
}

describe("cricket reducer PR-2", () => {
  it("records runs and advances legal deliveries", () => {
    const s1 = reduceCricket(startedState(), ballEvent(2, { runsOffBat: 4, over: 0, ball: 1 }));
    expect(s1.innings[0]?.runs).toBe(4);
    expect(s1.innings[0]?.over).toBe(0);
    expect(s1.innings[0]?.ball).toBe(1);

    const s2 = reduceCricket(s1, ballEvent(3, { runsOffBat: 1, over: 0, ball: 2 }));
    expect(s2.innings[0]?.runs).toBe(5);
    expect(s2.strikerId).toBe(102);
    expect(s2.nonStrikerId).toBe(101);
  });

  it("records wicket", () => {
    const state = reduceCricket(
      startedState(),
      ballEvent(2, {
        wicket: { type: "bowled", dismissedPlayerId: 101 },
        over: 0,
        ball: 1,
      }),
    );
    expect(state.innings[0]?.wickets).toBe(1);
    expect(state.thisOver[0]?.label).toBe("W");
  });

  it("ends innings and starts chase with target", () => {
    const live = startedState();
    const afterInnings = reduceCricket(
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
    expect(afterInnings.currentInnings).toBe(2);
    expect(afterInnings.target).toBe(151);
    expect(afterInnings.innings).toHaveLength(2);
    expect(afterInnings.innings[1]?.battingTeamId).toBe(2);
  });

  it("completes match with result", () => {
    const done = reduceCricket(
      startedState(),
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_COMPLETED,
        sequence: 2,
        payload: {
          winnerTeamId: 1,
          margin: "25 runs",
          resultText: "Team 1 won by 25 runs",
        },
        actorType: "organizer",
      }),
    );
    expect(done.matchStatus).toBe("completed");
    expect(done.resultText).toBe("Team 1 won by 25 runs");
  });

  it("replays with undo removing a ball", () => {
    const events = [
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 20 },
        actorType: "organizer",
      }),
      ballEvent(2, { runsOffBat: 4, over: 0, ball: 1 }),
      ballEvent(3, { runsOffBat: 6, over: 0, ball: 2 }),
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_UNDONE,
        sequence: 4,
        payload: { undoesEventId: 3, undoesSequence: 3 },
        actorType: "organizer",
      }),
    ];

    const resolved = resolveEventsForReplay(events);
    expect(resolved).toHaveLength(2);

    const state = replayCricketEvents(matchMeta, events);
    expect(state.innings[0]?.runs).toBe(4);
    expect(state.lastSequence).toBe(2);
  });

  it("abandons match", () => {
    const state = reduceCricket(
      startedState(),
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_ABANDONED,
        sequence: 2,
        payload: { reason: "Rain" },
        actorType: "organizer",
      }),
    );
    expect(state.matchStatus).toBe("abandoned");
    expect(state.abandonedReason).toBe("Rain");
  });
});
