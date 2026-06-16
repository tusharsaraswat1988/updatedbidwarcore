import { describe, expect, it } from "vitest";
import {
  advanceDoublesServeAfterPoint,
  buildInitialCourtPositions,
  receiverIndexForServer,
  serverIndexForScore,
  swapSidePartners,
} from "./doubles-court";
import { replayBadmintonEvents } from "../reducer/reducer";
import { cmdAwardPoint } from "../commands";
import type { BadmintonEventEnvelope, BadmintonMatchMeta } from "../types";
import { STANDARD_FORMAT } from "../types";
import type { BadmintonMatchStartedPayload } from "../events/badminton";
import { BadmintonEventType } from "../events/badminton";

const leftSide = {
  label: "Abhinav / Ankit",
  shortLabel: "A/A",
  playerIds: [1, 2],
  players: [
    { label: "Abhinav", shortLabel: "Abhinav" },
    { label: "Ankit", shortLabel: "Ankit" },
  ],
};

const rightSide = {
  label: "Priyank / Saumya",
  shortLabel: "P/S",
  playerIds: [3, 4],
  players: [
    { label: "Priyank", shortLabel: "Priyank" },
    { label: "Saumya", shortLabel: "Saumya" },
  ],
};

const doublesStartPayload: BadmintonMatchStartedPayload = {
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

describe("doubles court rotation", () => {
  it("places first server in right court at 0-0", () => {
    const court = buildInitialCourtPositions("left", 0, "right", 0);
    expect(court.left.rightCourtPlayerIndex).toBe(0);
    expect(serverIndexForScore(0, court.left)).toBe(0);
  });

  it("keeps same server after serving side wins (partners swap)", () => {
    const court = buildInitialCourtPositions("left", 0, "right", 0);
    const after = advanceDoublesServeAfterPoint("left", "left", 1, 0, court);
    expect(after.servingSide).toBe("left");
    expect(after.servingPlayerIndex).toBe(0);
    expect(after.servingPlayerIndex).toBe(serverIndexForScore(1, after.courtPositions.left));
  });

  it("transfers serve when receiving side wins", () => {
    const court = buildInitialCourtPositions("left", 0, "right", 0);
    const after = advanceDoublesServeAfterPoint("right", "left", 0, 1, court);
    expect(after.servingSide).toBe("right");
    expect(after.servingPlayerIndex).toBe(serverIndexForScore(1, after.courtPositions.right));
  });

  it("swaps partners on old serving side when receiving side wins", () => {
    const court = buildInitialCourtPositions("left", 0, "right", 0);
    const beforeLeft = court.left.rightCourtPlayerIndex;
    const after = advanceDoublesServeAfterPoint("right", "left", 0, 1, court);
    expect(after.courtPositions.left.rightCourtPlayerIndex).toBe(
      swapSidePartners({ rightCourtPlayerIndex: beforeLeft }).rightCourtPlayerIndex,
    );
  });

  it("receiver is always diagonal to server", () => {
    const court = buildInitialCourtPositions("left", 1, "right", 0);
    const serverIdx = serverIndexForScore(0, court.left);
    const recvIdx = receiverIndexForServer(serverIdx, court.left, court.right);
    expect(recvIdx).toBe(0);
  });
});

describe("doubles scoring replay", () => {
  const meta: BadmintonMatchMeta = {
    matchId: 1,
    tournamentId: 1,
    matchKind: "doubles",
    format: STANDARD_FORMAT,
  };

  function replay(events: BadmintonEventEnvelope[]) {
    return replayBadmintonEvents(meta, events);
  }

  it("starts with correct player-level serve state", () => {
    const state = replay([
      {
        matchId: 1,
        tournamentId: 1,
        sportSlug: "badminton",
        eventType: BadmintonEventType.MATCH_STARTED,
        eventVersion: 1,
        sequence: 1,
        actorType: "system",
        payload: doublesStartPayload,
      },
    ]);

    expect(state.doublesServe?.servingSide).toBe("left");
    expect(state.doublesServe?.servingPlayerIndex).toBe(0);
    expect(state.doublesServe?.receivingSide).toBe("right");
  });

  it("advances serve state through a rally sequence", () => {
    let events: BadmintonEventEnvelope[] = [
      {
        matchId: 1,
        tournamentId: 1,
        sportSlug: "badminton",
        eventType: BadmintonEventType.MATCH_STARTED,
        eventVersion: 1,
        sequence: 1,
        actorType: "system",
        payload: doublesStartPayload,
      },
    ];

    let state = replay(events);
    const pointResult = cmdAwardPoint(state, "left");
    expect(pointResult.ok).toBe(true);
    if (!pointResult.ok) return;

    events = [
      ...events,
      ...pointResult.events.map((e: { eventType: string; payload: Record<string, unknown> }, i: number) => ({
        matchId: 1,
        tournamentId: 1,
        sportSlug: "badminton" as const,
        eventType: e.eventType,
        eventVersion: 1,
        sequence: 2 + i,
        actorType: "system" as const,
        payload: e.payload,
      })),
    ];

    state = replay(events);
    expect(state.leftScore).toBe(1);
    expect(state.doublesServe?.servingSide).toBe("left");
    expect(state.doublesServe?.servingPlayerIndex).toBe(0);
  });
});
