import { describe, expect, it } from "vitest";
import {
  makeGroupIdSlotKey,
  resolveCompetitionParticipant,
  resolveGroupIdWithinDraw,
  resolveGroupQualifications,
  uniqueDrawFixtureByRoundName,
  type GroupStandingsMap,
} from "../cricket/progression";
import type { TeamStandingComputed } from "../cricket/standings";

function row(teamId: number, points: number): TeamStandingComputed {
  return {
    teamId,
    played: 2,
    won: points / 2,
    lost: 2 - points / 2,
    tied: 0,
    noResult: 0,
    points,
    pointsPercentage: (points / 4) * 100,
    netRunRate: points,
    runsScored: 100,
    oversFaced: 20,
    runsConceded: 80,
    oversBowled: 20,
  };
}

function standings(groupId: number, name: string, teams: number[]): GroupStandingsMap {
  return {
    [`id:${groupId}`]: {
      groupName: name,
      groupId,
      standings: teams.map((teamId, index) => row(teamId, 4 - index)),
      isComplete: true,
    },
  };
}

describe("cricket draw isolation", () => {
  it("qualifies each draw by group id when both draws have Group A and Group B", () => {
    const d1 = resolveGroupQualifications(
      [
        { name: "Group A", groupId: 11 },
        { name: "Group B", groupId: 12 },
      ],
      { type: "top_n_per_group", count: 2 },
      { ...standings(11, "Group A", [101, 102]), ...standings(12, "Group B", [103, 104]) },
    );
    const d2 = resolveGroupQualifications(
      [
        { name: "Group A", groupId: 21 },
        { name: "Group B", groupId: 22 },
      ],
      { type: "top_n_per_group", count: 2 },
      { ...standings(21, "Group A", [201, 202]), ...standings(22, "Group B", [203, 204]) },
    );

    expect(d1.isReady).toBe(true);
    expect(d1.qualifiersBySlotKey[makeGroupIdSlotKey(11, 1)]).toBe(101);
    expect(d1.qualifiersBySlotKey[makeGroupIdSlotKey(12, 1)]).toBe(103);
    expect(d1.qualifierTeamIds).not.toContain(201);

    expect(d2.isReady).toBe(true);
    expect(d2.qualifiersBySlotKey[makeGroupIdSlotKey(21, 1)]).toBe(201);
    expect(d2.qualifierTeamIds).not.toContain(101);
  });

  it("does not fall back from a foreign group id to a same-named group", () => {
    const groups = [
      { id: 11, name: "Group A" },
      { id: 12, name: "Group B" },
    ];
    expect(resolveGroupIdWithinDraw({ groupId: 21, groupName: "Group A" }, groups)).toBeNull();
    expect(resolveGroupIdWithinDraw({ groupName: "Group A" }, groups)).toBe(11);
  });

  it("fills D1 final from D1 semi winner and ignores D2's identical round name", () => {
    const d1Fixtures = [
      { id: 501, drawId: 1, roundName: "Semi Final 1" },
      { id: 502, drawId: 1, roundName: "Semi Final 2" },
      { id: 503, drawId: 1, roundName: "Final" },
    ];
    const d2Fixtures = [
      { id: 601, drawId: 2, roundName: "Semi Final 1" },
      { id: 602, drawId: 2, roundName: "Semi Final 2" },
      { id: 603, drawId: 2, roundName: "Final" },
    ];
    const winners = { 501: 101, 502: 103, 601: 201, 602: 203 };

    const d1Home = resolveCompetitionParticipant({
      source: { type: "winner_of", roundName: "Semi Final 1", fixtureId: 501 },
      drawId: 1,
      groups: [],
      fixtures: d1Fixtures,
      qualifiersBySlotKey: {},
      winnersByFixtureId: winners,
    });
    const d2Home = resolveCompetitionParticipant({
      source: { type: "winner_of", roundName: "Semi Final 1" },
      drawId: 2,
      groups: [],
      fixtures: d2Fixtures,
      qualifiersBySlotKey: {},
      winnersByFixtureId: winners,
    });

    expect(d1Home).toMatchObject({ resolved: true, teamId: 101 });
    expect(d2Home).toMatchObject({ resolved: true, teamId: 201 });
    expect(d1Home.teamId).not.toBe(201);
    expect(d2Home.teamId).not.toBe(101);
  });

  it("rejects a winner source that points at another draw's fixture", () => {
    const resolved = resolveCompetitionParticipant({
      source: { type: "winner_of", roundName: "Semi Final 1", fixtureId: 601 },
      drawId: 1,
      groups: [],
      fixtures: [{ id: 501, drawId: 1, roundName: "Semi Final 1" }],
      qualifiersBySlotKey: {},
      winnersByFixtureId: { 601: 201, 501: 101 },
    });
    expect(resolved.resolved).toBe(false);
    expect(resolved.teamId).toBe(0);
  });

  it("does not guess when one draw has two fixtures with the same round name", () => {
    expect(
      uniqueDrawFixtureByRoundName(
        [
          { id: 1, drawId: 1, roundName: "Semi Final 1" },
          { id: 2, drawId: 1, roundName: "Semi Final 1" },
          { id: 3, drawId: 2, roundName: "Semi Final 1" },
        ],
        1,
        "Semi Final 1",
      ),
    ).toBeNull();
  });

  it("resolves the same slot again without changing the team", () => {
    const args = {
      source: { type: "winner_of" as const, fixtureId: 501, roundName: "Semi Final 1" },
      drawId: 1,
      groups: [],
      fixtures: [{ id: 501, drawId: 1, roundName: "Semi Final 1" }],
      qualifiersBySlotKey: {},
      winnersByFixtureId: { 501: 101 },
    };
    expect(resolveCompetitionParticipant(args).teamId).toBe(resolveCompetitionParticipant(args).teamId);
  });
});
