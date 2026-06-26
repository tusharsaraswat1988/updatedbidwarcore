import { describe, expect, it } from "vitest";
import {
  CricketEventType,
  createEventEnvelope,
  createInitialCricketState,
  reduceCricket,
  replayCricketEvents,
} from "../index";

const matchMeta = {
  matchId: 100,
  tournamentId: 10,
  homeTeamId: 1,
  awayTeamId: 2,
  oversLimit: 20,
};

describe("cricket reducer foundation", () => {
  it("starts from scheduled idle state", () => {
    const state = createInitialCricketState(matchMeta);
    expect(state.matchStatus).toBe("scheduled");
    expect(state.sessionStatus).toBe("idle");
    expect(state.innings).toHaveLength(0);
    expect(state.lastSequence).toBe(0);
  });

  it("applies match.started and sets first innings", () => {
    const initial = createInitialCricketState(matchMeta);
    const event = createEventEnvelope({
      matchId: 100,
      tournamentId: 10,
      sportSlug: "cricket",
      eventType: CricketEventType.MATCH_STARTED,
      sequence: 1,
      payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 20 },
      actorType: "organizer",
    });

    const next = reduceCricket(initial, event);
    expect(next.matchStatus).toBe("live");
    expect(next.sessionStatus).toBe("live");
    expect(next.currentInnings).toBe(1);
    expect(next.innings).toHaveLength(1);
    expect(next.innings[0]?.battingTeamId).toBe(1);
    expect(next.innings[0]?.bowlingTeamId).toBe(2);
    expect(next.lastSequence).toBe(1);
  });

  it("applies lineup.set for a team", () => {
    const started = reduceCricket(
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

    const withLineup = reduceCricket(
      started,
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.LINEUP_SET,
        sequence: 2,
        payload: { teamId: 1, playerIds: [101, 102, 103] },
        actorType: "organizer",
      }),
    );

    expect(withLineup.lineups[1]).toEqual([101, 102, 103]);
    expect(withLineup.lastSequence).toBe(2);
  });

  it("records ball after match started", () => {
    const started = reduceCricket(
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
    const event = createEventEnvelope({
      matchId: 100,
      tournamentId: 10,
      sportSlug: "cricket",
      eventType: CricketEventType.BALL_RECORDED,
      sequence: 2,
      payload: {
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
      },
      actorType: "organizer",
    });
    const next = reduceCricket(started, event);
    expect(next.innings[0]?.runs).toBe(4);
  });

  it("replays events in order", () => {
    const events = [
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 2, electedTo: "bowl", oversLimit: 20 },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.LINEUP_SET,
        sequence: 2,
        payload: { teamId: 1, playerIds: [10, 11] },
        actorType: "organizer",
      }),
    ];

    const state = replayCricketEvents(matchMeta, events);
    expect(state.matchStatus).toBe("live");
    expect(state.innings[0]?.battingTeamId).toBe(1);
    expect(state.lineups[1]).toEqual([10, 11]);
    expect(state.lastSequence).toBe(2);
  });

  it("replays committed caught-on-free-hit balls without throwing (live rules still enforced on append)", () => {
    const events = [
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 100, electedTo: "bat", oversLimit: 20 },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.LINEUP_SET,
        sequence: 2,
        payload: { teamId: 100, playerIds: [1, 2], battingOrder: [1, 2] },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.LINEUP_SET,
        sequence: 3,
        payload: { teamId: 200, playerIds: [9] },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 4,
        payload: {
          innings: 1,
          over: 0,
          ball: 1,
          strikerId: 1,
          nonStrikerId: 2,
          bowlerId: 9,
          runsOffBat: 0,
          extras: { type: "no_ball", runs: 1 },
          wicket: null,
          isLegalDelivery: false,
        },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: 100,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 5,
        payload: {
          innings: 1,
          over: 0,
          ball: 2,
          strikerId: 1,
          nonStrikerId: 2,
          bowlerId: 9,
          runsOffBat: 0,
          extras: { type: null, runs: 0 },
          wicket: { type: "caught", dismissedPlayerId: 1 },
          isLegalDelivery: true,
        },
        actorType: "organizer",
      }),
    ];

    const state = replayCricketEvents(matchMeta, events);
    expect(state.innings[0]?.wickets).toBe(1);

    const stateBeforeCaught = replayCricketEvents(matchMeta, events.slice(0, 4));
    expect(() =>
      reduceCricket(stateBeforeCaught, events[4]!, { enforceLiveRules: true }),
    ).toThrow(/free hit/i);
  });
});
