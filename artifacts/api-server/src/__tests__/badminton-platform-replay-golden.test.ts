/**
 * Golden replay tests — platform path must match direct engine replay for
 * representative historical and live badminton event streams.
 */
import { describe, expect, it } from "vitest";
import {
  replayBadmintonEvents,
  parseBadmintonEventPayload,
  mergeMatchStateCache,
  BadmintonEventType,
  STANDARD_FORMAT,
  cmdAwardPoint,
  cmdStartMatch,
  cmdStartTimeout,
  cmdEndTimeout,
  cmdUndoLastPoint,
  createInitialBadmintonState,
  reduceBadminton,
  getUndoTargetSequences,
} from "@workspace/badminton-core";
import type {
  BadmintonEventEnvelope,
  BadmintonMatchMeta,
  BadmintonMatchStartedPayload,
  BadmintonMatchState,
  BadmintonSide,
} from "@workspace/badminton-core";
import { parseScoringEvent, replayScoringMatchState } from "../lib/scoring-platform";
import "../lib/scoring-adapters/register";

function stableBadmintonState(state: BadmintonMatchState): BadmintonMatchState {
  return {
    ...state,
    startedAt: state.startedAt ? "REPLAY_TS" : null,
    games: state.games.map((game) => ({
      ...game,
      startedAt: game.startedAt ? "REPLAY_TS" : undefined,
      endedAt: game.endedAt ? "REPLAY_TS" : undefined,
    })),
  };
}

function assertGoldenReplay(meta: BadmintonMatchMeta, events: BadmintonEventEnvelope[]) {
  const direct = stableBadmintonState(replayBadmintonEvents(meta, events));
  const viaPlatform = stableBadmintonState(
    replayScoringMatchState<BadmintonMatchState>("badminton", meta, events),
  );
  expect(viaPlatform).toEqual(direct);
}

function assertGoldenParse(eventType: string, payload: Record<string, unknown>) {
  const direct = parseBadmintonEventPayload(eventType, payload);
  const viaPlatform = parseScoringEvent("badminton", eventType, payload);
  expect(viaPlatform.ok).toBe(direct.ok);
  if (direct.ok && viaPlatform.ok) {
    expect(viaPlatform.payload).toEqual(direct.payload as Record<string, unknown>);
  }
}

function envelope(
  seq: number,
  eventType: string,
  payload: Record<string, unknown>,
  meta: BadmintonMatchMeta,
): BadmintonEventEnvelope {
  return {
    matchId: meta.matchId,
    tournamentId: meta.tournamentId,
    sportSlug: "badminton",
    eventType,
    eventVersion: 1,
    sequence: seq,
    actorType: "organizer",
    payload,
  };
}

const SINGLES_META: BadmintonMatchMeta = {
  matchId: 101,
  tournamentId: 10,
  matchKind: "singles",
  format: STANDARD_FORMAT,
};

const SINGLES_START: BadmintonMatchStartedPayload = {
  matchKind: "singles",
  format: STANDARD_FORMAT,
  leftSide: { label: "Player A", shortLabel: "A", playerIds: [1] },
  rightSide: { label: "Player B", shortLabel: "B", playerIds: [2] },
  firstServer: "left",
};

const DOUBLES_META: BadmintonMatchMeta = {
  matchId: 202,
  tournamentId: 20,
  matchKind: "doubles",
  format: STANDARD_FORMAT,
};

const DOUBLES_START: BadmintonMatchStartedPayload = {
  matchKind: "doubles",
  format: STANDARD_FORMAT,
  leftSide: {
    label: "A1 / A2",
    shortLabel: "A",
    playerIds: [1, 2],
    players: [
      { label: "A1", shortLabel: "A1" },
      { label: "A2", shortLabel: "A2" },
    ],
  },
  rightSide: {
    label: "B1 / B2",
    shortLabel: "B",
    playerIds: [3, 4],
    players: [
      { label: "B1", shortLabel: "B1" },
      { label: "B2", shortLabel: "B2" },
    ],
  },
  firstServer: "left",
  doublesSetup: {
    tossWinnerSide: "left",
    tossDecision: "serve",
    firstServingSide: "left",
    firstServerPlayerIndex: 0,
    firstReceivingSide: "right",
    firstReceiverPlayerIndex: 0,
  },
};

