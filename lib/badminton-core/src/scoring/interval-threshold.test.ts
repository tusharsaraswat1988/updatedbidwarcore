import { describe, expect, it } from "vitest";
import {
  cmdAwardPoint,
  cmdStartInterval,
  cmdStartMatch,
} from "../commands";
import { reduceBadminton } from "../reducer/reducer";
import { createInitialBadmintonState, sideChangeScore } from "../reducer/state";
import type { BadmintonMatchMeta, BadmintonMatchState, BadmintonSide } from "../types";
import { STANDARD_FORMAT } from "../types";
import type { BadmintonMatchStartedPayload } from "../events/badminton";
import { isIntervalDue } from "./umpire-assistance";

const META: BadmintonMatchMeta = {
  matchId: 1,
  tournamentId: 1,
  matchKind: "singles",
  format: STANDARD_FORMAT,
};

const START: BadmintonMatchStartedPayload = {
  matchKind: "singles",
  format: STANDARD_FORMAT,
  leftSide: { label: "A", shortLabel: "A", playerIds: [1] },
  rightSide: { label: "B", shortLabel: "B", playerIds: [2] },
  firstServer: "left",
};

function apply(
  state: BadmintonMatchState,
  events: { eventType: string; payload: Record<string, unknown> }[],
): BadmintonMatchState {
  let next = state;
  let seq = state.lastSequence;
  for (const event of events) {
    seq += 1;
    next = reduceBadminton(next, {
      matchId: META.matchId,
      tournamentId: META.tournamentId,
      sportSlug: "badminton",
      eventType: event.eventType,
      eventVersion: 1,
      sequence: seq,
      actorType: "scorer",
      payload: event.payload,
    });
  }
  return next;
}

function playTo(leftTarget: number, rightTarget: number, deciding = false): BadmintonMatchState {
  let state = createInitialBadmintonState(META);
  const start = cmdStartMatch(state, START);
  expect(start.ok).toBe(true);
  if (!start.ok) throw new Error("start failed");
  state = apply(state, start.events);

  if (deciding) {
    for (let i = 0; i < 21; i++) {
      const r = cmdAwardPoint(state, "left");
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error("point failed");
      state = apply(state, r.events);
    }
    for (let i = 0; i < 21; i++) {
      const r = cmdAwardPoint(state, "right");
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error("point failed");
      state = apply(state, r.events);
    }
  }

  while (state.leftScore < leftTarget || state.rightScore < rightTarget) {
    const side: BadmintonSide = state.leftScore < leftTarget ? "left" : "right";
    const r = cmdAwardPoint(state, side);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("point failed");
    state = apply(state, r.events);
  }
  return state;
}

describe("BWF deciding-game interval threshold", () => {
  it("uses 11 for standard 21-point games", () => {
    expect(sideChangeScore(21)).toBe(11);
    expect(sideChangeScore(15)).toBe(8);
  });

  it("is not due at 10-0 in deciding game", () => {
    const state = playTo(10, 0, true);
    expect(state.currentGame).toBe(3);
    expect(state.leftScore).toBe(10);
    expect(state.games[2]?.intervalReached).toBe(false);
    expect(isIntervalDue(state)).toBe(false);

    const early = cmdStartInterval(state);
    expect(early.ok).toBe(false);
  });

  it("is due at 11-0 in deciding game and blocks scoring during interval", () => {
    const state = playTo(11, 0, true);
    expect(state.currentGame).toBe(3);
    expect(state.leftScore).toBe(11);
    expect(state.games[2]?.intervalReached).toBe(true);
    expect(isIntervalDue(state)).toBe(true);

    const start = cmdStartInterval(state);
    expect(start.ok).toBe(true);
    if (!start.ok) throw new Error("interval start failed");
    const during = apply(state, start.events);
    expect(during.inInterval).toBe(true);

    const blocked = cmdAwardPoint(during, "left");
    expect(blocked.ok).toBe(false);
  });
});
