/**
 * Grade A Phase A (singles) — derive-on-replay must match legacy payload scores.
 */

import { describe, expect, it } from "vitest";
import { cmdAwardPoint } from "../commands";
import { BadmintonEventType, type BadmintonMatchStartedPayload } from "../events/badminton";
import { replayBadmintonEvents, reduceBadminton } from "../reducer/reducer";
import type { BadmintonEventEnvelope, BadmintonMatchMeta } from "../types";
import { STANDARD_FORMAT } from "../types";
import {
  deriveSinglesScoresAfterPointWon,
  setSinglesScoreDriftWarningHandler,
} from "./singles-replay-derive";
import { buildAllSequences, simulateSequence } from "./singles-rally-simulation.test";

const MATCH_START: BadmintonMatchStartedPayload = {
  matchKind: "singles",
  format: STANDARD_FORMAT,
  leftSide: { label: "Player A", shortLabel: "A", playerIds: [1] },
  rightSide: { label: "Player B", shortLabel: "B", playerIds: [2] },
  firstServer: "left",
};

const META: BadmintonMatchMeta = {
  matchId: 1,
  tournamentId: 1,
  matchKind: "singles",
  format: STANDARD_FORMAT,
};

function startEvents(): BadmintonEventEnvelope[] {
  return [
    {
      matchId: 1,
      tournamentId: 1,
      sportSlug: "badminton",
      eventType: BadmintonEventType.MATCH_STARTED,
      eventVersion: 1,
      sequence: 1,
      actorType: "system",
      payload: MATCH_START,
    },
  ];
}

function replay(events: BadmintonEventEnvelope[]) {
  return replayBadmintonEvents(META, events);
}

describe("Grade A Phase A (singles) — derive on replay", () => {
  it("derives scores matching payload for every rally in simulation sequences", () => {
    const sequences = buildAllSequences().slice(0, 20);
    let checked = 0;

    for (const seq of sequences) {
      let events = startEvents();
      let state = replay(events);
      let seqNum = 2;

      for (const winner of seq.winners) {
        const result = cmdAwardPoint(state, winner);
        expect(result.ok).toBe(true);
        if (!result.ok) continue;

        for (const e of result.events) {
          if (e.eventType !== BadmintonEventType.POINT_WON) {
            events.push({
              matchId: 1,
              tournamentId: 1,
              sportSlug: "badminton",
              eventType: e.eventType,
              eventVersion: 1,
              sequence: seqNum++,
              actorType: "system",
              payload: e.payload,
            });
            continue;
          }

          const payload = e.payload as {
            winningSide: "left" | "right";
            winnerScore: number;
            loserScore: number;
          };

          const derived = deriveSinglesScoresAfterPointWon(state, {
            winningSide: payload.winningSide,
            gameNumber: state.currentGame,
            winnerScore: payload.winnerScore,
            loserScore: payload.loserScore,
            isGamePoint: false,
            isMatchPoint: false,
          });

          const payloadLeft =
            payload.winningSide === "left" ? payload.winnerScore : payload.loserScore;
          const payloadRight =
            payload.winningSide === "right" ? payload.winnerScore : payload.loserScore;

          expect(derived.newLeftScore).toBe(payloadLeft);
          expect(derived.newRightScore).toBe(payloadRight);
          checked++;

          events.push({
            matchId: 1,
            tournamentId: 1,
            sportSlug: "badminton",
            eventType: BadmintonEventType.POINT_WON,
            eventVersion: 1,
            sequence: seqNum++,
            actorType: "system",
            payload: e.payload,
          });
        }

        state = replay(events);
        if (state.matchStatus !== "live") break;
      }
    }

    expect(checked).toBeGreaterThan(50);
  });

  it("full replay matches incremental reduce for legacy events with score payloads", () => {
    const result = simulateSequence("phase-a-spot", "spot check", [
      "left",
      "left",
      "right",
      "right",
      "left",
    ]);
    expect(result.passed).toBe(true);

    let events = startEvents();
    let incremental = replay(events);
    let seq = 2;

    for (const winner of ["left", "left", "right", "right", "left"] as const) {
      const cmd = cmdAwardPoint(incremental, winner);
      expect(cmd.ok).toBe(true);
      if (!cmd.ok) break;

      for (const e of cmd.events) {
        incremental = reduceBadminton(incremental, {
          matchId: 1,
          tournamentId: 1,
          sportSlug: "badminton",
          eventType: e.eventType,
          eventVersion: 1,
          sequence: seq,
          actorType: "system",
          payload: e.payload,
        });
        events = [
          ...events,
          {
            matchId: 1,
            tournamentId: 1,
            sportSlug: "badminton" as const,
            eventType: e.eventType,
            eventVersion: 1,
            sequence: seq,
            actorType: "system" as const,
            payload: e.payload,
          },
        ];
        seq++;
      }
    }

    const fromReplay = replay(events);
    expect(fromReplay.leftScore).toBe(incremental.leftScore);
    expect(fromReplay.rightScore).toBe(incremental.rightScore);
    expect(fromReplay.servingSide).toBe(incremental.servingSide);
  });

  it("derives correctly from slim payload without servingSide", () => {
    let events = startEvents();
    let state = replay(events);

    const cmd = cmdAwardPoint(state, "left");
    expect(cmd.ok).toBe(true);
    if (!cmd.ok) return;

    const fullPayload = cmd.events.find((e) => e.eventType === BadmintonEventType.POINT_WON)!
      .payload as Record<string, unknown>;

    const slimPayload = {
      winningSide: fullPayload.winningSide,
      gameNumber: fullPayload.gameNumber,
      winnerScore: fullPayload.winnerScore,
      loserScore: fullPayload.loserScore,
      isGamePoint: fullPayload.isGamePoint,
      isMatchPoint: fullPayload.isMatchPoint,
    };

    events.push({
      matchId: 1,
      tournamentId: 1,
      sportSlug: "badminton",
      eventType: BadmintonEventType.POINT_WON,
      eventVersion: 1,
      sequence: 2,
      actorType: "system",
      payload: slimPayload,
    });

    const slimState = replay(events);
    events[1] = { ...events[1]!, payload: fullPayload };
    const fullState = replay(events);

    expect(slimState.leftScore).toBe(fullState.leftScore);
    expect(slimState.rightScore).toBe(fullState.rightScore);
    expect(slimState.servingSide).toBe("left");
  });

  it("logs drift warning but still applies derived scores when payload mismatches", () => {
    let events = startEvents();
    let state = replay(events);

    const cmd = cmdAwardPoint(state, "left");
    expect(cmd.ok).toBe(true);
    if (!cmd.ok) return;

    const corrupted = {
      ...(cmd.events[0]!.payload as Record<string, unknown>),
      winnerScore: 99,
      loserScore: 0,
    };

    const warnings: string[] = [];
    setSinglesScoreDriftWarningHandler((msg) => warnings.push(msg));

    events.push({
      matchId: 1,
      tournamentId: 1,
      sportSlug: "badminton",
      eventType: BadmintonEventType.POINT_WON,
      eventVersion: 1,
      sequence: 2,
      actorType: "system",
      payload: corrupted,
    });

    const replayed = replay(events);
    setSinglesScoreDriftWarningHandler(null);

    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(replayed.leftScore).toBe(1);
    expect(replayed.rightScore).toBe(0);
    expect(replayed.servingSide).toBe("left");
  });
});
