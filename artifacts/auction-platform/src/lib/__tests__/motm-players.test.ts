import { describe, expect, it } from "vitest";
import { summarizeManOfTheMatch, type MotmAwardInput, type MotmMatchInput, type MotmTeamInput } from "@/lib/motm-players";

const teams: MotmTeamInput[] = [
  { teamId: 1, teamName: "City Rockers", shortCode: "CRS", color: "#f97316" },
  { teamId: 2, teamName: "Saket Knights", shortCode: "SAK", color: "#3b82f6" },
];

function award(partial: Partial<MotmAwardInput> & Pick<MotmAwardInput, "id" | "playerId" | "playerName" | "matchId">): MotmAwardInput {
  return {
    awardType: "man_of_the_match",
    reason: null,
    teamId: 1,
    teamName: "CRS",
    shortCode: "CRS",
    ...partial,
  };
}

const matches: MotmMatchInput[] = [
  { id: 10, homeTeamId: 1, awayTeamId: 2, resultSummary: "City Rockers won", tournamentMatchNumber: 1 },
  { id: 11, homeTeamId: 2, awayTeamId: 1, resultSummary: null, tournamentMatchNumber: 2 },
];

describe("summarizeManOfTheMatch", () => {
  it("groups awards by player and ranks the highest count first", () => {
    const rows = summarizeManOfTheMatch(
      [
        award({ id: 1, playerId: 7, playerName: "Aman", matchId: 10, reason: "54 runs" }),
        award({ id: 2, playerId: 8, playerName: "Ravi", matchId: 11, teamId: 2, teamName: "SAK", shortCode: "SAK" }),
        award({ id: 3, playerId: 7, playerName: "Aman", matchId: 11 }),
      ],
      matches,
      teams,
    );

    expect(rows.map((row) => [row.playerName, row.awards.length, row.teamName])).toEqual([
      ["Aman", 2, "City Rockers"],
      ["Ravi", 1, "Saket Knights"],
    ]);
    expect(rows[0]?.awards.map((item) => item.matchLabel)).toEqual([
      "Match 1 · vs Saket Knights",
      "Match 2 · vs Saket Knights",
    ]);
    expect(rows[0]?.awards[0]?.reason).toBe("54 runs");
    expect(rows[1]?.awards[0]?.matchLabel).toBe("Match 2 · vs City Rockers");
  });

  it("ignores awards that are not man of the match", () => {
    const rows = summarizeManOfTheMatch(
      [award({ id: 1, playerId: 7, playerName: "Aman", matchId: 10, awardType: "best_batter" })],
      matches,
      teams,
    );
    expect(rows).toEqual([]);
  });
});