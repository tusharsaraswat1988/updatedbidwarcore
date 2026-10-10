import { describe, expect, it, vi } from "vitest";
import {
  cricketLiveSlotsConflict,
  hasCricketCompetitionLineage,
  incompleteLiveMatchBlocksStart,
} from "../lib/cricket-competition-scope";

vi.mock("@workspace/db", () => ({
  db: {},
  scoringMatchesTable: {},
  scoringEventsTable: {},
  scoringStandingsTable: {},
  scoringGroupsTable: {},
  scoringGroupMembersTable: {},
  scoringFixturesTable: {},
  scoringDrawsTable: {},
  tournamentsTable: {},
}));

vi.mock("../middleware/require-module", () => ({
  assertSportModule: vi.fn(),
  ModuleAuthorizationError: class ModuleAuthorizationError extends Error {},
}));

vi.mock("@workspace/platform-core", () => ({
  InvalidTournamentModuleStateError: class InvalidTournamentModuleStateError extends Error {},
}));

vi.mock("../lib/master-sports/cricket-franchise-registry", () => ({
  listCricketFranchisePlayers: vi.fn(),
  listCricketFranchiseTeams: vi.fn(),
  resolveCricketFranchiseTeamsByIds: vi.fn(),
}));

describe("cricket draw standings scope", () => {
  it("keeps same team ids and same display names independent, and ignores the other draw", async () => {
    const { projectDrawStandings, projectGroupStandings } = await import("../lib/scoring-standings");
    const summary = (winner: number, home: number, away: number, homeRuns: number, awayRuns: number) => ({
      innings: [
        { innings: 1, battingTeamId: home, bowlingTeamId: away, runs: homeRuns, wickets: 2, overs: "5.0", phase: "completed" as const },
        { innings: 2, battingTeamId: away, bowlingTeamId: home, runs: awayRuns, wickets: 5, overs: "5.0", phase: "completed" as const },
      ],
      target: homeRuns + 1,
      winnerTeamId: winner,
      resultText: "win",
      homeTeamId: home,
      awayTeamId: away,
      oversLimit: 5,
      currentInnings: 2,
      matchStatus: "completed" as const,
    });

    const fixtures = [
      { id: 1, drawId: 1, groupId: 11, roundName: "Group A" },
      { id: 2, drawId: 2, groupId: 21, roundName: "Group A" },
      { id: 3, drawId: 1, groupId: null, roundName: "Final" },
    ];
    const matches = [
      {
        matchId: 10,
        fixtureId: 1,
        status: "completed",
        homeTeamId: 101,
        awayTeamId: 102,
        summary: summary(101, 101, 102, 80, 40),
      },
      {
        matchId: 20,
        fixtureId: 2,
        status: "completed",
        homeTeamId: 101,
        awayTeamId: 201,
        summary: summary(201, 101, 201, 30, 90),
      },
      {
        matchId: 30,
        fixtureId: null,
        status: "completed",
        homeTeamId: 101,
        awayTeamId: 102,
        summary: summary(102, 101, 102, 10, 70),
      },
      {
        matchId: 40,
        fixtureId: 3,
        status: "completed",
        homeTeamId: 101,
        awayTeamId: 102,
        summary: summary(102, 101, 102, 10, 70),
      },
    ];

    const d1 = projectDrawStandings({
      drawId: 1,
      groups: [{ id: 11, teamIds: [101, 102] }],
      fixtures,
      matches,
    });
    const d2 = projectDrawStandings({
      drawId: 2,
      groups: [{ id: 21, teamIds: [101, 201] }],
      fixtures,
      matches,
    });

    const d1Team = d1.find((row) => row.teamId === 101);
    const d2Team = d2.find((row) => row.teamId === 101);
    expect(d1Team?.points).toBe(2);
    expect(d1Team?.won).toBe(1);
    expect(d2Team?.points).toBe(0);
    expect(d2Team?.lost).toBe(1);
    expect(d1Team?.points).not.toBe(d2Team?.points);

    const named = projectDrawStandings({
      drawId: 2,
      groups: [{ id: 21, teamIds: [201] }],
      fixtures,
      matches: [
        {
          matchId: 21,
          fixtureId: 2,
          status: "completed",
          homeTeamId: 201,
          awayTeamId: 202,
          summary: summary(201, 201, 202, 50, 20),
        },
      ],
    });
    expect(named.find((row) => row.teamId === 201)?.points).toBe(2);
    expect(d1.find((row) => row.teamId === 201)).toBeUndefined();

    const corrected = projectDrawStandings({
      drawId: 1,
      groups: [{ id: 11, teamIds: [101, 102] }],
      fixtures,
      matches: [
        {
          matchId: 10,
          fixtureId: 1,
          status: "completed",
          homeTeamId: 101,
          awayTeamId: 102,
          summary: summary(102, 101, 102, 20, 60),
        },
      ],
    });
    expect(corrected.find((row) => row.teamId === 101)?.points).toBe(0);
    expect(d2Team?.points).toBe(0);
    expect(d2Team?.lost).toBe(1);

    const group = projectGroupStandings({
      drawId: 1,
      groupId: 11,
      teamIds: [101, 102],
      fixtures,
      matches,
    });
    expect(group.find((row) => row.teamId === 101)?.played).toBe(1);
    expect(group.find((row) => row.teamId === 101)?.points).toBe(2);
  });

  it("leaves an empty draw unchanged when the other draw has results", async () => {
    const { projectDrawStandings } = await import("../lib/scoring-standings");
    const empty = projectDrawStandings({
      drawId: 2,
      groups: [{ id: 21, teamIds: [201, 202] }],
      fixtures: [{ id: 9, drawId: 1, groupId: 11, roundName: "Group A" }],
      matches: [
        {
          matchId: 1,
          fixtureId: 9,
          status: "completed",
          homeTeamId: 101,
          awayTeamId: 102,
          summary: null,
        },
      ],
    });
    expect(empty.find((row) => row.teamId === 201)?.played).toBe(0);
    expect(empty.find((row) => row.teamId === 201)?.points).toBe(0);
  });
});

