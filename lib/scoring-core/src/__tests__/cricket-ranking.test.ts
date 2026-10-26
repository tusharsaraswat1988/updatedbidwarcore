import { describe, expect, it } from "vitest";
import {
  buildHeadToHeadIndex,
  buildStandingsFromMatches,
  compareCricketStandings,
  computeNetRunRate,
  computePointsPercentage,
  DEFAULT_CRICKET_POINTS_RULES,
  formatNetRunRate,
  formatPointsPercentage,
  rankCricketStandings,
  rankingNetRunRate,
  type StandingsMatchInput,
  type TeamStandingComputed,
} from "../cricket/standings";
import { resolveGroupQualifications, type GroupStandingsMap } from "../cricket/progression";
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
    currentInnings: innings.length,
    matchStatus: "completed",
  };
}

function completedInnings(
  battingTeamId: number,
  bowlingTeamId: number,
  runs: number,
  inningsNumber: number,
  kind: "normal" | "super_over" = "normal",
) {
  return {
    innings: inningsNumber,
    battingTeamId,
    bowlingTeamId,
    runs,
    wickets: kind === "super_over" ? 1 : 5,
    overs: kind === "super_over" ? "1.0" : "20.0",
    phase: "completed" as const,
    kind,
  };
}

function winMatch(
  matchId: number,
  winner: number,
  loser: number,
  winnerRuns = 160,
  loserRuns = 140,
): StandingsMatchInput {
  const home = winner;
  const away = loser;
  return {
    matchId,
    status: "completed",
    homeTeamId: home,
    awayTeamId: away,
    summary: summary(
      home,
      away,
      [
        completedInnings(away, home, loserRuns, 1),
        completedInnings(home, away, winnerRuns, 2),
      ],
      winner,
    ),
  };
}

function superOverWin(matchId: number, winner: number, loser: number): StandingsMatchInput {
  return {
    matchId,
    status: "completed",
    homeTeamId: winner,
    awayTeamId: loser,
    summary: summary(
      winner,
      loser,
      [
        completedInnings(winner, loser, 150, 1),
        completedInnings(loser, winner, 150, 2),
        completedInnings(winner, loser, 12, 3, "super_over"),
        completedInnings(loser, winner, 8, 4, "super_over"),
      ],
      winner,
    ),
  };
}

function noResult(matchId: number, home: number, away: number): StandingsMatchInput {
  return {
    matchId,
    status: "no_result",
    homeTeamId: home,
    awayTeamId: away,
    summary: null,
  };
}

describe("cricket points percentage", () => {
  it("returns 0 when a team has played no matches", () => {
    const rows = buildStandingsFromMatches([1, 2], []);
    expect(rows.every((row) => row.pointsPercentage === 0)).toBe(true);
    expect(rows.map((row) => row.teamId)).toEqual([1, 2]);
  });

  it("scores one win as 100%", () => {
    const rows = buildStandingsFromMatches([1, 2], [winMatch(1, 1, 2)]);
    expect(rows.find((row) => row.teamId === 1)?.pointsPercentage).toBe(100);
    expect(rows.find((row) => row.teamId === 2)?.pointsPercentage).toBe(0);
  });

  it("scores a tie and a no-result as half of the maximum", () => {
    const tied = buildStandingsFromMatches([1, 2], [
      {
        matchId: 1,
        status: "completed",
        homeTeamId: 1,
        awayTeamId: 2,
        isTie: true,
        summary: summary(1, 2, [], null),
      },
    ]);
    expect(tied[0]?.points).toBe(1);
    expect(tied[0]?.pointsPercentage).toBe(50);

    const abandoned = buildStandingsFromMatches([1, 2], [noResult(2, 1, 2)]);
    expect(abandoned.every((row) => row.points === 1 && row.pointsPercentage === 50)).toBe(true);
  });

  it("keeps repeating percentages at full precision", () => {
    const rows = buildStandingsFromMatches(
      [1, 2, 3],
      [winMatch(1, 1, 2), winMatch(2, 1, 3), noResult(3, 1, 2)],
    );
    const leader = rows.find((row) => row.teamId === 1)!;
    expect(leader.played).toBe(3);
    expect(leader.points).toBe(5);
    expect(leader.pointsPercentage).toBe((5 / 6) * 100);
    expect(leader.pointsPercentage).not.toBe(Number(leader.pointsPercentage.toFixed(2)));
  });

  it("uses the points rules configuration instead of a hard-coded maximum", () => {
    const rules = {
      ...DEFAULT_CRICKET_POINTS_RULES,
      winPoints: 4,
      maxPointsPerMatch: 4,
    };
    const rows = buildStandingsFromMatches([1, 2], [winMatch(1, 1, 2)], rules);
    const winner = rows.find((row) => row.teamId === 1)!;
    expect(winner.points).toBe(4);
    expect(winner.pointsPercentage).toBe(100);
    expect(computePointsPercentage(4, 1, rules)).toBe(100);
  });
});

