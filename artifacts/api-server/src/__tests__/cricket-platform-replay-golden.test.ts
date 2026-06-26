/**
 * Golden replay tests — platform path must match direct engine replay for cricket.
 */
import { describe, expect, it } from "vitest";
import {
  CricketEventType,
  createEventEnvelope,
  parseCricketEventPayload,
  replayCricketEvents,
  resolveEventsForReplay,
  type MatchMeta,
  type CricketScoreboardState,
} from "@workspace/scoring-core";
import { parseScoringEvent, replayScoringMatchState } from "../lib/scoring-platform";
import "../lib/scoring-adapters/register";

const META: MatchMeta = {
  matchId: 100,
  tournamentId: 10,
  homeTeamId: 1,
  awayTeamId: 2,
  oversLimit: 20,
};

function ballEvent(
  sequence: number,
  overrides: Partial<{
    runsOffBat: number;
    over: number;
    ball: number;
    strikerId: number;
    nonStrikerId: number;
  }> = {},
) {
  return createEventEnvelope({
    matchId: META.matchId,
    tournamentId: META.tournamentId,
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
      extras: { type: null, runs: 0 },
      wicket: null,
      isLegalDelivery: true,
    },
    actorType: "organizer",
  });
}

function assertGoldenReplay(events: ReturnType<typeof createEventEnvelope>[]) {
  const direct = replayCricketEvents(META, events);
  const viaPlatform = replayScoringMatchState<CricketScoreboardState>("cricket", META, events);
  expect(viaPlatform).toEqual(direct);
}

describe("cricket platform golden replay", () => {
  it("matches direct replay for match start and scoring", () => {
    assertGoldenReplay([
      createEventEnvelope({
        matchId: META.matchId,
        tournamentId: META.tournamentId,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 20 },
        actorType: "organizer",
      }),
      ballEvent(2, { runsOffBat: 4, over: 0, ball: 1 }),
      ballEvent(3, { runsOffBat: 6, over: 0, ball: 2 }),
    ]);
  });

  it("matches direct replay with ball undo applied", () => {
    assertGoldenReplay([
      createEventEnvelope({
        matchId: META.matchId,
        tournamentId: META.tournamentId,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 20 },
        actorType: "organizer",
      }),
      ballEvent(2, { runsOffBat: 4 }),
      ballEvent(3, { runsOffBat: 6, over: 0, ball: 2 }),
      createEventEnvelope({
        matchId: META.matchId,
        tournamentId: META.tournamentId,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_UNDONE,
        sequence: 4,
        payload: { undoesEventId: 99, undoesSequence: 3 },
        actorType: "organizer",
      }),
    ]);
  });

  it("parseScoringEvent matches parseCricketEventPayload", () => {
    const payload = {
      innings: 1,
      over: 0,
      ball: 1,
      strikerId: 1,
      nonStrikerId: 2,
      bowlerId: 9,
      runsOffBat: 1,
      extras: { type: null, runs: 0 },
      wicket: null,
      isLegalDelivery: true,
    };
    const direct = parseCricketEventPayload(CricketEventType.BALL_RECORDED, payload);
    const viaPlatform = parseScoringEvent("cricket", CricketEventType.BALL_RECORDED, payload);
    expect(viaPlatform.ok).toBe(direct.ok);
    if (direct.ok && viaPlatform.ok) {
      expect(viaPlatform.payload).toEqual(direct.payload as Record<string, unknown>);
    }
  });
});

describe("cricket client lastSequence contract", () => {
  it("persisted tail sequence can differ from effective replay lastSequence after undo", () => {
    const events = [
      createEventEnvelope({
        matchId: META.matchId,
        tournamentId: META.tournamentId,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 20 },
        actorType: "organizer",
      }),
      ballEvent(2, { runsOffBat: 4 }),
      ballEvent(3, { runsOffBat: 6, over: 0, ball: 2 }),
      createEventEnvelope({
        matchId: META.matchId,
        tournamentId: META.tournamentId,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_UNDONE,
        sequence: 4,
        payload: { undoesEventId: 99, undoesSequence: 3 },
        actorType: "organizer",
      }),
    ];

    const replayed = replayCricketEvents(META, events);
    expect(replayed.lastSequence).toBe(2);
    expect(resolveEventsForReplay(events)).toHaveLength(2);
    expect(events[events.length - 1]!.sequence).toBe(4);
  });
});
