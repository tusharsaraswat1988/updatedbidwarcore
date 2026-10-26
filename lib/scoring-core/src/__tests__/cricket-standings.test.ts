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

  it("awards 1 point each for abandoned matches without adding runs/overs to NRR", () => {
    const rows = buildStandingsFromMatches([1, 2], [
      {
        matchId: 1,
        status: "abandoned",
        homeTeamId: 1,
        awayTeamId: 2,
        summary: summary(1, 2, [
          { innings: 1, battingTeamId: 1, bowlingTeamId: 2, runs: 45, wickets: 2, overs: "5.0", phase: "in_progress" },
        ], null),
      },
    ]);
    expect(rows.every((r) => r.noResult === 1 && r.points === 1)).toBe(true);
    // NRR must be 0 and no overs/runs added
    expect(rows.every((r) => r.netRunRate === 0 && r.oversFaced === 0 && r.runsScored === 0)).toBe(true);
  });

  it("applies the ICC/CricHeroes all-out rule (full overs quota credited)", () => {
    // 20 over match: Team 1 scores 100 all-out (10 wickets) in 15.3 overs.
    // Team 2 chases 101/2 in 10.0 overs.
    const rows = buildStandingsFromMatches([1, 2], [
      {
        matchId: 1,
        status: "completed",
        homeTeamId: 1,
        awayTeamId: 2,
        summary: {
          innings: [
            {
              innings: 1,
              battingTeamId: 1,
              bowlingTeamId: 2,
              runs: 100,
              wickets: 10,
              overs: "15.3",
              phase: "completed",
              allOut: true,
              oversLimit: 20,
            },
            {
              innings: 2,
              battingTeamId: 2,
              bowlingTeamId: 1,
              runs: 101,
              wickets: 2,
              overs: "10.0",
              phase: "completed",
              allOut: false,
              oversLimit: 20,
            },
          ],
          target: 101,
          winnerTeamId: 2,
          resultText: "Team 2 won by 8 wickets",
          homeTeamId: 1,
          awayTeamId: 2,
          oversLimit: 20,
          maxWickets: 10,
          currentInnings: 2,
          matchStatus: "completed",
        },
      },
    ]);

    const team1 = rows.find((r) => r.teamId === 1)!;
    const team2 = rows.find((r) => r.teamId === 2)!;

    // Team 1 faced full 20.0 overs (due to all out), conceded in 10.0 overs:
    // Team 1 NRR = (100 / 20) - (101 / 10) = 5.0 - 10.1 = -5.1
    expect(team1.oversFaced).toBe(20);
    expect(team1.oversBowled).toBe(10);
    expect(team1.netRunRate).toBeCloseTo(-5.1, 3);

    // Team 2 faced 10.0 overs, bowled full 20.0 overs:
    // Team 2 NRR = (101 / 10) - (100 / 20) = 10.1 - 5.0 = +5.1
    expect(team2.oversFaced).toBe(10);
    expect(team2.oversBowled).toBe(20);
    expect(team2.netRunRate).toBeCloseTo(5.1, 3);
  });

  it("excludes Super Over innings from tournament NRR", () => {
    // Tied 20-over match: 150/5 vs 150/7
    // Followed by Super Over: Team 1 scores 15/1 (1.0), Team 2 scores 12/2 (1.0)
    const rows = buildStandingsFromMatches([1, 2], [
      {
        matchId: 1,
        status: "completed",
        homeTeamId: 1,
        awayTeamId: 2,
        summary: {
          innings: [
            { innings: 1, battingTeamId: 1, bowlingTeamId: 2, runs: 150, wickets: 5, overs: "20.0", phase: "completed", kind: "normal" },
            { innings: 2, battingTeamId: 2, bowlingTeamId: 1, runs: 150, wickets: 7, overs: "20.0", phase: "completed", kind: "normal" },
            { innings: 3, battingTeamId: 1, bowlingTeamId: 2, runs: 15, wickets: 1, overs: "1.0", phase: "completed", kind: "super_over" },
            { innings: 4, battingTeamId: 2, bowlingTeamId: 1, runs: 12, wickets: 2, overs: "1.0", phase: "completed", kind: "super_over" },
          ],
          target: null,
          winnerTeamId: 1,
          resultText: "Team 1 won in Super Over",
          homeTeamId: 1,
          awayTeamId: 2,
          oversLimit: 20,
          currentInnings: 4,
          matchStatus: "completed",
        },
      },
    ]);

    const team1 = rows.find((r) => r.teamId === 1)!;
    const team2 = rows.find((r) => r.teamId === 2)!;

    // Super over runs (15 and 12) and overs (1.0) must NOT be added to regular runs/overs
    expect(team1.runsScored).toBe(150);
    expect(team1.oversFaced).toBe(20);
    expect(team1.runsConceded).toBe(150);
    expect(team1.oversBowled).toBe(20);
    expect(team1.netRunRate).toBeCloseTo(0, 3);

    expect(team2.runsScored).toBe(150);
    expect(team2.oversFaced).toBe(20);
    expect(team2.netRunRate).toBeCloseTo(0, 3);
  });

  it("treats no_result matches identically to abandoned (1 point, no NRR impact, not a tie)", () => {
    const rows = buildStandingsFromMatches([1, 2], [
      {
        matchId: 99,
        status: "no_result",
        homeTeamId: 1,
        awayTeamId: 2,
        summary: summary(1, 2, [
          { innings: 1, battingTeamId: 1, bowlingTeamId: 2, runs: 80, wickets: 3, overs: "10.0", phase: "in_progress" },
        ], null),
      },
    ]);

    const team1 = rows.find((r) => r.teamId === 1)!;
    const team2 = rows.find((r) => r.teamId === 2)!;

    expect(team1.played).toBe(1);
    expect(team1.noResult).toBe(1);
    expect(team1.tied).toBe(0);
    expect(team1.points).toBe(1);
    expect(team1.oversFaced).toBe(0);
    expect(team1.netRunRate).toBe(0);

    expect(team2.played).toBe(1);
    expect(team2.noResult).toBe(1);
    expect(team2.tied).toBe(0);
    expect(team2.points).toBe(1);
  });

  it("calculates NRR accurately with custom ballsPerOver (e.g. The Hundred 5-ball or 8-ball overs)", () => {
    // 5-ball over match: Team 1 scores 80 in 4.2 overs (4 overs + 2 balls = 4 + 2/5 = 4.4 overs)
    const rows = buildStandingsFromMatches([1, 2], [
      {
        matchId: 101,
        status: "completed",
        homeTeamId: 1,
        awayTeamId: 2,
        summary: {
          innings: [
            { innings: 1, battingTeamId: 1, bowlingTeamId: 2, runs: 80, wickets: 2, overs: "4.2", phase: "completed", allOut: false },
            { innings: 2, battingTeamId: 2, bowlingTeamId: 1, runs: 60, wickets: 4, overs: "4.2", phase: "completed", allOut: false },
          ],
          target: 81,
          winnerTeamId: 1,
          resultText: "Team 1 won by 20 runs",
          homeTeamId: 1,
          awayTeamId: 2,
          oversLimit: 5,
          currentInnings: 2,
          matchStatus: "completed",
          ballsPerOver: 5,
        },
      },
    ]);

    const team1 = rows.find((r) => r.teamId === 1)!;
    // 4.2 with 5 balls per over = 4 + 2/5 = 4.4 overs
    expect(team1.oversFaced).toBeCloseTo(4.4, 3);
    expect(team1.oversBowled).toBeCloseTo(4.4, 3);
    // (80 / 4.4) - (60 / 4.4) = 20 / 4.4 = ~4.545
    expect(team1.netRunRate).toBeCloseTo(20 / 4.4, 3);
  });
});
