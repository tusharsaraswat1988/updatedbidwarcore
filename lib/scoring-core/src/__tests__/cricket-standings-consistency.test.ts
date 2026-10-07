import { describe, expect, it } from "vitest";
import {
  applyQualification,
  formatNetRunRate,
  normalizeCricketStandings,
  rankPersistedCricketStandings,
  sameCricketStandings,
  teamGroupQualifications,
  type HeadToHeadMatch,
  type PersistedCricketStanding,
  type TeamStandingComputed,
} from "../cricket/standings";
import { resolveGroupQualifications } from "../cricket/progression";

function storedRow(
  teamId: number,
  extras: { runsScored: number; oversFaced: number; runsConceded: number; oversBowled: number },
): PersistedCricketStanding {
  return {
    teamId,
    played: 4,
    won: 2,
    lost: 2,
    tied: 0,
    noResult: 0,
    points: 4,
    netRunRate: "0.123",
    extras,
  };
}

const lowerNrr = { runsScored: 123.44, oversFaced: 1000, runsConceded: 0, oversBowled: 1000 };
const higherNrr = { runsScored: 123.46, oversFaced: 1000, runsConceded: 0, oversBowled: 1000 };
const evenNrr = { runsScored: 100, oversFaced: 20, runsConceded: 100, oversBowled: 20 };

function asComputed(rows: ReturnType<typeof rankPersistedCricketStandings>): TeamStandingComputed[] {
  return rows.map((row) => ({
    teamId: row.teamId,
    played: row.played,
    won: row.won,
    lost: row.lost,
    tied: row.tied,
    noResult: row.noResult,
    points: row.points,
    pointsPercentage: row.pointsPercentage,
    netRunRate: row.netRunRate,
    runsScored: 0,
    oversFaced: 0,
    runsConceded: 0,
    oversBowled: 0,
  }));
}

describe("cross-surface cricket standings identity", () => {
  it("keeps 0.12346 above 0.12344 on every surface projection", () => {
    const input = [storedRow(1, lowerNrr), storedRow(2, higherNrr)];
    const authoritative = rankPersistedCricketStandings(input, []);
    const again = rankPersistedCricketStandings(input, []);

    expect(authoritative.map((row) => row.teamId)).toEqual([2, 1]);
    expect(authoritative[0]?.netRunRate).toBeCloseTo(0.12346, 8);
    expect(authoritative[1]?.netRunRate).toBeCloseTo(0.12344, 8);
    expect(formatNetRunRate(authoritative[0]?.netRunRate)).toBe("+0.123");
    expect(formatNetRunRate(authoritative[1]?.netRunRate)).toBe("+0.123");

    const admin = normalizeCricketStandings(authoritative);
    const publicStandings = normalizeCricketStandings(authoritative);
    const bpl = normalizeCricketStandings(again);
    const reports = normalizeCricketStandings(authoritative);
    const led = normalizeCricketStandings(authoritative);
    const scoreboard = normalizeCricketStandings(authoritative.slice(0, 8));
    const obs = normalizeCricketStandings(authoritative.slice(0, 8));
    const profile = admin.find((row) => row.teamId === 2);

    expect(sameCricketStandings(admin, publicStandings)).toBe(true);
    expect(sameCricketStandings(admin, bpl)).toBe(true);
    expect(sameCricketStandings(admin, reports)).toBe(true);
    expect(sameCricketStandings(admin, led)).toBe(true);
    expect(sameCricketStandings(admin, scoreboard)).toBe(true);
    expect(sameCricketStandings(scoreboard, obs, ["teamId", "rank", "points", "pointsPercentage", "netRunRate"])).toBe(
      true,
    );
    expect(profile).toEqual(admin[0]);
    expect(profile?.rank).toBe(1);
    expect(profile?.netRunRate).toBe(authoritative[0]?.netRunRate);
  });

  it("treats an explicit tie flag as a tie even when a winner id is present", () => {
    const rows = [storedRow(1, evenNrr), storedRow(2, evenNrr)];
    const explicitTie: HeadToHeadMatch[] = [
      {
        status: "completed",
        homeTeamId: 1,
        awayTeamId: 2,
        winnerTeamId: 2,
        isTie: true,
      },
    ];
    const recordedWin: HeadToHeadMatch[] = [
      {
        status: "completed",
        homeTeamId: 1,
        awayTeamId: 2,
        winnerTeamId: 2,
        isTie: false,
      },
    ];
    const noWinner: HeadToHeadMatch[] = [
      {
        status: "completed",
        homeTeamId: 1,
        awayTeamId: 2,
        winnerTeamId: null,
      },
    ];

    const tied = rankPersistedCricketStandings(rows, explicitTie);
    const won = rankPersistedCricketStandings(rows, recordedWin);
    const open = rankPersistedCricketStandings(rows, noWinner);

    expect(tied.map((row) => row.teamId)).toEqual([1, 2]);
    expect(open.map((row) => row.teamId)).toEqual([1, 2]);
    expect(won.map((row) => row.teamId)).toEqual([2, 1]);
    expect(sameCricketStandings(normalizeCricketStandings(tied), normalizeCricketStandings(open))).toBe(true);
  });

  it("qualifies the displayed prefix without ranking again", () => {
    const ranked = rankPersistedCricketStandings(
      [storedRow(1, lowerNrr), storedRow(2, higherNrr), storedRow(3, evenNrr)],
      [],
    );
    const marked = applyQualification(ranked, 1);
    expect(ranked.map((row) => row.teamId)).toEqual([2, 1, 3]);
    expect(marked.map((row) => row.teamId)).toEqual(ranked.map((row) => row.teamId));
    expect(marked.map((row) => row.qualified)).toEqual([true, false, false]);

    const resolved = resolveGroupQualifications(
      [{ name: "Group A" }],
      { type: "top_n_per_group", count: 1 },
      { "Group A": { groupName: "Group A", standings: asComputed(ranked), isComplete: true } },
    );
    expect(resolved.qualifierTeamIds).toEqual(marked.filter((row) => row.qualified).map((row) => row.teamId));
  });

  it("resolves multi-group qualification by group id, not array order", () => {
    const groups = [
      {
        id: 20,
        name: "Group B",
        rows: [
          { teamId: 2, qualified: true },
          { teamId: 7, qualified: true },
        ],
      },
      {
        id: 10,
        name: "Group A",
        rows: [
          { teamId: 7, qualified: false },
          { teamId: 1, qualified: true },
        ],
      },
    ];
    const reversed = [...groups].reverse();
    const forward = teamGroupQualifications(groups, 7);
    const backward = teamGroupQualifications(reversed, 7);

    expect(forward).toEqual(backward);
    expect(forward.qualified).toBe(true);
    expect(forward.groups).toEqual([
      { groupId: 10, groupName: "Group A", qualified: false },
      { groupId: 20, groupName: "Group B", qualified: true },
    ]);
    expect(teamGroupQualifications(groups, 1).qualified).toBe(true);
    expect(teamGroupQualifications([{ id: 10, name: "Group A", rows: [{ teamId: 9, qualified: false }] }], 9).qualified).toBe(
      false,
    );
    expect(teamGroupQualifications(groups, 99)).toEqual({ qualified: null, groups: [] });
  });
});