describe("cricket ranking order", () => {
  it("ranks the higher points percentage above a team with more raw points", () => {
    // Team 1: 3 played, 4 points, 66.666...%
    // Team 2: 4 played, 6 points, 75%
    const matches = [
      winMatch(1, 2, 1, 180, 100),
      winMatch(2, 1, 3, 110, 100),
      winMatch(3, 1, 4, 110, 100),
      winMatch(4, 2, 3, 200, 80),
      winMatch(5, 2, 4, 200, 80),
      winMatch(6, 3, 2, 190, 70),
    ];
    const rows = buildStandingsFromMatches([1, 2, 3, 4], matches);
    const team1 = rows.find((row) => row.teamId === 1)!;
    const team2 = rows.find((row) => row.teamId === 2)!;
    expect(team1.played).toBe(3);
    expect(team1.points).toBe(4);
    expect(team1.pointsPercentage).toBe((4 / 6) * 100);
    expect(team2.played).toBe(4);
    expect(team2.points).toBe(6);
    expect(team2.pointsPercentage).toBe(75);
    expect(rows.map((row) => row.teamId).indexOf(2)).toBeLessThan(
      rows.map((row) => row.teamId).indexOf(1),
    );
  });

  it("ranks by points percentage when raw points favour the other team", () => {
    // Team 1: 3 played, 5 points, 83.333...%
    // Team 2: 4 played, 6 points, 75%, with a much higher NRR
    const matches = [
      winMatch(1, 1, 3, 121, 120),
      winMatch(2, 1, 4, 121, 120),
      noResult(3, 1, 5),
      winMatch(4, 2, 3, 220, 80),
      winMatch(5, 2, 4, 220, 80),
      winMatch(6, 2, 5, 220, 80),
      winMatch(7, 6, 2, 250, 40),
    ];
    const rows = buildStandingsFromMatches([1, 2, 3, 4, 5, 6], matches);
    const team1 = rows.find((row) => row.teamId === 1)!;
    const team2 = rows.find((row) => row.teamId === 2)!;
    expect(team1.points).toBe(5);
    expect(team1.played).toBe(3);
    expect(team1.pointsPercentage).toBe((5 / 6) * 100);
    expect(team2.points).toBe(6);
    expect(team2.played).toBe(4);
    expect(team2.pointsPercentage).toBe(75);
    expect(team2.points).toBeGreaterThan(team1.points);
    expect(team2.netRunRate).toBeGreaterThan(team1.netRunRate);
    expect(rows.map((row) => row.teamId).indexOf(1)).toBeLessThan(
      rows.map((row) => row.teamId).indexOf(2),
    );
  });

  it("breaks a points-percentage tie with net run rate", () => {
    const matches = [
      winMatch(1, 1, 3, 200, 100),
      winMatch(2, 2, 4, 160, 140),
    ];
    const rows = buildStandingsFromMatches([1, 2, 3, 4], matches);
    const team1 = rows.find((row) => row.teamId === 1)!;
    const team2 = rows.find((row) => row.teamId === 2)!;
    expect(team1.pointsPercentage).toBe(team2.pointsPercentage);
    expect(team1.netRunRate).toBeCloseTo(5, 3);
    expect(team2.netRunRate).toBeCloseTo(1, 3);
    expect(rows[0]?.teamId).toBe(1);
    expect(rows[1]?.teamId).toBe(2);
  });

  it("uses a league head-to-head win when points percentage and NRR are level", () => {
    const matches = [
      superOverWin(1, 1, 2),
      superOverWin(2, 3, 1),
      superOverWin(3, 2, 4),
    ];
    const rows = buildStandingsFromMatches([1, 2, 3, 4], matches);
    const team1 = rows.find((row) => row.teamId === 1)!;
    const team2 = rows.find((row) => row.teamId === 2)!;
    expect(team1.pointsPercentage).toBe(50);
    expect(team2.pointsPercentage).toBe(50);
    expect(team1.netRunRate).toBe(0);
    expect(team2.netRunRate).toBe(0);
    const headToHead = buildHeadToHeadIndex(
      matches.map((match) => ({
        status: match.status,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        winnerTeamId: match.summary?.winnerTeamId ?? null,
        isTie: match.isTie,
      })),
    );
    expect(compareCricketStandings(team1, team2, headToHead)).toBeLessThan(0);
    expect(rows.map((row) => row.teamId)).toEqual([3, 1, 2, 4]);
  });

  it("falls back to team id when there is no head-to-head", () => {
    const matches = [
      winMatch(1, 10, 30, 180, 100),
      winMatch(2, 20, 40, 180, 100),
    ];
    const rows = buildStandingsFromMatches([10, 20, 30, 40], matches);
    const first = rows.filter((row) => row.pointsPercentage === 100).map((row) => row.teamId);
    expect(first).toEqual([10, 20]);

    const reversedIds = buildStandingsFromMatches([20, 10, 40, 30], matches)
      .filter((row) => row.pointsPercentage === 100)
      .map((row) => row.teamId);
    expect(reversedIds).toEqual([10, 20]);
  });

  it("returns the same order for the same matches on every rebuild", () => {
    const matches = [
      winMatch(1, 2, 1, 180, 100),
      winMatch(2, 1, 3),
      winMatch(3, 4, 2, 200, 90),
      noResult(4, 3, 4),
      superOverWin(5, 4, 1),
    ];
    const expected = buildStandingsFromMatches([1, 2, 3, 4], matches).map((row) => ({
      teamId: row.teamId,
      points: row.points,
      pointsPercentage: row.pointsPercentage,
      netRunRate: row.netRunRate,
    }));

    for (let attempt = 0; attempt < 8; attempt++) {
      const again = buildStandingsFromMatches([4, 2, 1, 3], matches);
      expect(
        again.map((row) => ({
          teamId: row.teamId,
          points: row.points,
          pointsPercentage: row.pointsPercentage,
          netRunRate: row.netRunRate,
        })),
      ).toEqual(expected);
    }
  });

  it("drops a corrected result on rebuild instead of keeping the old points", () => {
    const teams = [1, 2];
    const initial = buildStandingsFromMatches(teams, [winMatch(1, 1, 2, 170, 120)]);
    expect(initial[0]?.teamId).toBe(1);
    expect(initial.find((row) => row.teamId === 1)?.points).toBe(2);
    expect(initial.find((row) => row.teamId === 2)?.points).toBe(0);

    const corrected = buildStandingsFromMatches(teams, [winMatch(1, 2, 1, 170, 120)]);
    expect(corrected[0]?.teamId).toBe(2);
    expect(corrected.find((row) => row.teamId === 2)?.points).toBe(2);
    expect(corrected.find((row) => row.teamId === 2)?.pointsPercentage).toBe(100);
    expect(corrected.find((row) => row.teamId === 1)?.points).toBe(0);
    expect(corrected.find((row) => row.teamId === 1)?.won).toBe(0);
    expect(corrected.find((row) => row.teamId === 1)?.pointsPercentage).toBe(0);
    expect(corrected.find((row) => row.teamId === 1)?.netRunRate).toBeLessThan(0);

    const repeated = buildStandingsFromMatches(teams, [winMatch(1, 2, 1, 170, 120)]);
    expect(repeated.map((row) => row.teamId)).toEqual(corrected.map((row) => row.teamId));
    expect(repeated.map((row) => row.points)).toEqual(corrected.map((row) => row.points));
    expect(repeated.map((row) => row.pointsPercentage)).toEqual(
      corrected.map((row) => row.pointsPercentage),
    );
  });
});

