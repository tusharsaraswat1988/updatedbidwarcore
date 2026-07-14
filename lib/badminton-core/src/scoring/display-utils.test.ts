import { describe, expect, it } from "vitest";
import type { BadmintonMatchState } from "../types";
import { STANDARD_FORMAT } from "../types";
import { getCourtQuadrantPlayers } from "./display-utils";
import type { DoublesServeState } from "./types";

function side(label: string, shortA: string, shortB: string) {
  return {
    label,
    shortLabel: `${shortA} / ${shortB}`,
    playerIds: [1, 2],
    players: [
      { label: `${label} P0`, shortLabel: shortA },
      { label: `${label} P1`, shortLabel: shortB },
    ],
  };
}

function baseState(doublesServe: DoublesServeState): BadmintonMatchState {
  return {
    matchId: 1,
    tournamentId: 1,
    matchKind: "doubles",
    matchStatus: "live",
    format: STANDARD_FORMAT,
    leftSide: side("Left", "L0", "L1"),
    rightSide: side("Right", "R0", "R1"),
    currentGame: 1,
    leftScore: 0,
    rightScore: 0,
    gamesLeft: 0,
    gamesRight: 0,
    games: [],
    servingSide: doublesServe.servingSide,
    doublesServe,
    inInterval: false,
    activeTimeout: null,
    isPaused: false,
    matchNotes: [],
    totalRallies: 0,
    lastSequence: 1,
  };
}

describe("getCourtQuadrantPlayers", () => {
  it("places serve and receive diagonally at 0-0 (both in right court from own perspective)", () => {
    const ds: DoublesServeState = {
      servingSide: "left",
      servingPlayerIndex: 0,
      receivingSide: "right",
      receivingPlayerIndex: 0,
      firstServingSide: "left",
      firstServerPlayerIndex: 0,
      firstReceivingSide: "right",
      firstReceiverPlayerIndex: 0,
      courtPositions: {
        left: { rightCourtPlayerIndex: 0 },
        right: { rightCourtPlayerIndex: 0 },
      },
    };

    const court = getCourtQuadrantPlayers(baseState(ds));
    expect(court).not.toBeNull();
    // Left side facing down: their right court → top-right
    expect(court!.topRight.isServer).toBe(true);
    expect(court!.topRight.label).toBe("L0");
    // Right side facing up: their right court → bottom-left (flipped onto screen)
    expect(court!.bottomLeft.isReceiver).toBe(true);
    expect(court!.bottomLeft.label).toBe("R0");
    // Same column would be wrong — must be diagonal
    expect(court!.topRight.isServer && court!.bottomRight.isReceiver).toBe(false);
  });

  it("places serve and receive diagonally on odd score (both in left court from own perspective)", () => {
    const ds: DoublesServeState = {
      servingSide: "left",
      servingPlayerIndex: 1,
      receivingSide: "right",
      receivingPlayerIndex: 1,
      firstServingSide: "left",
      firstServerPlayerIndex: 0,
      firstReceivingSide: "right",
      firstReceiverPlayerIndex: 0,
      courtPositions: {
        left: { rightCourtPlayerIndex: 0 }, // P1 in left court
        right: { rightCourtPlayerIndex: 0 }, // P1 in left court
      },
    };

    const court = getCourtQuadrantPlayers(baseState(ds));
    expect(court).not.toBeNull();
    expect(court!.topLeft.isServer).toBe(true);
    expect(court!.topLeft.label).toBe("L1");
    expect(court!.bottomRight.isReceiver).toBe(true);
    expect(court!.bottomRight.label).toBe("R1");
  });
});