function buildSimulatedMatch(
  meta: BadmintonMatchMeta,
  startPayload: BadmintonMatchStartedPayload,
  rallyWinners: BadmintonSide[],
): BadmintonEventEnvelope[] {
  const events: BadmintonEventEnvelope[] = [];
  let state = createInitialBadmintonState(meta);
  let seq = 1;

  const startResult = cmdStartMatch(state, startPayload);
  if (!startResult.ok) {
    throw new Error(startResult.error);
  }

  for (const event of startResult.events) {
    const ev = envelope(seq, event.eventType, event.payload, meta);
    events.push(ev);
    state = reduceBadminton(state, ev);
    seq += 1;
  }

  for (const winner of rallyWinners) {
    const result = cmdAwardPoint(state, winner);
    if (!result.ok) break;
    for (const event of result.events) {
      const ev = envelope(seq, event.eventType, event.payload, meta);
      events.push(ev);
      state = reduceBadminton(state, ev);
      seq += 1;
    }
  }

  return events;
}

describe("badminton platform golden replay", () => {
  it("singles: match started + alternating points", () => {
    const events: BadmintonEventEnvelope[] = [
      envelope(1, BadmintonEventType.MATCH_STARTED, SINGLES_START as Record<string, unknown>, SINGLES_META),
      envelope(2, BadmintonEventType.POINT_WON, {
        winningSide: "left",
        gameNumber: 1,
        winnerScore: 1,
        loserScore: 0,
        isGamePoint: false,
        isMatchPoint: false,
      }, SINGLES_META),
      envelope(3, BadmintonEventType.POINT_WON, {
        winningSide: "right",
        gameNumber: 1,
        winnerScore: 1,
        loserScore: 1,
        isGamePoint: false,
        isMatchPoint: false,
      }, SINGLES_META),
    ];
    assertGoldenReplay(SINGLES_META, events);
  });

  it("doubles: 40 alternating rally wins", () => {
    const winners: BadmintonSide[] = Array.from({ length: 40 }, (_, i) =>
      i % 2 === 0 ? "left" : "right",
    );
    const events = buildSimulatedMatch(DOUBLES_META, DOUBLES_START, winners);
    assertGoldenReplay(DOUBLES_META, events);
  });

  it("doubles: long left-streak then right comeback", () => {
    const winners: BadmintonSide[] = [
      ...Array.from({ length: 15 }, () => "left" as BadmintonSide),
      ...Array.from({ length: 12 }, () => "right" as BadmintonSide),
      ...Array.from({ length: 8 }, () => "left" as BadmintonSide),
    ];
    const events = buildSimulatedMatch(DOUBLES_META, DOUBLES_START, winners);
    assertGoldenReplay(DOUBLES_META, events);
  });

  it("singles: point undo restores prior state", () => {
    const baseEvents = buildSimulatedMatch(SINGLES_META, SINGLES_START, ["left", "left", "right"]);
    const meta = SINGLES_META;
    const stateBeforeUndo = replayBadmintonEvents(meta, baseEvents);
    const undoTargets = getUndoTargetSequences(baseEvents);
    const undoResult = cmdUndoLastPoint(stateBeforeUndo, undoTargets);
    expect(undoResult.ok).toBe(true);
    if (!undoResult.ok) return;

    const eventsWithUndo = [...baseEvents];
    let seq = baseEvents.length + 1;
    for (const event of undoResult.events) {
      eventsWithUndo.push(envelope(seq, event.eventType, event.payload, meta));
      seq += 1;
    }
    assertGoldenReplay(meta, eventsWithUndo);
  });

  it("doubles: timeout start and end", () => {
    const baseEvents = buildSimulatedMatch(DOUBLES_META, DOUBLES_START, ["left", "right", "left"]);
    let state = replayBadmintonEvents(DOUBLES_META, baseEvents);
    const timeoutStart = cmdStartTimeout(state, "left", "regular");
    expect(timeoutStart.ok).toBe(true);
    if (!timeoutStart.ok) return;

    for (const event of timeoutStart.events) {
      state = reduceBadminton(state, envelope(baseEvents.length + 1, event.eventType, event.payload, DOUBLES_META));
    }
    const timeoutEnd = cmdEndTimeout(state);
    expect(timeoutEnd.ok).toBe(true);
    if (!timeoutEnd.ok) return;

    const events = [...baseEvents];
    let seq = baseEvents.length + 1;
    for (const event of timeoutStart.events) {
      events.push(envelope(seq, event.eventType, event.payload, DOUBLES_META));
      seq += 1;
    }
    for (const event of timeoutEnd.events) {
      events.push(envelope(seq, event.eventType, event.payload, DOUBLES_META));
      seq += 1;
    }
    assertGoldenReplay(DOUBLES_META, events);
  });

  it("empty event stream replays to initial state", () => {
    assertGoldenReplay(SINGLES_META, []);
    assertGoldenReplay(DOUBLES_META, []);
  });
});

