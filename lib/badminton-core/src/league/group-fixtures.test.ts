import { describe, expect, it } from "vitest";
import { planTeamTieGroupFixtures } from "./group-fixtures";

describe("planTeamTieGroupFixtures", () => {
  it("generates 15 fixtures for 3 teams with 5 pairs each (VNBL Group)", () => {
    const teams = [
      { teamId: 1, teamName: "Team A", registrationIds: [101, 102, 103, 104, 105] },
      { teamId: 2, teamName: "Team B", registrationIds: [201, 202, 203, 204, 205] },
      { teamId: 3, teamName: "Team C", registrationIds: [301, 302, 303, 304, 305] },
    ];

    const fixtures = planTeamTieGroupFixtures("Group 1", teams);
    expect(fixtures).toHaveLength(15);

    const abRubbers = fixtures.filter(
      (f) => f.metaJson.teamAId === 1 && f.metaJson.teamBId === 2,
    );
    expect(abRubbers).toHaveLength(5);
    expect(abRubbers[0]?.registrationAId).toBe(101);
    expect(abRubbers[0]?.registrationBId).toBe(201);
  });
});
