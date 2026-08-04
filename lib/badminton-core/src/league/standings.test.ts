import { describe, expect, it } from "vitest";
import {
  marginPointsFromWonGames,
  buildPairStandingsFromMatches,
  effectiveWinnerMarginPoints,
  comparePairStandings,
  computeWinPercentage,
  rallyPointsForSide,
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
  it("ranks wins before margin points (unchanged)", () => {
    expect(
      comparePairStandings(
        { registrationId: 1, won: 1, marginPoints: 20 },
        { registrationId: 2, won: 2, marginPoints: 4 },
      ),
    ).toBeGreaterThan(0);
  });
});

describe("computeWinPercentage", () => {
  it("returns 0 when no matches played", () => {
    expect(computeWinPercentage(0, 0)).toBe(0);
  });

  it("rounds to one decimal and clamps to 0–100", () => {
    expect(computeWinPercentage(1, 3)).toBe(33.3);
    expect(computeWinPercentage(2, 3)).toBe(66.7);
    expect(computeWinPercentage(3, 3)).toBe(100);
    expect(computeWinPercentage(10, 1)).toBe(100);
  });
});

describe("rallyPointsForSide", () => {
  it("sums scored and conceded points across completed games", () => {
    const games = [
      completedGame(21, 15, "left"),
      completedGame(18, 21, "right"),
    ];
    expect(rallyPointsForSide(games, "left")).toEqual({
      pointsFor: 39,
      pointsAgainst: 36,
    });
    expect(rallyPointsForSide(games, "right")).toEqual({
      pointsFor: 36,
      pointsAgainst: 39,
    });
  });
});

describe("buildPairStandingsFromMatches", () => {
  it("ranks pairs by wins then margin points (unchanged)", () => {
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

  it("returns zeros when no matches played", () => {
    const standings = buildPairStandingsFromMatches([1, 2], []);
    expect(standings).toHaveLength(2);
    for (const row of standings) {
      expect(row.played).toBe(0);
      expect(row.won).toBe(0);
      expect(row.pointsFor).toBe(0);
      expect(row.pointsAgainst).toBe(0);
      expect(row.matchesRemaining).toBe(0);
      expect(row.winPercentage).toBe(0);
    }
  });

  it("computes PF/PA/remaining/win% for one completed match", () => {
    const standings = buildPairStandingsFromMatches([1, 2], [
      {
        matchId: 1,
        registrationAId: 1,
        registrationBId: 2,
        winnerRegistrationId: 1,
        games: [completedGame(21, 15, "left")],
        status: "completed",
      },
    ]);

    const a = standings.find((s) => s.registrationId === 1)!;
    const b = standings.find((s) => s.registrationId === 2)!;
    expect(a.pointsFor).toBe(21);
    expect(a.pointsAgainst).toBe(15);
    expect(b.pointsFor).toBe(15);
    expect(b.pointsAgainst).toBe(21);
    expect(a.matchesRemaining).toBe(0);
    expect(b.matchesRemaining).toBe(0);
    expect(a.winPercentage).toBe(100);
    expect(b.winPercentage).toBe(0);
  });

  it("computes matches remaining for a partial league", () => {
    const standings = buildPairStandingsFromMatches([1, 2, 3], [
      {
        matchId: 1,
        registrationAId: 1,
        registrationBId: 2,
        winnerRegistrationId: 1,
        games: [completedGame(21, 10, "left")],
        status: "completed",
      },
      {
        matchId: 2,
        registrationAId: 1,
        registrationBId: 3,
        winnerRegistrationId: null,
        games: [],
        status: "scheduled",
      },
      {
        matchId: 3,
        registrationAId: 2,
        registrationBId: 3,
        winnerRegistrationId: null,
        games: [],
        status: "scheduled",
      },
    ]);

    const a = standings.find((s) => s.registrationId === 1)!;
    const b = standings.find((s) => s.registrationId === 2)!;
    const c = standings.find((s) => s.registrationId === 3)!;

    // Each pair has 2 scheduled fixtures in a 3-team RR
    expect(a.played).toBe(1);
    expect(a.matchesRemaining).toBe(1);
    expect(b.played).toBe(1);
    expect(b.matchesRemaining).toBe(1);
    expect(c.played).toBe(0);
    expect(c.matchesRemaining).toBe(2);
    expect(a.winPercentage).toBe(100);
    expect(c.winPercentage).toBe(0);
  });

  it("completed league has zero remaining", () => {
    const standings = buildPairStandingsFromMatches([1, 2], [
      {
        matchId: 1,
        registrationAId: 1,
        registrationBId: 2,
        winnerRegistrationId: 1,
        games: [completedGame(21, 19, "left")],
        status: "completed",
      },
    ]);
    expect(standings.every((s) => s.matchesRemaining === 0)).toBe(true);
  });

  it("excludes cancelled fixtures from scheduled/remaining", () => {
    const standings = buildPairStandingsFromMatches([1, 2], [
      {
        matchId: 1,
        registrationAId: 1,
        registrationBId: 2,
        winnerRegistrationId: null,
        games: [],
        status: "cancelled",
      },
      {
        matchId: 2,
        registrationAId: 1,
        registrationBId: 2,
        winnerRegistrationId: null,
        games: [],
        status: "scheduled",
      },
    ]);
    const a = standings.find((s) => s.registrationId === 1)!;
    expect(a.played).toBe(0);
    expect(a.matchesRemaining).toBe(1);
  });

  it("never returns negative remaining", () => {
    // Played terminal without appearing in scheduled set shouldn't happen,
    // but remaining must still be >= 0.
    const standings = buildPairStandingsFromMatches([1, 2], [
      {
        matchId: 1,
        registrationAId: 1,
        registrationBId: 2,
        winnerRegistrationId: 1,
        games: [completedGame(21, 0, "left")],
        status: "completed",
      },
    ]);
    expect(standings.every((s) => s.matchesRemaining >= 0)).toBe(true);
  });

  it("uses assignedMarginPoints for walkover PF/PA and margin", () => {
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

    const winner = standings.find((s) => s.registrationId === 1)!;
    const loser = standings.find((s) => s.registrationId === 2)!;
    expect(winner.marginPoints).toBe(21);
    expect(winner.won).toBe(1);
    expect(winner.pointsFor).toBe(21);
    expect(winner.pointsAgainst).toBe(0);
    expect(loser.pointsFor).toBe(0);
    expect(loser.pointsAgainst).toBe(21);
    expect(winner.winPercentage).toBe(100);
  });

  it("skips single-sided bye fixtures (no opponent registration)", () => {
    // Builder requires both IDs on the input type; league service already filters.
    // A terminal match without a winner does not inflate played/PF.
    const standings = buildPairStandingsFromMatches([1, 2], [
      {
        matchId: 1,
        registrationAId: 1,
        registrationBId: 2,
        winnerRegistrationId: null,
        winnerSide: null,
        games: [],
        status: "walkover",
      },
    ]);
    expect(standings.every((s) => s.played === 0)).toBe(true);
    expect(standings.every((s) => s.pointsFor === 0)).toBe(true);
    // Still counts toward scheduled (non-cancelled)
    expect(standings.every((s) => s.matchesRemaining === 1)).toBe(true);
  });
});
