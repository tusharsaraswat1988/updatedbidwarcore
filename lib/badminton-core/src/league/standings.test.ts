import { describe, expect, it } from "vitest";
import {
  marginPointsFromWonGames,
  buildPairStandingsFromMatches,
  effectiveWinnerMarginPoints,
  comparePairStandings,
} from "./standings";
import type { BadmintonGameState } from "../types";

function completedGame(
  leftScore: number,
  rightScore: number,
  winner: "left" | "right",
): BadmintonGameState {
  return {
    gameNumber: 1,
    leftScore,
    rightScore,
    servingSide: "left",
    intervalReached: false,
    phase: "completed",
    winner,
  };
}

describe("marginPointsFromWonGames", () => {
  it("sums rally margins from won games only", () => {
    const games: BadmintonGameState[] = [
      {
        gameNumber: 1,
        leftScore: 21,
        rightScore: 15,
        servingSide: "left",
        intervalReached: false,
        phase: "completed",
        winner: "left",
      },
      {
        gameNumber: 2,
        leftScore: 21,
        rightScore: 18,
        servingSide: "left",
        intervalReached: false,
        phase: "completed",
        winner: "left",
      },
    ];
    expect(marginPointsFromWonGames(games, "left")).toBe(9);
    expect(marginPointsFromWonGames(games, "right")).toBe(0);
  });
});

describe("comparePairStandings", () => {
  it("ranks wins before margin points", () => {
    expect(
      comparePairStandings(
        { registrationId: 1, won: 1, marginPoints: 20 },
        { registrationId: 2, won: 2, marginPoints: 4 },
      ),
    ).toBeGreaterThan(0);
  });
});

describe("buildPairStandingsFromMatches", () => {
  it("ranks pairs by wins then margin points", () => {
    const standings = buildPairStandingsFromMatches([1, 2, 3], [
      {
        matchId: 1,
        registrationAId: 1,
        registrationBId: 2,
        winnerRegistrationId: 1,
        games: [completedGame(15, 10, "left")],
        status: "completed",
      },
      {
        matchId: 2,
        registrationAId: 1,
        registrationBId: 3,
        winnerRegistrationId: 1,
        games: [completedGame(15, 12, "left")],
        status: "completed",
      },
      {
        matchId: 3,
        registrationAId: 2,
        registrationBId: 3,
        winnerRegistrationId: 2,
        games: [completedGame(15, 5, "left")],
        status: "completed",
      },
    ]);

    // Pair 1: 2 wins, margin 5+3=8 — ranks above pair 2 with 1 win / margin 10
    expect(standings.map((s) => s.registrationId)).toEqual([1, 2, 3]);
    expect(standings[0]?.won).toBe(2);
    expect(standings[0]?.marginPoints).toBe(8);
    expect(standings[1]?.won).toBe(1);
    expect(standings[1]?.marginPoints).toBe(10);
  });

  it("uses assignedMarginPoints when no completed games", () => {
    expect(effectiveWinnerMarginPoints([], "left", 21)).toBe(21);

    const standings = buildPairStandingsFromMatches([1, 2], [
      {
        matchId: 10,
        registrationAId: 1,
        registrationBId: 2,
        winnerRegistrationId: 1,
        games: [],
        status: "walkover",
        assignedMarginPoints: 21,
      },
    ]);

    expect(standings[0]?.registrationId).toBe(1);
    expect(standings[0]?.marginPoints).toBe(21);
    expect(standings[0]?.won).toBe(1);
  });
});