describe("cricket group qualification ranking", () => {
  it("ranks each group from its own matches and qualifies the top two", () => {
    const groupA = [
      winMatch(1, 12, 11, 180, 100),
      winMatch(2, 11, 13, 150, 140),
      winMatch(3, 11, 14, 150, 140),
      winMatch(4, 12, 13, 200, 80),
      winMatch(5, 12, 14, 200, 80),
      winMatch(6, 13, 12, 190, 70),
    ];
    const groupB = [
      winMatch(7, 21, 23, 121, 120),
      winMatch(8, 21, 24, 121, 120),
      noResult(9, 21, 23),
      winMatch(10, 22, 23, 220, 80),
      winMatch(11, 22, 24, 220, 80),
      winMatch(12, 22, 23, 210, 90),
      winMatch(13, 24, 22, 180, 100),
    ];

    const groupARows = buildStandingsFromMatches([11, 12, 13, 14], groupA);
    const groupBRows = buildStandingsFromMatches([21, 22, 23, 24], groupB);
    const leaked = buildStandingsFromMatches(
      [11, 12, 13, 14],
      [...groupA, winMatch(99, 11, 21, 200, 100)],
    );

    expect(groupARows.map((row) => row.teamId)).toEqual([12, 11, 13, 14]);
    expect(groupARows[0]?.pointsPercentage).toBe(75);
    expect(groupARows[1]?.pointsPercentage).toBe((4 / 6) * 100);
    expect(groupBRows[0]?.teamId).toBe(21);
    expect(groupBRows[0]?.points).toBe(5);
    expect(groupBRows[0]?.pointsPercentage).toBe((5 / 6) * 100);
    expect(groupBRows[1]?.teamId).toBe(22);
    expect(groupBRows[1]?.points).toBe(6);
    expect(groupBRows[1]?.pointsPercentage).toBe(75);
    expect(groupBRows[1]?.points).toBeGreaterThan(groupBRows[0]?.points ?? 0);
    expect(leaked.find((row) => row.teamId === 11)?.played).toBe(
      (groupARows.find((row) => row.teamId === 11)?.played ?? 0) + 1,
    );

    const groupStandings: GroupStandingsMap = {
      "Group A": { groupName: "Group A", standings: groupARows, isComplete: true },
      "Group B": { groupName: "Group B", standings: groupBRows, isComplete: true },
    };
    const resolved = resolveGroupQualifications(
      [{ name: "Group A" }, { name: "Group B" }],
      { type: "top_n_per_group", count: 2 },
      groupStandings,
    );

    expect(resolved.isReady).toBe(true);
    expect(resolved.errors).toEqual([]);
    expect(resolved.qualifiersBySlotKey).toEqual({
      "GROUP A#1": 12,
      "GROUP A#2": 11,
      "GROUP B#1": 21,
      "GROUP B#2": 22,
    });
    expect(new Set(resolved.qualifierTeamIds).size).toBe(4);
  });

  it("qualifies a different prefix when the configured count changes", () => {
    const rows = buildStandingsFromMatches(
      [11, 12, 13, 14],
      [
        winMatch(1, 12, 11, 180, 100),
        winMatch(2, 11, 13, 150, 140),
        winMatch(3, 11, 14, 150, 140),
        winMatch(4, 12, 13, 200, 80),
        winMatch(5, 12, 14, 200, 80),
        winMatch(6, 13, 12, 190, 70),
      ],
    );
    const order = rows.map((row) => row.teamId);
    const one = resolveGroupQualifications(
      [{ name: "Group A" }],
      { type: "top_n_per_group", count: 1 },
      { "Group A": { groupName: "Group A", standings: rows, isComplete: true } },
    );
    const three = resolveGroupQualifications(
      [{ name: "Group A" }],
      { type: "top_n_per_group", count: 3 },
      { "Group A": { groupName: "Group A", standings: rows, isComplete: true } },
    );
    expect(one.qualifierTeamIds).toEqual(order.slice(0, 1));
    expect(three.qualifierTeamIds).toEqual(order.slice(0, 3));
  });
});

