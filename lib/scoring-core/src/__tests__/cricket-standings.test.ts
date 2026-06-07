import { describe, expect, it } from "vitest";
import { buildStandingsFromMatches, oversStringToDecimal } from "../cricket/standings";
import type { CricketMatchSummary } from "../cricket/summary";

function summary(
  homeTeamId: number,
  awayTeamId: number,
  innings: CricketMatchSummary["innings"],
  winnerTeamId: number | null,
): CricketMatchSummary {
  return {
    innings,
    target: null,
    winnerTeamId,
    resultText: null,
    homeTeamId,
    awayTeamId,
    oversLimit: 20,
    currentInnings: 2,
    matchStatus: "completed",
  };
}

describe("cricket standings", () => {
  it("parses overs strings", () => {
    expect(oversStringToDecimal("20.0")).toBe(20);
    expect(oversStringToDecimal("19.3")).toBeCloseTo(19.5);
  });

  it("awards 2 points for a win", () => {
    const rows = buildStandingsFromMatches([1, 2], [
      {
        matchId: 1,
        status: "completed",
        homeTeamId: 1,
        awayTeamId: 2,
        summary: summary(1, 2, [
          { innings: 1, battingTeamId: 1, bowlingTeamId: 2, runs: 150, wickets: 5, overs: "20.0", phase: "completed" },
          { innings: 2, battingTeamId: 2, bowlingTeamId: 1, runs: 120, wickets: 8, overs: "20.0", phase: "completed" },
        ], 1),
      },
    ]);

    const team1 = rows.find((r) => r.teamId === 1)!;
    const team2 = rows.find((r) => r.teamId === 2)!;
    expect(team1.won).toBe(1);
    expect(team1.points).toBe(2);
    expect(team2.lost).toBe(1);
    expect(team2.points).toBe(0);
    expect(team1.netRunRate).toBeGreaterThan(team2.netRunRate);
  });

  it("awards 1 point each for a tie", () => {
    const rows = buildStandingsFromMatches([1, 2], [
      {
        matchId: 1,
        status: "completed",
        homeTeamId: 1,
        awayTeamId: 2,
        summary: summary(1, 2, [], null),
        isTie: true,
      },
    ]);
    expect(rows.every((r) => r.tied === 1 && r.points === 1)).toBe(true);
  });

  it("awards 1 point each for abandoned matches", () => {
    const rows = buildStandingsFromMatches([1, 2], [
      {
        matchId: 1,
        status: "abandoned",
        homeTeamId: 1,
        awayTeamId: 2,
        summary: null,
      },
    ]);
    expect(rows.every((r) => r.noResult === 1 && r.points === 1)).toBe(true);
  });
});
