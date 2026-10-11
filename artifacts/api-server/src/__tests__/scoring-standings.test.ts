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
  }, 20000);

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

  it("counts a game in the official group of the two teams, not the fixture label", async () => {
    const { projectGroupStandings } = await import("../lib/scoring-standings");
    const summary = (winner: number, home: number, away: number) => ({
      innings: [
        { innings: 1, battingTeamId: home, bowlingTeamId: away, runs: winner === home ? 40 : 20, wickets: 2, overs: "5.0", phase: "completed" as const },
        { innings: 2, battingTeamId: away, bowlingTeamId: home, runs: winner === away ? 41 : 20, wickets: 3, overs: "5.0", phase: "completed" as const },
      ],
      target: 41,
      winnerTeamId: winner,
      resultText: "win",
      homeTeamId: home,
      awayTeamId: away,
      oversLimit: 5,
      currentInnings: 2,
      matchStatus: "completed" as const,
    });
    const groupA = [91, 89, 85, 84, 93];
    const groupB = [80, 77, 87, 92];
    const fixtures = [
      { id: 37, drawId: 4, groupId: 4, homeTeamId: 89, awayTeamId: 93, roundName: "Group B — Match 20" },
      { id: 25, drawId: 4, groupId: 3, homeTeamId: 80, awayTeamId: 87, roundName: "Group A — Match 21" },
      { id: 27, drawId: 4, groupId: 3, homeTeamId: 91, awayTeamId: 85, roundName: "Group A — Match 23" },
    ];
    const matches = [
      { matchId: 130, fixtureId: 37, status: "completed" as const, homeTeamId: 89, awayTeamId: 93, summary: summary(89, 89, 93) },
      { matchId: 132, fixtureId: 26, status: "completed" as const, homeTeamId: 80, awayTeamId: 87, summary: summary(80, 80, 87) },
      { matchId: 133, fixtureId: 27, status: "completed" as const, homeTeamId: 87, awayTeamId: 77, summary: summary(77, 87, 77) },
    ];
    const fixturesWithStored = [
      ...fixtures,
      { id: 26, drawId: 4, groupId: 4, homeTeamId: 77, awayTeamId: 92, roundName: "Group B — Match 22" },
    ];

    const tableA = projectGroupStandings({
      drawId: 4,
      groupId: 3,
      teamIds: groupA,
      fixtures: fixturesWithStored,
      matches,
    });
    const tableB = projectGroupStandings({
      drawId: 4,
      groupId: 4,
      teamIds: groupB,
      fixtures: fixturesWithStored,
      matches,
    });

    const played = (rows: typeof tableA, teamId: number) => rows.find((row) => row.teamId === teamId);
    expect([...tableA.map((row) => row.teamId)].sort((a, b) => a - b)).toEqual([...groupA].sort((a, b) => a - b));
    expect(played(tableA, 89)?.played).toBe(1);
    expect(played(tableA, 89)?.won).toBe(1);
    expect(played(tableA, 93)?.lost).toBe(1);
    expect(played(tableA, 91)?.played).toBe(0);
    expect([...tableB.map((row) => row.teamId)].sort((a, b) => a - b)).toEqual([...groupB].sort((a, b) => a - b));
    expect(played(tableB, 80)?.played).toBe(1);
    expect(played(tableB, 80)?.won).toBe(1);
    expect(played(tableB, 87)?.played).toBe(2);
    expect(played(tableB, 87)?.lost).toBe(2);
    expect(played(tableB, 77)?.won).toBe(1);
    expect(played(tableB, 92)?.played).toBe(0);
  });
});
