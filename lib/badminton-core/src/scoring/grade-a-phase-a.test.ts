/**
 * Grade A Phase A — derive-on-replay must match legacy payload snapshots.
 */

import { describe, expect, it } from "vitest";
import { cmdAwardPoint } from "../commands";
import { BadmintonEventType, type BadmintonMatchStartedPayload } from "../events/badminton";
import { replayBadmintonEvents, reduceBadminton } from "../reducer/reducer";
import type { BadmintonEventEnvelope, BadmintonMatchMeta, BadmintonMatchState } from "../types";
import { STANDARD_FORMAT } from "../types";
import {
  deriveDoublesServeAfterPointWon,
  doublesServeToPointSnapshot,
  setDoublesServeDriftWarningHandler,
} from "../scoring/doubles-replay-derive";
import { buildAllSequences, simulateSequence } from "./doubles-rally-simulation.test";

const leftSide = {
  label: "A1 / A2",
  shortLabel: "A",
  playerIds: [1, 2],
  players: [
    { label: "A1", shortLabel: "A1" },
    { label: "A2", shortLabel: "A2" },
  ],
};

const rightSide = {
  label: "B1 / B2",
  shortLabel: "B",
  playerIds: [3, 4],
  players: [
    { label: "B1", shortLabel: "B1" },
    { label: "B2", shortLabel: "B2" },
  ],
};

const MATCH_START: BadmintonMatchStartedPayload = {
  matchKind: "doubles",
  format: STANDARD_FORMAT,
  leftSide,
  rightSide,
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

const META: BadmintonMatchMeta = {
  matchId: 1,
  tournamentId: 1,
  matchKind: "doubles",
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

describe("Grade A Phase A — derive on replay", () => {
  it("derives serve state matching payload for every rally in simulation sequences", () => {
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
            doublesServe?: ReturnType<typeof doublesServeToPointSnapshot>;
          };

          const derived = deriveDoublesServeAfterPointWon(state, {
            winningSide: payload.winningSide,
            gameNumber: state.currentGame,
            winnerScore: 0,
            loserScore: 0,
            isGamePoint: false,
            isMatchPoint: false,
            doublesServe: payload.doublesServe,
          });

          expect(derived).not.toBeNull();
          if (derived && payload.doublesServe) {
            expect(doublesServeToPointSnapshot(derived)).toEqual(payload.doublesServe);
            checked++;
          }

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

  it("full replay matches incremental reduce for legacy events with doublesServe payloads", () => {
    const result = simulateSequence("phase-a-spot", "spot check", [
      "left",
      "left",
      "right",
      "right",
      "left",
    ] as const);

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
    expect(fromReplay.doublesServe).toEqual(incremental.doublesServe);
  });

  it("derives correctly from winningSide-only payload (no stored doublesServe)", () => {
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
    events[1] = {
      ...events[1]!,
      payload: fullPayload,
    };
    const fullState = replay(events);

    expect(slimState.doublesServe).toEqual(fullState.doublesServe);
    expect(slimState.leftScore).toBe(fullState.leftScore);
  });

  it("logs drift warning but still applies derived state when payload mismatches", () => {
    let events = startEvents();
    let state = replay(events);

    const cmd = cmdAwardPoint(state, "left");
    expect(cmd.ok).toBe(true);
    if (!cmd.ok) return;

    const corrupted = {
      ...(cmd.events[0]!.payload as Record<string, unknown>),
      doublesServe: {
        servingSide: "right",
        servingPlayerIndex: 1,
        receivingSide: "left",
        receivingPlayerIndex: 0,
        courtPositions: {
          left: { rightCourtPlayerIndex: 0 },
          right: { rightCourtPlayerIndex: 1 },
        },
      },
    };

    const warnings: string[] = [];
    setDoublesServeDriftWarningHandler((msg) => warnings.push(msg));

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
    setDoublesServeDriftWarningHandler(null);

    expect(warnings.length).toBe(1);
    expect(replayed.doublesServe?.servingSide).toBe("left");
    expect(replayed.leftScore).toBe(1);
  });

  it("derives doubles scores on replay so a stale 1-0 payload cannot rewind 3-0", () => {
    let state = replay(startEvents());
    const events = startEvents();

    for (let i = 0; i < 3; i++) {
      const cmd = cmdAwardPoint(state, "left");
      expect(cmd.ok).toBe(true);
      if (!cmd.ok) return;
      const point = cmd.events.find((e) => e.eventType === BadmintonEventType.POINT_WON)!;
      events.push({
        matchId: 1,
        tournamentId: 1,
        sportSlug: "badminton",
        eventType: BadmintonEventType.POINT_WON,
        eventVersion: 1,
        sequence: events.length + 1,
        actorType: "system",
        payload: point.payload,
      });
      state = replay(events);
    }

    expect(state.leftScore).toBe(3);
    expect(state.rightScore).toBe(0);

    // Poisoned event: winningSide correct, but payload scores rewound to 1-0
    // (what a stale snapshot prior used to emit).
    events.push({
      matchId: 1,
      tournamentId: 1,
      sportSlug: "badminton",
      eventType: BadmintonEventType.POINT_WON,
      eventVersion: 1,
      sequence: events.length + 1,
      actorType: "system",
      payload: {
        winningSide: "left",
        gameNumber: 1,
        winnerScore: 1,
        loserScore: 0,
        isGamePoint: false,
        isMatchPoint: false,
      },
    });

    const warnings: string[] = [];
    setDoublesServeDriftWarningHandler((msg) => warnings.push(msg));
    const healed = replay(events);
    setDoublesServeDriftWarningHandler(null);

    expect(healed.leftScore).toBe(4);
    expect(healed.rightScore).toBe(0);
    expect(healed.totalRallies).toBe(4);
    expect(warnings.some((w) => w.includes("score derived"))).toBe(true);
  });
});
