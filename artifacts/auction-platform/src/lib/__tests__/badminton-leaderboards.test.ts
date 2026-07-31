import { describe, expect, it } from "vitest";
import {
  buildLeaderboardBoards,
  buildLeaderboardPages,
  buildStandingsBoardsFromRows,
  filterStandingsForGroup,
  isLeagueDrawType,
  paginateItems,
  type LeagueStandingRow,
} from "../badminton-leaderboards";

const rows = (labels: string[]): LeagueStandingRow[] =>
  labels.map((label, i) => ({
    rank: i + 1,
    registrationId: i + 1,
    label,
    played: 2,
    won: 2 - (i % 2),
    lost: i % 2,
    marginPoints: 20 - i,
  }));

describe("badminton leaderboards helpers", () => {
  it("detects league draw types", () => {
    expect(isLeagueDrawType("round_robin")).toBe(true);
    expect(isLeagueDrawType("group_knockout")).toBe(true);
    expect(isLeagueDrawType("knockout")).toBe(false);
  });

  it("paginates items into fixed page sizes", () => {
    expect(paginateItems([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(paginateItems([], 6)).toEqual([]);
  });

  it("builds Results boards from groupId on standings rows", () => {
    const standings: LeagueStandingRow[] = [
      {
        rank: 1,
        registrationId: 1,
        label: "A",
        groupId: 2,
        groupName: "Group 2",
        played: 1,
        won: 1,
        lost: 0,
        marginPoints: 5,
      },
      {
        rank: 2,
        registrationId: 2,
        label: "B",
        groupId: 1,
        groupName: "Group 1",
        played: 1,
        won: 1,
        lost: 0,
        marginPoints: 3,
      },
      {
        rank: 3,
        registrationId: 3,
        label: "C",
        groupId: 1,
        groupName: "Group 1",
        played: 1,
        won: 0,
        lost: 1,
        marginPoints: 0,
      },
    ];
    const boards = buildStandingsBoardsFromRows({
      categories: [{ id: 9, name: "Males", code: "G1M", drawType: "group_knockout" }],
      standingsByCategory: new Map([[9, standings]]),
    });
    expect(boards.map((b) => b.boardTitle)).toEqual(["Group 1", "Group 2"]);
    expect(boards[0]?.rows.map((r) => r.label)).toEqual(["B", "C"]);
    expect(boards[0]?.rows.map((r) => r.rank)).toEqual([1, 2]);
  });

  it("filters and re-ranks standings for a group", () => {
    const standings = rows(["A", "B", "C"]);
    const filtered = filterStandingsForGroup(
      standings,
      {
        id: 1,
        name: "Group A",
        sortOrder: 0,
        teams: [
          { teamId: 10, teamName: "T1", seed: 1 },
          { teamId: 11, teamName: "T2", seed: 2 },
        ],
      },
      new Map([
        [1, 10],
        [2, 99],
        [3, 11],
      ]),
    );
    expect(filtered.map((r) => r.label)).toEqual(["A", "C"]);
    expect(filtered.map((r) => r.rank)).toEqual([1, 2]);
  });

  it("builds one board per group when mappings exist", () => {
    const boards = buildLeaderboardBoards({
      categories: [{ id: 5, name: "MS", code: "MS", drawType: "group_knockout" }],
      standingsByCategory: new Map([[5, rows(["A", "B", "C", "D"])]]),
      groupsByCategory: new Map([
        [
          5,
          [
            {
              id: 1,
              name: "Group A",
              sortOrder: 0,
              teams: [{ teamId: 10, teamName: "T1", seed: 1 }],
            },
            {
              id: 2,
              name: "Group B",
              sortOrder: 1,
              teams: [{ teamId: 20, teamName: "T2", seed: 1 }],
            },
          ],
        ],
      ]),
      registrationTeamByCategory: new Map([
        [
          5,
          new Map([
            [1, 10],
            [2, 10],
            [3, 20],
            [4, 20],
          ]),
        ],
      ]),
    });
    expect(boards).toHaveLength(2);
    expect(boards[0]?.boardTitle).toBe("Group A");
    expect(boards[0]?.rows).toHaveLength(2);
    expect(boards[1]?.boardTitle).toBe("Group B");
  });

  it("falls back to category board when groups cannot be mapped", () => {
    const boards = buildLeaderboardBoards({
      categories: [{ id: 5, name: "WS", drawType: "round_robin" }],
      standingsByCategory: new Map([[5, rows(["A", "B"])]]),
      groupsByCategory: new Map([
        [
          5,
          [
            {
              id: 1,
              name: "Group A",
              sortOrder: 0,
              teams: [{ teamId: 10, teamName: "T1", seed: 1 }],
            },
          ],
        ],
      ]),
      registrationTeamByCategory: new Map([[5, new Map()]]),
    });
    expect(boards).toHaveLength(1);
    expect(boards[0]?.boardTitle).toBe("League");
    expect(boards[0]?.rows).toHaveLength(2);
  });

  it("splits boards into leaderboard pages", () => {
    const boards = buildLeaderboardBoards({
      categories: [{ id: 1, name: "MD", drawType: "round_robin" }],
      standingsByCategory: new Map([[1, rows(["A", "B", "C", "D", "E"])]]),
      groupsByCategory: new Map(),
      registrationTeamByCategory: new Map(),
    });
    const pages = buildLeaderboardPages(boards, 2);
    expect(pages).toHaveLength(3);
    expect(pages[0]?.pageCount).toBe(3);
    expect(pages[2]?.rows).toHaveLength(1);
  });
});
