import { describe, expect, it, vi } from "vitest";
import { buildStandingsFromMatches } from "@workspace/scoring-core";

vi.mock("@workspace/db", () => ({
  db: {},
  scoringMatchesTable: {},
  scoringEventsTable: {},
  scoringStandingsTable: {},
  scoringGroupsTable: {},
  scoringGroupMembersTable: {},
  scoringFixturesTable: {},
  tournamentsTable: {},
}));

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

  it("handles no_result matches without attributing NRR runs or overs", () => {
    const rows = buildStandingsFromMatches([10, 20], [
      {
        matchId: 10,
        status: "no_result",
        homeTeamId: 10,
        awayTeamId: 20,
        summary: {
          innings: [
            { innings: 1, battingTeamId: 10, bowlingTeamId: 20, runs: 45, wickets: 1, overs: "4.0", phase: "in_progress" },
          ],
          target: null,
          winnerTeamId: null,
          resultText: "No Result",
          homeTeamId: 10,
          awayTeamId: 20,
          oversLimit: 20,
          currentInnings: 1,
          matchStatus: "no_result",
        },
      },
    ]);

    expect(rows[0]?.points).toBe(1);
    expect(rows[0]?.noResult).toBe(1);
    expect(rows[0]?.tied).toBe(0);
    expect(rows[0]?.netRunRate).toBe(0);
    expect(rows[1]?.points).toBe(1);
    expect(rows[1]?.noResult).toBe(1);
    expect(rows[1]?.tied).toBe(0);
  });

  it("keeps an explicit tie when a winner id is also present", async () => {
    const { toHeadToHeadMatch } = await import("../lib/scoring-standings");
    const { rankPersistedCricketStandings } = await import("@workspace/scoring-core");
    const tied = toHeadToHeadMatch(
      {
        id: 9,
        status: "completed",
        homeTeamId: 1,
        awayTeamId: 2,
        winnerTeamId: 2,
        summaryJson: { winnerTeamId: 2 },
      },
      new Map([[9, true]]),
    );
    const missingWinner = toHeadToHeadMatch(
      {
        id: 10,
        status: "completed",
        homeTeamId: 1,
        awayTeamId: 2,
        winnerTeamId: null,
        summaryJson: null,
      },
      new Map(),
    );

    expect(tied.isTie).toBe(true);
    expect(tied.winnerTeamId).toBe(2);
    expect(missingWinner.isTie).toBeUndefined();
    expect(missingWinner.winnerTeamId).toBeNull();

    const row = {
      played: 1,
      won: 0,
      lost: 0,
      tied: 1,
      noResult: 0,
      points: 1,
      netRunRate: 0,
    };
    const fromTieFlag = rankPersistedCricketStandings(
      [
        { ...row, teamId: 1 },
        { ...row, teamId: 2 },
      ],
      [tied],
    );
    const fromMissingWinner = rankPersistedCricketStandings(
      [
        { ...row, teamId: 1 },
        { ...row, teamId: 2 },
      ],
      [missingWinner],
    );
    expect(fromTieFlag.map((standing) => standing.teamId)).toEqual([1, 2]);
    expect(fromMissingWinner.map((standing) => standing.teamId)).toEqual([1, 2]);
  });
});
