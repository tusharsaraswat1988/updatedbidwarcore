import { describe, expect, it } from "vitest";
import { buildStandingsFromMatches } from "@workspace/scoring-core";

describe("standings projection inputs", () => {
  it("sorts by points then NRR", () => {
    const rows = buildStandingsFromMatches([10, 20, 30], [
      {
        matchId: 1,
        status: "completed",
        homeTeamId: 10,
        awayTeamId: 20,
        summary: {
          innings: [
            { innings: 1, battingTeamId: 10, bowlingTeamId: 20, runs: 200, wickets: 2, overs: "20.0", phase: "completed" },
            { innings: 2, battingTeamId: 20, bowlingTeamId: 10, runs: 180, wickets: 5, overs: "20.0", phase: "completed" },
          ],
          target: 201,
          winnerTeamId: 10,
          resultText: "Team 10 won",
          homeTeamId: 10,
          awayTeamId: 20,
          oversLimit: 20,
          currentInnings: 2,
          matchStatus: "completed",
        },
      },
      {
        matchId: 2,
        status: "completed",
        homeTeamId: 30,
        awayTeamId: 10,
        summary: {
          innings: [
            { innings: 1, battingTeamId: 30, bowlingTeamId: 10, runs: 160, wickets: 6, overs: "20.0", phase: "completed" },
            { innings: 2, battingTeamId: 10, bowlingTeamId: 30, runs: 161, wickets: 4, overs: "19.2", phase: "completed" },
          ],
          target: 161,
          winnerTeamId: 10,
          resultText: "Team 10 won",
          homeTeamId: 30,
          awayTeamId: 10,
          oversLimit: 20,
          currentInnings: 2,
          matchStatus: "completed",
        },
      },
    ]);

    expect(rows[0]?.teamId).toBe(10);
    expect(rows[0]?.points).toBe(4);
    expect(rows[0]?.won).toBe(2);
  });

  it("correctly identifies knockout and playoff matches", async () => {
    const { isKnockoutMatch } = await import("../lib/scoring-standings");
    expect(isKnockoutMatch({ matchTypeId: "knockout" })).toBe(true);
    expect(isKnockoutMatch({ roundName: "Semi Final 1" })).toBe(true);
    expect(isKnockoutMatch({ roundName: "Grand Final" })).toBe(true);
    expect(isKnockoutMatch({ roundName: "Quarter Final 2" })).toBe(true);
    expect(isKnockoutMatch({ roundName: "Eliminator" })).toBe(true);
    expect(isKnockoutMatch({ roundName: "Qualifier 1" })).toBe(true);
    expect(isKnockoutMatch({ roundName: "Group A — Round 1", matchTypeId: "league" })).toBe(false);
    expect(isKnockoutMatch({ roundName: "Round 2", matchTypeId: "league" })).toBe(false);
  });
});