describe("draws without groups", () => {
  it("uses only that draw's ungrouped league fixtures", async () => {
    const { projectDrawStandings } = await import("../lib/scoring-standings");
    const summary = (winner: number, home: number, away: number) => ({
      innings: [
        { innings: 1, battingTeamId: home, bowlingTeamId: away, runs: winner === home ? 80 : 40, wickets: 2, overs: "5.0", phase: "completed" as const },
        { innings: 2, battingTeamId: away, bowlingTeamId: home, runs: winner === away ? 80 : 40, wickets: 5, overs: "5.0", phase: "completed" as const },
      ],
      target: 81,
      winnerTeamId: winner,
      resultText: "win",
      homeTeamId: home,
      awayTeamId: away,
      oversLimit: 5,
      currentInnings: 2,
      matchStatus: "completed" as const,
    });
    const fixtures = [
      { id: 1, drawId: 1, groupId: null, roundName: "League" },
      { id: 2, drawId: 2, groupId: null, roundName: "League" },
      { id: 3, drawId: 2, groupId: 21, roundName: "Group A" },
    ];
    const matches = [
      {
        matchId: 1,
        fixtureId: 1,
        status: "completed" as const,
        homeTeamId: 101,
        awayTeamId: 102,
        summary: summary(101, 101, 102),
      },
      {
        matchId: 2,
        fixtureId: 2,
        status: "completed" as const,
        homeTeamId: 101,
        awayTeamId: 102,
        summary: summary(102, 101, 102),
      },
      {
        matchId: 3,
        fixtureId: 3,
        status: "completed" as const,
        homeTeamId: 101,
        awayTeamId: 102,
        summary: summary(101, 101, 102),
      },
    ];

    const d1 = projectDrawStandings({ drawId: 1, groups: [], fixtures, matches });
    const d2 = projectDrawStandings({ drawId: 2, groups: [], fixtures, matches });

    expect(d1.find((row) => row.teamId === 101)?.points).toBe(2);
    expect(d1.find((row) => row.teamId === 102)?.points).toBe(0);
    expect(d2.find((row) => row.teamId === 101)?.points).toBe(0);
    expect(d2.find((row) => row.teamId === 102)?.points).toBe(2);
    expect(d1.find((row) => row.teamId === 101)?.played).toBe(1);
    expect(d2.find((row) => row.teamId === 101)?.played).toBe(1);
  });
});

describe("cricket live competition slots", () => {
  it("allows one live match in each draw and blocks a second live match in the same draw", () => {
    expect(cricketLiveSlotsConflict(1, 2)).toBe(false);
    expect(cricketLiveSlotsConflict(1, 1)).toBe(true);
  });

  it("lets an umpire leave an incomplete match and start another", () => {
    expect(
      incompleteLiveMatchBlocksStart({
        sessionStatus: "paused",
        lockScorerId: 9,
        lockFresh: true,
        actingScorerId: 4,
      }),
    ).toBe(false);
    expect(
      incompleteLiveMatchBlocksStart({
        sessionStatus: "live",
        lockScorerId: null,
        lockFresh: false,
        actingScorerId: 4,
      }),
    ).toBe(false);
    expect(
      incompleteLiveMatchBlocksStart({
        sessionStatus: "live",
        lockScorerId: 4,
        lockFresh: true,
        actingScorerId: 4,
      }),
    ).toBe(false);
  });

  it("still blocks when a different umpire is actively scoring the other match", () => {
    expect(
      incompleteLiveMatchBlocksStart({
        sessionStatus: "live",
        lockScorerId: 9,
        lockFresh: true,
        actingScorerId: 4,
      }),
    ).toBe(true);
  });

  it("treats a fixture-less cricket match as having no competition lineage", () => {
    expect(hasCricketCompetitionLineage(null)).toBe(false);
    expect(hasCricketCompetitionLineage({ drawId: null })).toBe(false);
    expect(hasCricketCompetitionLineage({ drawId: 4 })).toBe(true);
    expect(cricketLiveSlotsConflict(null, 1)).toBe(true);
    expect(cricketLiveSlotsConflict(1, null)).toBe(true);
  });
});
