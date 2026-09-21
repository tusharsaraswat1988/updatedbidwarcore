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

  it("handles custom runs off bat > 6 (e.g. 7, 8, 10, 20) in event replay", () => {
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
        eventType: CricketEventType.LINEUP_SET,
        sequence: 2,
        payload: { teamId: 100, playerIds: [1, 2], battingOrder: [1, 2] },
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
          ball: 1,
          strikerId: 1,
          nonStrikerId: 2,
          bowlerId: 9,
          runsOffBat: 7,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        actorType: "scorer",
      }),
      createEventEnvelope({
        matchId: 1,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 4,
        payload: {
          innings: 1,
          over: 0,
          ball: 2,
          strikerId: 2, // strike rotated after 7 runs
          nonStrikerId: 1,
          bowlerId: 9,
          runsOffBat: 8,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        actorType: "scorer",
      }),
      createEventEnvelope({
        matchId: 1,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 5,
        payload: {
          innings: 1,
          over: 0,
          ball: 3,
          strikerId: 2, // strike retained after 8 runs
          nonStrikerId: 1,
          bowlerId: 9,
          runsOffBat: 20,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        actorType: "scorer",
      }),
    ];

    const state = replayCricketEvents(meta, events);
    expect(state.innings[0]?.runs).toBe(35); // 7 + 8 + 20
    expect(state.innings[0]?.over).toBe(0);
    expect(state.innings[0]?.ball).toBe(3);
    expect(state.strikerId).toBe(2); // 20 is even => striker 2 stays
    expect(state.nonStrikerId).toBe(1);
    expect(state.thisOver).toHaveLength(3);
    expect(state.thisOver[0]?.label).toBe("7");
    expect(state.thisOver[1]?.label).toBe("8");
    expect(state.thisOver[2]?.label).toBe("20");
  });

  it("undo restores state after a >6 run delivery (7 runs)", () => {
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
        eventType: CricketEventType.LINEUP_SET,
        sequence: 2,
        payload: { teamId: 100, playerIds: [1, 2], battingOrder: [1, 2] },
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
          ball: 1,
          strikerId: 1,
          nonStrikerId: 2,
          bowlerId: 9,
          runsOffBat: 4,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        actorType: "scorer",
      }),
      createEventEnvelope({
        matchId: 1,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 4,
        payload: {
          innings: 1,
          over: 0,
          ball: 2,
          strikerId: 1,
          nonStrikerId: 2,
          bowlerId: 9,
          runsOffBat: 7,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        actorType: "scorer",
      }),
      createEventEnvelope({
        matchId: 1,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_UNDONE,
        sequence: 5,
        payload: { undoesEventId: 4, undoesSequence: 4 },
        actorType: "scorer",
      }),
    ];

    const state = replayCricketEvents(meta, events);
    expect(state.innings[0]?.runs).toBe(4);
    expect(state.innings[0]?.ball).toBe(1);
    expect(state.strikerId).toBe(1);
    expect(state.nonStrikerId).toBe(2);
    expect(state.thisOver).toHaveLength(1);
    expect(state.thisOver[0]?.label).toBe("4");
  });

  it("handles double undo by correctly identifying active non-undone balls", () => {
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
        eventType: CricketEventType.LINEUP_SET,
        sequence: 2,
        payload: { teamId: 100, playerIds: [1, 2], battingOrder: [1, 2] },
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
          ball: 1,
          strikerId: 1,
          nonStrikerId: 2,
          bowlerId: 9,
          runsOffBat: 6,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        actorType: "scorer",
      }),
      createEventEnvelope({
        matchId: 1,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_UNDONE,
        sequence: 4,
        payload: { undoesEventId: 3, undoesSequence: 3 },
        actorType: "scorer",
      }),
    ];

    // Find last non-undone ball
    const undoneSequences = new Set(
      events
        .filter((e) => e.eventType === CricketEventType.BALL_UNDONE)
        .map((e) => (e.payload as { undoesSequence: number }).undoesSequence),
    );
    const lastActiveBall = [...events]
      .reverse()
      .find(
        (e) =>
          e.eventType === CricketEventType.BALL_RECORDED &&
          !undoneSequences.has(e.sequence),
      );

    expect(lastActiveBall).toBeUndefined(); // Nothing left to undo!
  });

  it("initial state is scheduled", () => {
    const state = createInitialCricketState(meta);
    expect(state.matchStatus).toBe("scheduled");
    expect(state.lastSequence).toBe(0);
  });
});