describe("full-precision NRR ranking", () => {
  it("keeps a higher full-precision NRR above a value that rounds to the same 3 decimals", () => {
    const higher = computeNetRunRate({
      runsScored: 123.46,
      oversFaced: 1000,
      runsConceded: 0,
      oversBowled: 1000,
    });
    const lower = computeNetRunRate({
      runsScored: 123.44,
      oversFaced: 1000,
      runsConceded: 0,
      oversBowled: 1000,
    });
    expect(higher).toBeCloseTo(0.12346, 8);
    expect(lower).toBeCloseTo(0.12344, 8);
    expect(higher.toFixed(3)).toBe(lower.toFixed(3));

    const full = rankCricketStandings([
      { teamId: 1, played: 1, points: 2, netRunRate: lower },
      { teamId: 2, played: 1, points: 2, netRunRate: higher },
    ]);
    const rounded = rankCricketStandings([
      { teamId: 1, played: 1, points: 2, netRunRate: Number(lower.toFixed(3)) },
      { teamId: 2, played: 1, points: 2, netRunRate: Number(higher.toFixed(3)) },
    ]);

    expect(full.map((row) => row.teamId)).toEqual([2, 1]);
    expect(rounded.map((row) => row.teamId)).toEqual([1, 2]);

    const qualifiedRows: TeamStandingComputed[] = full.map((row) => ({
      teamId: row.teamId,
      played: row.played,
      won: 1,
      lost: 0,
      tied: 0,
      noResult: 0,
      points: row.points,
      pointsPercentage: row.pointsPercentage,
      netRunRate: row.netRunRate,
      runsScored: 0,
      oversFaced: 0,
      runsConceded: 0,
      oversBowled: 0,
    }));
    const qualified = resolveGroupQualifications(
      [{ name: "Group A" }],
      { type: "top_n_per_group", count: 1 },
      { "Group A": { groupName: "Group A", standings: qualifiedRows, isComplete: true } },
    );
    expect(qualified.qualifierTeamIds).toEqual([2]);
  });

  it("recovers ranking NRR from stored run and over totals after the column is rounded", () => {
    const built = buildStandingsFromMatches(
      [1, 2],
      [winMatch(1, 2, 1, 161, 140), winMatch(2, 1, 2, 180, 120)],
    );
    const reread = rankCricketStandings(
      built.map((row) => ({
        teamId: row.teamId,
        played: row.played,
        won: row.won,
        lost: row.lost,
        tied: row.tied,
        noResult: row.noResult,
        points: row.points,
        netRunRate: rankingNetRunRate(row.netRunRate.toFixed(3), {
          runsScored: row.runsScored,
          oversFaced: row.oversFaced,
          runsConceded: row.runsConceded,
          oversBowled: row.oversBowled,
        }),
      })),
    );

    expect(reread.map((row) => row.teamId)).toEqual(built.map((row) => row.teamId));
    expect(reread.map((row) => row.points)).toEqual(built.map((row) => row.points));
    expect(reread.map((row) => row.pointsPercentage)).toEqual(
      built.map((row) => row.pointsPercentage),
    );
    expect(reread.map((row) => row.netRunRate)).toEqual(built.map((row) => row.netRunRate));
    expect(rankingNetRunRate("1.250", null)).toBe(1.25);
    expect(rankingNetRunRate(null, null)).toBe(0);
  });

  it("formats points percentage and NRR without changing the ranked values", () => {
    expect(formatPointsPercentage(75)).toBe("75.00%");
    expect(formatPointsPercentage(83.3333333333)).toBe("83.33%");
    expect(formatNetRunRate(1.234)).toBe("+1.234");
    expect(formatNetRunRate(-0.456)).toBe("-0.456");
    expect(formatNetRunRate(0)).toBe("0.000");
    expect(formatNetRunRate(-0.456).includes("+-")).toBe(false);

    const rows = rankCricketStandings([
      { teamId: 2, played: 4, points: 6, netRunRate: -0.456 },
      { teamId: 1, played: 3, points: 5, netRunRate: 1.234 },
    ]);
    expect(rows.map((row) => row.teamId)).toEqual([1, 2]);
    expect(rows.map((row) => formatPointsPercentage(row.pointsPercentage))).toEqual([
      "83.33%",
      "75.00%",
    ]);
    expect(rows.map((row) => formatNetRunRate(row.netRunRate))).toEqual(["+1.234", "-0.456"]);
  });
});