describe("badminton client lastSequence contract", () => {
  it("persisted tail sequence can differ from effective replay lastSequence after undo", () => {
    const events: BadmintonEventEnvelope[] = [
      envelope(1, BadmintonEventType.MATCH_STARTED, SINGLES_START as Record<string, unknown>, SINGLES_META),
      envelope(2, BadmintonEventType.POINT_WON, {
        winningSide: "left",
        gameNumber: 1,
        winnerScore: 1,
        loserScore: 0,
        isGamePoint: false,
        isMatchPoint: false,
      }, SINGLES_META),
      envelope(3, BadmintonEventType.POINT_WON, {
        winningSide: "right",
        gameNumber: 1,
        winnerScore: 1,
        loserScore: 1,
        isGamePoint: false,
        isMatchPoint: false,
      }, SINGLES_META),
      envelope(4, BadmintonEventType.POINT_UNDONE, {
        undoneSequence: 3,
        undoneSequences: [3],
      }, SINGLES_META),
    ];

    const replayed = replayBadmintonEvents(SINGLES_META, events);
    expect(replayed.lastSequence).toBe(2);
    expect(events[events.length - 1]!.sequence).toBe(4);
  });

  it("mergeMatchStateCache accepts persisted tail after undo when replay tail regresses", () => {
    const afterPoints = stableBadmintonState(
      replayBadmintonEvents(SINGLES_META, [
        envelope(1, BadmintonEventType.MATCH_STARTED, SINGLES_START as Record<string, unknown>, SINGLES_META),
        envelope(2, BadmintonEventType.POINT_WON, {
          winningSide: "left",
          gameNumber: 1,
          winnerScore: 1,
          loserScore: 0,
          isGamePoint: false,
          isMatchPoint: false,
        }, SINGLES_META),
        envelope(3, BadmintonEventType.POINT_WON, {
          winningSide: "right",
          gameNumber: 1,
          winnerScore: 1,
          loserScore: 1,
          isGamePoint: false,
          isMatchPoint: false,
        }, SINGLES_META),
      ]),
    );

    const replayOnlyUndo = stableBadmintonState(
      replayBadmintonEvents(SINGLES_META, [
        envelope(1, BadmintonEventType.MATCH_STARTED, SINGLES_START as Record<string, unknown>, SINGLES_META),
        envelope(2, BadmintonEventType.POINT_WON, {
          winningSide: "left",
          gameNumber: 1,
          winnerScore: 1,
          loserScore: 0,
          isGamePoint: false,
          isMatchPoint: false,
        }, SINGLES_META),
        envelope(3, BadmintonEventType.POINT_WON, {
          winningSide: "right",
          gameNumber: 1,
          winnerScore: 1,
          loserScore: 1,
          isGamePoint: false,
          isMatchPoint: false,
        }, SINGLES_META),
        envelope(4, BadmintonEventType.POINT_UNDONE, {
          undoneSequence: 3,
          undoneSequences: [3],
        }, SINGLES_META),
      ]),
    );

    const staleMerge = mergeMatchStateCache(
      { state: afterPoints, detail: null },
      replayOnlyUndo,
    );
    expect(staleMerge.state.lastSequence).toBe(afterPoints.lastSequence);

    const persistedTail = { ...replayOnlyUndo, lastSequence: 4 };
    const accepted = mergeMatchStateCache(
      { state: afterPoints, detail: null },
      persistedTail,
    );
    expect(accepted.state.lastSequence).toBe(4);
    expect(accepted.state.leftScore).toBe(1);
    expect(accepted.state.rightScore).toBe(0);
  });
});

describe("badminton platform golden parse", () => {
  it("parses match started and point won payloads identically", () => {
    assertGoldenParse(BadmintonEventType.MATCH_STARTED, SINGLES_START as Record<string, unknown>);
    assertGoldenParse(BadmintonEventType.POINT_WON, {
      winningSide: "left",
      gameNumber: 1,
      winnerScore: 5,
      loserScore: 3,
      isGamePoint: false,
      isMatchPoint: false,
    });
    assertGoldenParse(BadmintonEventType.MATCH_STARTED, DOUBLES_START as Record<string, unknown>);
  });

  it("rejects invalid payloads identically", () => {
    assertGoldenParse(BadmintonEventType.POINT_WON, {});
    assertGoldenParse(BadmintonEventType.MATCH_STARTED, { matchKind: "invalid" });
  });
});
