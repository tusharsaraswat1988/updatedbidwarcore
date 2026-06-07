import { describe, expect, it } from "vitest";
import {
  assertExpectedSequence,
  CricketEventType,
  createEventEnvelope,
  createInitialCricketState,
  replayCricketEvents,
  resolveEventsForReplay,
} from "@workspace/scoring-core";

describe("scoring event engine (unit)", () => {
  const meta = {
    matchId: 1,
    tournamentId: 10,
    homeTeamId: 100,
    awayTeamId: 200,
    oversLimit: 20,
  };

  it("replays a full over from events", () => {
    const events = [
      createEventEnvelope({
        matchId: 1,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 100, electedTo: "bat", oversLimit: 20 },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: 1,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 2,
        payload: {
          innings: 1,
          over: 0,
          ball: 1,
          strikerId: 1,
          nonStrikerId: 2,
          bowlerId: 9,
          runsOffBat: 4,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: 1,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 3,
        payload: {
          innings: 1,
          over: 0,
          ball: 2,
          strikerId: 2,
          nonStrikerId: 1,
          bowlerId: 9,
          runsOffBat: 6,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        actorType: "organizer",
      }),
    ];

    const state = replayCricketEvents(meta, events);
    expect(state.innings[0]?.runs).toBe(10);
    expect(state.matchStatus).toBe("live");
  });

  it("detects sequence conflict", () => {
    expect(() => assertExpectedSequence(2, 5)).toThrow();
  });

  it("resolveEventsForReplay strips undone balls", () => {
    const events = [
      createEventEnvelope({
        matchId: 1,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 1,
        payload: {
          innings: 1,
          over: 0,
          ball: 1,
          strikerId: 1,
          nonStrikerId: 2,
          bowlerId: 9,
          runsOffBat: 6,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: 1,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_UNDONE,
        sequence: 2,
        payload: { undoesEventId: 99, undoesSequence: 1 },
        actorType: "organizer",
      }),
    ];
    expect(resolveEventsForReplay(events)).toHaveLength(0);
  });

  it("initial state is scheduled", () => {
    const state = createInitialCricketState(meta);
    expect(state.matchStatus).toBe("scheduled");
    expect(state.lastSequence).toBe(0);
  });
});
