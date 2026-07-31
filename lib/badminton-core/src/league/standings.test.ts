import { describe, expect, it } from "vitest";
import {
  marginPointsFromWonGames,
  buildPairStandingsFromMatches,
  effectiveWinnerMarginPoints,
} from "./standings";
import type { BadmintonGameState } from "../types";

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

describe("buildPairStandingsFromMatches", () => {
  it("ranks pairs by margin points", () => {
    const standings = buildPairStandingsFromMatches([1, 2, 3], [
      {
        matchId: 1,
        registrationAId: 1,
        registrationBId: 2,
        winnerRegistrationId: 1,
        games: [
          {
            gameNumber: 1,
            leftScore: 21,
            rightScore: 10,
            servingSide: "left",
            intervalReached: false,
            phase: "completed",
            winner: "left",
          },
        ],
        status: "completed",
      },
      {
        matchId: 2,
        registrationAId: 2,
        registrationBId: 3,
        winnerRegistrationId: 3,
        games: [
          {
            gameNumber: 1,
            leftScore: 12,
            rightScore: 21,
            servingSide: "right",
            intervalReached: false,
            phase: "completed",
            winner: "right",
          },
        ],
        status: "completed",
      },
    ]);

    expect(standings[0]?.registrationId).toBe(1);
    expect(standings[0]?.marginPoints).toBe(11);
    expect(standings[0]?.won).toBe(1);
    expect(standings.find((s) => s.registrationId === 2)?.lost).toBe(2);
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
