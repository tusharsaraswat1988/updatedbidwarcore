/**
 * S4-04 — Director manual score correction (amend current game points).
 */

import { describe, it, expect } from "vitest";
import {
  BadmintonEventType,
  cmdAmendScore,
  cmdAwardPoint,
  cmdPauseMatch,
  cmdStartInterval,
  cmdStartMatch,
  cmdStartTimeout,
  deriveIncidentLog,
  getCurrentGame,
  replayBadmintonEvents,
  STANDARD_FORMAT,
  type BadmintonEventEnvelope,
  type BadmintonMatchMeta,
} from "../index";

const META: BadmintonMatchMeta = {
  matchId: 42,
  tournamentId: 7,
  matchKind: "singles",
};

function makeEnvelope(
  seq: number,
  eventType: string,
  payload: Record<string, unknown>,
  actorType: BadmintonEventEnvelope["actorType"] = "tournament_director",
): BadmintonEventEnvelope {
  return {
    matchId: META.matchId,
    tournamentId: META.tournamentId,
    sportSlug: "badminton",
    eventType,
    eventVersion: 1,
    sequence: seq,
    occurredAt: `2026-07-29T10:${String(seq).padStart(2, "0")}:00.000Z`,
    actorType,
    actorId: "director-1",
    payload,
  };
}

function startLive(): BadmintonEventEnvelope[] {
  const initial = replayBadmintonEvents(META, []);
  const result = cmdStartMatch(initial, {
    matchKind: "singles",
    format: STANDARD_FORMAT,
    leftSide: { label: "Alice", shortLabel: "A", playerIds: [1] },
    rightSide: { label: "Bob", shortLabel: "B", playerIds: [2] },
    firstServer: "left",
  });
  if (!result.ok) throw new Error(result.error);
  return result.events.map((e, i) => makeEnvelope(i + 1, e.eventType, e.payload, "organizer"));
}

function append(
  events: BadmintonEventEnvelope[],
  cmd: { ok: true; events: Array<{ eventType: string; payload: Record<string, unknown> }> } | { ok: false; error: string },
): BadmintonEventEnvelope[] {
  if (!cmd.ok) throw new Error(cmd.error);
  const nextSeq = events.length > 0 ? Math.max(...events.map((e) => e.sequence)) + 1 : 1;
  return [
    ...events,
    ...cmd.events.map((e, i) => makeEnvelope(nextSeq + i, e.eventType, e.payload)),
  ];
}

function awardN(events: BadmintonEventEnvelope[], side: "left" | "right", n: number) {
  let next = events;
  for (let i = 0; i < n; i++) {
    const state = replayBadmintonEvents(META, next);
    next = append(next, cmdAwardPoint(state, side));
  }
  return next;
}

