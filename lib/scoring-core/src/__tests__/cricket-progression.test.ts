import { describe, expect, it } from "vitest";
import {
  buildLeagueKnockoutStages,
  makeSlotKey,
  resolveGroupQualifications,
  resolveParticipantSource,
  type GroupStandingsMap,
} from "../cricket/progression";
import type { TeamStandingComputed } from "../cricket/standings";

function mockStanding(teamId: number, points: number, nrr: number): TeamStandingComputed {
  return {
    teamId,
    played: 3,
    won: points / 2,
    lost: 3 - points / 2,
    tied: 0,
    noResult: 0,
    points,
    netRunRate: nrr,
    runsScored: 300,
    oversFaced: 60,
    runsConceded: 280,
    oversBowled: 60,
  };
}

describe("cricket stage progression & qualification engine", () => {
  it("builds generic league knockout stage graph for 2 groups with top 2 qualifiers", () => {
    const stages = buildLeagueKnockoutStages(
      [
        { name: "Group A", teamIds: [1, 2, 3, 4] },
        { name: "Group B", teamIds: [5, 6, 7, 8] },
      ],
      { qualifiersPerGroup: 2 },
    );

    expect(stages.stages).toHaveLength(3); // Groups, Semi Finals, Final
    const [groupStage, semiStage, finalStage] = stages.stages;

    expect(groupStage?.type).toBe("league");
    expect(groupStage?.qualification?.count).toBe(2);

    expect(semiStage?.type).toBe("knockout");
    expect(semiStage?.fixtures).toHaveLength(2);
    expect(semiStage?.fixtures?.[0]?.homeSource).toEqual({ type: "group_rank", groupName: "Group A", rank: 1 });
    expect(semiStage?.fixtures?.[0]?.awaySource).toEqual({ type: "group_rank", groupName: "Group B", rank: 2 });
    expect(semiStage?.fixtures?.[1]?.homeSource).toEqual({ type: "group_rank", groupName: "Group B", rank: 1 });
    expect(semiStage?.fixtures?.[1]?.awaySource).toEqual({ type: "group_rank", groupName: "Group A", rank: 2 });

    expect(finalStage?.type).toBe("knockout");
    expect(finalStage?.fixtures).toHaveLength(1);
    expect(finalStage?.fixtures?.[0]?.homeSource).toEqual({
      type: "winner_of",
      roundName: "Semi Final 1",
      bracketRound: 0,
      bracketSlot: 0,
    });
    expect(finalStage?.fixtures?.[0]?.awaySource).toEqual({
      type: "winner_of",
      roundName: "Semi Final 2",
      bracketRound: 0,
      bracketSlot: 1,
    });
  });

  it("builds generic single group stage graph with top 2 to final", () => {
    const stages = buildLeagueKnockoutStages([{ name: "League", teamIds: [10, 20, 30, 40] }], {
      qualifiersPerGroup: 2,
    });

    expect(stages.stages).toHaveLength(2);
    const [leagueStage, finalStage] = stages.stages;

    expect(leagueStage?.type).toBe("league");
    expect(finalStage?.type).toBe("knockout");
    expect(finalStage?.fixtures?.[0]?.homeSource).toEqual({ type: "group_rank", groupName: "League", rank: 1 });
    expect(finalStage?.fixtures?.[0]?.awaySource).toEqual({ type: "group_rank", groupName: "League", rank: 2 });
  });

  it("builds 4 groups stage graph with top 2 qualifiers into Quarter Finals", () => {
    const stages = buildLeagueKnockoutStages(
      [
        { name: "Group A", teamIds: [1, 2] },
        { name: "Group B", teamIds: [3, 4] },
        { name: "Group C", teamIds: [5, 6] },
        { name: "Group D", teamIds: [7, 8] },
      ],
      { qualifiersPerGroup: 2 },
    );

    expect(stages.stages).toHaveLength(4); // Groups -> QF -> SF -> Final
    expect(stages.stages[1]?.fixtures).toHaveLength(4); // 4 quarter-finals
    expect(stages.stages[2]?.fixtures).toHaveLength(2); // 2 semi-finals
    expect(stages.stages[3]?.fixtures).toHaveLength(1); // 1 final
  });

  it("resolves qualifications correctly when all group matches are completed", () => {
    const groupStandings: GroupStandingsMap = {
      "Group A": {
        groupName: "Group A",
        isComplete: true,
        standings: [
          mockStanding(101, 6, 1.25), // Rank 1
          mockStanding(102, 4, 0.45), // Rank 2
          mockStanding(103, 2, -0.3),
        ],
      },
      "Group B": {
        groupName: "Group B",
        isComplete: true,
        standings: [
          mockStanding(201, 6, 2.1), // Rank 1
          mockStanding(202, 4, 0.8), // Rank 2
          mockStanding(203, 0, -1.5),
        ],
      },
    };

    const resolution = resolveGroupQualifications(
      [{ name: "Group A" }, { name: "Group B" }],
      { type: "top_n_per_group", count: 2 },
      groupStandings,
    );

    expect(resolution.isReady).toBe(true);
    expect(resolution.errors).toHaveLength(0);
    expect(resolution.qualifiersBySlotKey[makeSlotKey("Group A", 1)]).toBe(101);
    expect(resolution.qualifiersBySlotKey[makeSlotKey("Group A", 2)]).toBe(102);
    expect(resolution.qualifiersBySlotKey[makeSlotKey("Group B", 1)]).toBe(201);
    expect(resolution.qualifiersBySlotKey[makeSlotKey("Group B", 2)]).toBe(202);
  });

  it("prevents qualification when a group stage has incomplete matches", () => {
    const groupStandings: GroupStandingsMap = {
      "Group A": {
        groupName: "Group A",
        isComplete: true,
        standings: [mockStanding(101, 6, 1.25), mockStanding(102, 4, 0.45)],
      },
      "Group B": {
        groupName: "Group B",
        isComplete: false, // Incomplete!
        standings: [mockStanding(201, 4, 1.1), mockStanding(202, 2, 0.2)],
      },
    };

    const resolution = resolveGroupQualifications(
      [{ name: "Group A" }, { name: "Group B" }],
      { type: "top_n_per_group", count: 2 },
      groupStandings,
    );

    expect(resolution.isReady).toBe(false);
    expect(resolution.errors.some((e) => e.includes("incomplete"))).toBe(true);
  });

  it("prevents duplicate qualification of same team", () => {
    const groupStandings: GroupStandingsMap = {
      "Group A": {
        groupName: "Group A",
        isComplete: true,
        standings: [mockStanding(101, 6, 1.25), mockStanding(101, 4, 0.45)], // Same team listed twice!
      },
    };

    const resolution = resolveGroupQualifications(
      [{ name: "Group A" }],
      { type: "top_n_per_group", count: 2 },
      groupStandings,
    );

    expect(resolution.isReady).toBe(false);
    expect(resolution.errors.some((e) => e.includes("Duplicate qualification"))).toBe(true);
  });

  it("resolves participant sources correctly", () => {
    const qualifiersBySlotKey: Record<string, number> = {
      [makeSlotKey("Group A", 1)]: 101,
      [makeSlotKey("Group B", 2)]: 202,
    };

    const sf1Home = resolveParticipantSource(
      { type: "group_rank", groupName: "Group A", rank: 1 },
      { qualifiersBySlotKey },
    );
    expect(sf1Home.resolved).toBe(true);
    expect(sf1Home.teamId).toBe(101);

    const sf1Away = resolveParticipantSource(
      { type: "group_rank", groupName: "Group B", rank: 2 },
      { qualifiersBySlotKey },
    );
    expect(sf1Away.resolved).toBe(true);
    expect(sf1Away.teamId).toBe(202);

    // Winner of semi-final
    const finalHomeUnresolved = resolveParticipantSource(
      { type: "winner_of", roundName: "Semi Final 1" },
      { qualifiersBySlotKey, matchWinnersByRoundName: {} },
    );
    expect(finalHomeUnresolved.resolved).toBe(false);
    expect(finalHomeUnresolved.teamId).toBe(0);

    const finalHomeResolved = resolveParticipantSource(
      { type: "winner_of", roundName: "Semi Final 1" },
      { qualifiersBySlotKey, matchWinnersByRoundName: { "Semi Final 1": 101 } },
    );
    expect(finalHomeResolved.resolved).toBe(true);
    expect(finalHomeResolved.teamId).toBe(101);
  });
});
