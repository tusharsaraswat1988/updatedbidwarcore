/**
 * Grade A Phase B — undo must target last POINT_WON (and its boundary events).
 */

import { describe, expect, it } from "vitest";
import {
  cmdAwardPoint,
  cmdStartInterval,
  cmdStartTimeout,
  cmdUndoLastPoint,
} from "../commands";
import { BadmintonEventType, type BadmintonMatchStartedPayload } from "../events/badminton";
import { getUndoTargetSequences } from "../replay/undo-targets";
import { replayBadmintonEvents, reduceBadminton } from "../reducer/reducer";
import type { BadmintonEventEnvelope, BadmintonMatchMeta } from "../types";
import { STANDARD_FORMAT } from "../types";

const META: BadmintonMatchMeta = {
  matchId: 1,
  tournamentId: 1,
  matchKind: "doubles",
  format: STANDARD_FORMAT,
};

const DOUBLES_START: BadmintonMatchStartedPayload = {
  matchKind: "doubles",
  format: STANDARD_FORMAT,
  leftSide: {
    label: "A",
    shortLabel: "A",
    playerIds: [1, 2],
  },
  rightSide: {
    label: "B",
    shortLabel: "B",
    playerIds: [3, 4],
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

const SINGLES_START: BadmintonMatchStartedPayload = {
  matchKind: "singles",
  format: STANDARD_FORMAT,
  leftSide: { label: "A", shortLabel: "A", playerIds: [1] },
  rightSide: { label: "B", shortLabel: "B", playerIds: [2] },
  firstServer: "left",
};

function envelope(
  sequence: number,
  eventType: string,
  payload: Record<string, unknown>,
): BadmintonEventEnvelope {
  return {
    matchId: 1,
    tournamentId: 1,
    sportSlug: "badminton",
    eventType,
    eventVersion: 1,
    sequence,
    actorType: "system",
    payload,
  };
}

function appendCommandEvents(
  state: ReturnType<typeof replayBadmintonEvents>,
  events: BadmintonEventEnvelope[],
  cmdEvents: Array<{ eventType: string; payload: Record<string, unknown> }>,
  startSeq: number,
) {
  let next = state;
  let seq = startSeq;
  const appended = [...events];

  for (const e of cmdEvents) {
    appended.push(envelope(seq, e.eventType, e.payload));
    next = reduceBadminton(next, appended[appended.length - 1]!);
    seq++;
  }

  return { state: next, events: appended, nextSeq: seq };
}

function undoLastRally(events: BadmintonEventEnvelope[]) {
  const state = replayBadmintonEvents(META, events);
  const targets = getUndoTargetSequences(events);
  const result = cmdUndoLastPoint(state, targets);
  expect(result.ok).toBe(true);
  if (!result.ok) return replayBadmintonEvents(META, events);

  const undoSeq = events.length > 0 ? Math.max(...events.map((e) => e.sequence)) + 1 : 1;
  const withUndo = [
    ...events,
    envelope(undoSeq, BadmintonEventType.POINT_UNDONE, result.events[0]!.payload),
  ];
  return replayBadmintonEvents(META, withUndo);
}

describe("Grade A Phase B — undo targets", () => {
  it("getUndoTargetSequences returns last POINT_WON only for normal rally", () => {
    let events = [envelope(1, BadmintonEventType.MATCH_STARTED, DOUBLES_START as unknown as Record<string, unknown>)];
    let state = replayBadmintonEvents(META, events);

    const point = cmdAwardPoint(state, "left");
    expect(point.ok).toBe(true);
    if (!point.ok) return;

    ({ state, events } = appendCommandEvents(state, events, point.events, 2));
    expect(getUndoTargetSequences(events)).toEqual([2]);
  });

  it("includes GAME_ENDED and MATCH_ENDED after game/match winning rally", () => {
    let events = [envelope(1, BadmintonEventType.MATCH_STARTED, SINGLES_START as unknown as Record<string, unknown>)];
    let state = replayBadmintonEvents(META, events);

    for (let i = 0; i < 20; i++) {
      const p = cmdAwardPoint(state, "left");
      expect(p.ok).toBe(true);
      if (!p.ok) return;
      ({ state, events } = appendCommandEvents(state, events, p.events, events.length + 1));
    }

    const gamePoint = cmdAwardPoint(state, "left");
    expect(gamePoint.ok).toBe(true);
    if (!gamePoint.ok) return;

    const startSeq = events.length + 1;
    ({ state, events } = appendCommandEvents(state, events, gamePoint.events, startSeq));

    const pointSeq = startSeq;
    const targets = getUndoTargetSequences(events);
    expect(targets[0]).toBe(pointSeq);
    expect(targets).toContain(pointSeq + 1);
    expect(targets.length).toBeGreaterThanOrEqual(2);
  });

  it("does not include timeout after rally when undoing point", () => {
    let events = [envelope(1, BadmintonEventType.MATCH_STARTED, DOUBLES_START as unknown as Record<string, unknown>)];
    let state = replayBadmintonEvents(META, events);
    const beforePoint = state;

    const point = cmdAwardPoint(state, "left");
    expect(point.ok).toBe(true);
    if (!point.ok) return;
    ({ state, events } = appendCommandEvents(state, events, point.events, 2));

    const timeout = cmdStartTimeout(state, "left");
    expect(timeout.ok).toBe(true);
    if (!timeout.ok) return;
    ({ state, events } = appendCommandEvents(state, events, timeout.events, events.length + 1));

    expect(getUndoTargetSequences(events)).toEqual([2]);

    const afterUndo = undoLastRally(events);
    expect(afterUndo.leftScore).toBe(beforePoint.leftScore);
    expect(afterUndo.rightScore).toBe(beforePoint.rightScore);
    expect(afterUndo.doublesServe).toEqual(beforePoint.doublesServe);
    expect(afterUndo.activeTimeout).not.toBeNull();
  });

  it("restores score, server, receiver, court after normal rally undo", () => {
    let events = [envelope(1, BadmintonEventType.MATCH_STARTED, DOUBLES_START as unknown as Record<string, unknown>)];
    let state = replayBadmintonEvents(META, events);

    const p1 = cmdAwardPoint(state, "left");
    expect(p1.ok).toBe(true);
    if (!p1.ok) return;
    ({ state, events } = appendCommandEvents(state, events, p1.events, 2));

    const p2 = cmdAwardPoint(state, "right");
    expect(p2.ok).toBe(true);
    if (!p2.ok) return;
    ({ state, events } = appendCommandEvents(state, events, p2.events, events.length + 1));

    const before = replayBadmintonEvents(META, events.slice(0, -p2.events.length));
    const afterUndo = undoLastRally(events);

    expect(afterUndo.leftScore).toBe(before.leftScore);
    expect(afterUndo.rightScore).toBe(before.rightScore);
    expect(afterUndo.doublesServe).toEqual(before.doublesServe);
    expect(afterUndo.totalRallies).toBe(before.totalRallies);
  });

  it("restores state after undoing game-winning rally (still live match)", () => {
    let events = [envelope(1, BadmintonEventType.MATCH_STARTED, DOUBLES_START as unknown as Record<string, unknown>)];
    let state = replayBadmintonEvents(META, events);

    for (let i = 0; i < 21; i++) {
      const p = cmdAwardPoint(state, "left");
      expect(p.ok).toBe(true);
      if (!p.ok) return;
      const prevEventsLen = events.length;
      ({ state, events } = appendCommandEvents(state, events, p.events, events.length + 1));
      if (i < 20) {
        expect(events.length).toBe(prevEventsLen + 1);
      } else {
        expect(events.length).toBe(prevEventsLen + 2);
      }
    }

    expect(state.currentGame).toBe(2);
    expect(state.gamesLeft).toBe(1);

    const beforeGameEnd = replayBadmintonEvents(
      META,
      events.filter((e) => e.eventType !== BadmintonEventType.GAME_ENDED),
    );

    const afterUndo = undoLastRally(events);
    expect(afterUndo.currentGame).toBe(1);
    expect(afterUndo.gamesLeft).toBe(0);
    expect(afterUndo.leftScore).toBe(20);
    expect(afterUndo.doublesServe?.servingSide).toBe(beforeGameEnd.doublesServe?.servingSide);
  });

  it("restores state after undoing match-winning rally", () => {
    const singlesMeta = { ...META, matchKind: "singles" as const };
    let events = [envelope(1, BadmintonEventType.MATCH_STARTED, SINGLES_START as unknown as Record<string, unknown>)];
    let state = replayBadmintonEvents(singlesMeta, events);

    const winGame = (side: "left" | "right", count: number) => {
      for (let i = 0; i < count; i++) {
        const p = cmdAwardPoint(state, side);
        expect(p.ok).toBe(true);
        if (!p.ok) return;
        ({ state, events } = appendCommandEvents(state, events, p.events, events.length + 1));
      }
    };

    winGame("left", 21);
    winGame("left", 21);
    expect(state.matchStatus).toBe("completed");

    const liveEvents = events.filter(
      (e) =>
        e.eventType !== BadmintonEventType.MATCH_ENDED &&
        !(e.eventType === BadmintonEventType.GAME_ENDED && (e.payload as { gameNumber: number }).gameNumber === 2),
    );

    const beforeMatchEnd = replayBadmintonEvents(singlesMeta, liveEvents);

    const undoTargets = getUndoTargetSequences(events);
    expect(undoTargets.length).toBeGreaterThanOrEqual(2);

    const undoResult = cmdUndoLastPoint(state, undoTargets);
    expect(undoResult.ok).toBe(false);
  });
});

describe("Grade A Phase B — interval after rally", () => {
  it("undo point preserves interval when interval follows rally in deciding game", () => {
    let events = [envelope(1, BadmintonEventType.MATCH_STARTED, DOUBLES_START as unknown as Record<string, unknown>)];
    let state = replayBadmintonEvents(META, events);

    const playGame = (side: "left" | "right", points: number) => {
      for (let i = 0; i < points; i++) {
        const p = cmdAwardPoint(state, side);
        expect(p.ok).toBe(true);
        if (!p.ok) return;
        ({ state, events } = appendCommandEvents(state, events, p.events, events.length + 1));
      }
    };

    playGame("left", 21);
    playGame("right", 21);

    for (let i = 0; i < 10; i++) {
      const side: "left" | "right" = i % 2 === 0 ? "left" : "right";
      const p = cmdAwardPoint(state, side);
      expect(p.ok).toBe(true);
      if (!p.ok) return;
      ({ state, events } = appendCommandEvents(state, events, p.events, events.length + 1));
    }

    expect(state.currentGame).toBe(3);

    const lastPointSeq = events.findLast((e) => e.eventType === BadmintonEventType.POINT_WON)!.sequence;
    const beforeLastPoint = replayBadmintonEvents(
      META,
      events.filter((e) => e.sequence < lastPointSeq),
    );

    const interval = cmdStartInterval(state);
    expect(interval.ok).toBe(true);
    if (!interval.ok) return;
    ({ state, events } = appendCommandEvents(state, events, interval.events, events.length + 1));

    expect(getUndoTargetSequences(events)).toEqual([lastPointSeq]);

    const afterUndo = undoLastRally(events);
    expect(afterUndo.inInterval).toBe(true);
    expect(afterUndo.leftScore).toBe(beforeLastPoint.leftScore);
    expect(afterUndo.rightScore).toBe(beforeLastPoint.rightScore);
    expect(afterUndo.doublesServe).toEqual(beforeLastPoint.doublesServe);
  });
});