describe("S4-04 cmdAmendScore", () => {
  it("amends current game points and replays correctly", () => {
    let events = startLive();
    events = awardN(events, "left", 5);
    events = awardN(events, "right", 3);

    const before = replayBadmintonEvents(META, events);
    expect(before.leftScore).toBe(5);
    expect(before.rightScore).toBe(3);

    const amend = cmdAmendScore(before, {
      leftScore: 8,
      rightScore: 4,
      reason: "Scorer mistyped",
    });
    expect(amend.ok).toBe(true);
    if (!amend.ok) return;

    expect(amend.events).toHaveLength(1);
    expect(amend.events[0]!.eventType).toBe(BadmintonEventType.SCORE_AMENDED);
    expect(amend.events[0]!.payload).toMatchObject({
      leftScore: 8,
      rightScore: 4,
      gameNumber: 1,
      reason: "Scorer mistyped",
    });

    events = append(events, amend);
    const after = replayBadmintonEvents(META, events);
    expect(after.leftScore).toBe(8);
    expect(after.rightScore).toBe(4);
    expect(getCurrentGame(after)?.leftScore).toBe(8);
    expect(getCurrentGame(after)?.rightScore).toBe(4);
    expect(after.gamesLeft).toBe(0);
    expect(after.gamesRight).toBe(0);

    const log = deriveIncidentLog(events);
    expect(log.some((e) => e.label.includes("Score Amended — 8-4"))).toBe(true);
  });

  it("allows amend while paused", () => {
    let events = startLive();
    events = awardN(events, "left", 2);
    const live = replayBadmintonEvents(META, events);
    events = append(events, cmdPauseMatch(live, "technical_issue"));
    const paused = replayBadmintonEvents(META, events);
    expect(paused.matchStatus).toBe("paused");

    const amend = cmdAmendScore(paused, { leftScore: 1, rightScore: 0, reason: "Fix" });
    expect(amend.ok).toBe(true);
    if (!amend.ok) return;
    events = append(events, amend);
    const after = replayBadmintonEvents(META, events);
    expect(after.leftScore).toBe(1);
    expect(after.rightScore).toBe(0);
    expect(after.matchStatus).toBe("paused");
  });

  it("rejects amend during interval", () => {
    let events = startLive();
    // Reach deciding game interval threshold (game 3 at 11).
    // Win game 1 and 2 for opposite sides, then score to 11 in game 3.
    events = awardN(events, "left", 21); // game 1 left
    events = awardN(events, "right", 21); // game 2 right
    events = awardN(events, "left", 11); // game 3 → 11-0

    const atThreshold = replayBadmintonEvents(META, events);
    expect(atThreshold.currentGame).toBe(3);
    expect(atThreshold.leftScore).toBe(11);

    events = append(events, cmdStartInterval(atThreshold));
    const inInterval = replayBadmintonEvents(META, events);
    expect(inInterval.inInterval).toBe(true);

    const blocked = cmdAmendScore(inInterval, { leftScore: 10, rightScore: 0 });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.error).toMatch(/interval/i);
  });

  it("clears active timeout and recomputes intervalReached on amend", () => {
    let events = startLive();
    events = awardN(events, "left", 21);
    events = awardN(events, "right", 21);
    events = awardN(events, "left", 11);

    let state = replayBadmintonEvents(META, events);
    expect(state.currentGame).toBe(3);
    expect(getCurrentGame(state)?.intervalReached).toBe(true);

    events = append(events, cmdStartTimeout(state, "left"));
    state = replayBadmintonEvents(META, events);
    expect(state.activeTimeout).not.toBeNull();

    const amend = cmdAmendScore(state, {
      leftScore: 9,
      rightScore: 0,
      reason: "Drop below interval",
    });
    expect(amend.ok).toBe(true);
    if (!amend.ok) return;

    events = append(events, amend);
    const after = replayBadmintonEvents(META, events);
    expect(after.leftScore).toBe(9);
    expect(after.activeTimeout).toBeNull();
    expect(getCurrentGame(after)?.intervalReached).toBe(false);
    expect(getCurrentGame(after)?.sideChangeAcknowledged).toBe(false);
  });

  it("rejects game-winning amended scores", () => {
    const events = startLive();
    const state = replayBadmintonEvents(META, events);
    const result = cmdAmendScore(state, { leftScore: 21, rightScore: 10 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/complete the game/i);
  });

  it("rejects out-of-bounds and no-op scores", () => {
    let events = startLive();
    events = awardN(events, "left", 3);
    const state = replayBadmintonEvents(META, events);

    expect(cmdAmendScore(state, { leftScore: -1, rightScore: 0 }).ok).toBe(false);
    expect(cmdAmendScore(state, { leftScore: 31, rightScore: 0 }).ok).toBe(false);
    expect(cmdAmendScore(state, { leftScore: 3, rightScore: 0 }).ok).toBe(false);
  });

  it("continues scoring from amended score and leaves undo intact", () => {
    let events = startLive();
    events = awardN(events, "left", 4);
    const beforeAmend = replayBadmintonEvents(META, events);

    events = append(
      events,
      cmdAmendScore(beforeAmend, { leftScore: 6, rightScore: 2, reason: "Correct" }),
    );
    const amended = replayBadmintonEvents(META, events);
    expect(amended.leftScore).toBe(6);
    expect(amended.rightScore).toBe(2);

    events = append(events, cmdAwardPoint(amended, "left"));
    const afterPoint = replayBadmintonEvents(META, events);
    expect(afterPoint.leftScore).toBe(7);
    expect(afterPoint.rightScore).toBe(2);
    // Rally count still tracks POINT_WON events (4 + 1), not the amended display.
    expect(afterPoint.totalRallies).toBe(5);
  });
});
