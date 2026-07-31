import { describe, expect, it } from "vitest";
import {
  BadmintonEventType,
  canCorrectToss,
  cmdAwardPoint,
  cmdCorrectToss,
  cmdStartMatch,
  reduceBadminton,
  createInitialBadmintonState,
  type BadmintonMatchStartedPayload,
  type BadmintonMatchState,
  type CommandEvent,
} from "../index";

const START: BadmintonMatchStartedPayload = {
  matchKind: "singles",
  format: {
    totalGames: 3,
    pointsPerGame: 21,
    deuceAt: 20,
    maxPoints: 30,
    midGameSideChange: true,
  },
  leftSide: {
    label: "Player A",
    shortLabel: "A",
    playerIds: [1],
  },
  rightSide: {
    label: "Player B",
    shortLabel: "B",
    playerIds: [2],
  },
  firstServer: "left",
};

function apply(state: BadmintonMatchState, events: CommandEvent[]): BadmintonMatchState {
  let next = state;
  let seq = state.lastSequence ?? 0;
  for (const event of events) {
    seq += 1;
    next = reduceBadminton(next, {
      matchId: 1,
      tournamentId: 1,
      sportSlug: "badminton",
      eventType: event.eventType,
      eventVersion: 1,
      sequence: seq,
      actorType: "scorer",
      payload: event.payload,
    });
    next = { ...next, lastSequence: seq };
  }
  return next;
}

describe("cmdCorrectToss", () => {
  it("allows correcting toss and swapping ends at 0–0", () => {
    let state = createInitialBadmintonState({
      matchId: 1,
      tournamentId: 1,
      matchKind: "singles",
    });
    const started = cmdStartMatch(state, START);
    expect(started.ok).toBe(true);
    if (!started.ok) throw new Error("start failed");
    state = apply(state, started.events);
    expect(canCorrectToss(state)).toBe(true);
    expect(state.servingSide).toBe("left");

    const corrected = cmdCorrectToss(state, {
      leftSide: START.rightSide,
      rightSide: START.leftSide,
      firstServer: "right",
      endsSwapped: true,
    });
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) throw new Error("correct failed");
    expect(corrected.events[0]?.eventType).toBe(BadmintonEventType.TOSS_CORRECTED);

    state = apply(state, corrected.events);
    expect(state.leftSide.label).toBe("Player B");
    expect(state.rightSide.label).toBe("Player A");
    expect(state.servingSide).toBe("right");
    expect(canCorrectToss(state)).toBe(true);
  });

  it("blocks toss edit after a point is scored", () => {
    let state = createInitialBadmintonState({
      matchId: 1,
      tournamentId: 1,
      matchKind: "singles",
    });
    const started = cmdStartMatch(state, START);
    if (!started.ok) throw new Error("start failed");
    state = apply(state, started.events);

    const point = cmdAwardPoint(state, "left");
    expect(point.ok).toBe(true);
    if (!point.ok) throw new Error("point failed");
    state = apply(state, point.events);

    expect(state.totalRallies).toBeGreaterThan(0);
    expect(canCorrectToss(state)).toBe(false);
    const blocked = cmdCorrectToss(state, {
      leftSide: START.leftSide,
      rightSide: START.rightSide,
      firstServer: "right",
      endsSwapped: false,
    });
    expect(blocked.ok).toBe(false);
  });
});
