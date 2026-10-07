import { describe, expect, it } from "vitest";
import {
  bracketBoardsByDraw,
  competitionGroupTitle,
  groupSelectorToken,
  isMultiDrawCompetition,
  listTeamCompetitionRows,
  matchForBracketFixture,
  parseCompetitionSelection,
  partitionByDraw,
  rankInDraw,
  resolveCompetitionGroup,
  resolveTeamStanding,
  rowsForCompetitionSelection,
} from "../cricket/competition-view";

const groups = [
  {
    id: 11,
    name: "Group A",
    drawId: 1,
    drawName: "Classes 4–5–6",
    displayName: "Classes 4–5–6 — Group A",
    qualifiersPerGroup: 2,
    rows: [
      { teamId: 101, drawId: 1, teamName: "DPS Aarambh", points: 4 },
      { teamId: 102, drawId: 1, teamName: "ABC School", points: 0 },
    ],
  },
  {
    id: 12,
    name: "Group B",
    drawId: 1,
    drawName: "Classes 4–5–6",
    displayName: "Classes 4–5–6 — Group B",
    qualifiersPerGroup: 2,
    rows: [{ teamId: 103, drawId: 1, teamName: "North", points: 2 }],
  },
  {
    id: 21,
    name: "Group A",
    drawId: 2,
    drawName: "Classes 7–8–9",
    displayName: "Classes 7–8–9 — Group A",
    qualifiersPerGroup: 2,
    rows: [
      { teamId: 202, drawId: 2, teamName: "XYZ School", points: 4 },
      { teamId: 201, drawId: 2, teamName: "DPS Aarambh", points: 0 },
    ],
  },
];

const flat = [
  { teamId: 101, drawId: 1, teamName: "DPS Aarambh", points: 4 },
  { teamId: 102, drawId: 1, teamName: "ABC School", points: 0 },
  { teamId: 202, drawId: 2, teamName: "XYZ School", points: 4 },
  { teamId: 201, drawId: 2, teamName: "DPS Aarambh", points: 0 },
];

describe("cricket competition consumers", () => {
  it("keeps a single draw on one section and allows a top band only there", () => {
    const singleGroups = [groups[0]!, groups[1]!];
    const singleRows = flat.filter((row) => row.drawId === 1);
    expect(isMultiDrawCompetition(singleGroups, singleRows)).toBe(false);
    const sections = partitionByDraw(singleGroups, singleRows);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.groups.map((group) => group.id)).toEqual([11, 12]);
    const all = rowsForCompetitionSelection(singleGroups, singleRows, { kind: "all" });
    expect(all.qualifiers).toBe(0);
    const noGroups = rowsForCompetitionSelection([], singleRows, { kind: "all" });
    expect(noGroups.qualifiers).toBe(4);
    expect(noGroups.rows.map((row) => row.teamId)).toEqual([101, 102]);
  });

  it("renders two draws with the same group name as separate sections", () => {
    const sections = partitionByDraw(groups, flat);
    expect(sections.map((section) => section.drawName)).toEqual([
      "Classes 4–5–6",
      "Classes 7–8–9",
    ]);
    expect(sections[0]?.groups.map((group) => group.id)).toEqual([11, 12]);
    expect(sections[1]?.groups.map((group) => group.id)).toEqual([21]);
    expect(competitionGroupTitle(groups[0]!)).toBe("Classes 4–5–6 — Group A");
    expect(competitionGroupTitle(groups[2]!)).toBe("Classes 7–8–9 — Group A");
  });

  it("resolves Group A by group id and refuses a shared name", () => {
    const byId = resolveCompetitionGroup(groups, parseCompetitionSelection(groupSelectorToken(11)));
    expect(byId.group?.id).toBe(11);
    expect(byId.group?.rows[0]?.teamId).toBe(101);
    const byName = resolveCompetitionGroup(groups, parseCompetitionSelection("Group A"));
    expect(byName.ambiguous).toBe(true);
    expect(byName.group).toBeNull();
    const slice = rowsForCompetitionSelection(groups, flat, parseCompetitionSelection("Group A"));
    expect(slice.rows).toEqual([]);
    const selected = rowsForCompetitionSelection(groups, flat, { kind: "group", groupId: 21 });
    expect(selected.rows.map((row) => row.teamId)).toEqual([202, 201]);
    expect(selected.rows.find((row) => row.teamId === 101)).toBeUndefined();
  });

  it("keeps the same team id and the same display name on independent ranks", () => {
    expect(rankInDraw(flat, 101, 1)).toBe(1);
    expect(rankInDraw(flat, 201, 2)).toBe(2);
    expect(resolveTeamStanding(flat, 101, 1)?.points).toBe(4);
    expect(resolveTeamStanding(flat, 101, 2)).toBeNull();
    expect(resolveTeamStanding(flat, 201, 2)?.teamName).toBe("DPS Aarambh");
    expect(listTeamCompetitionRows(flat, 101)).toHaveLength(1);
    expect(resolveTeamStanding(flat, 101)).toMatchObject({ drawId: 1, points: 4 });
  });

  it("does not present a tournament-wide top 4 when several draws exist", () => {
    const all = rowsForCompetitionSelection(groups, flat, { kind: "all" });
    expect(all.qualifiers).toBe(0);
    expect(all.rows).toEqual([]);
  });

  it("uses a null draw row only as the single legacy table", () => {
    const legacy = [{ teamId: 101, drawId: null, points: 2 }];
    expect(resolveTeamStanding(legacy, 101)?.points).toBe(2);
    expect(resolveTeamStanding([...flat, { teamId: 101, drawId: null, points: 9 }], 101, 1)?.points).toBe(4);
    const sections = partitionByDraw(groups, [...flat, { teamId: 999, drawId: null, points: 1 }]);
    expect(sections.every((section) => section.rows.every((row) => row.drawId === section.drawId))).toBe(true);
    expect(sections.some((section) => section.rows.some((row) => row.teamId === 999))).toBe(false);
  });

  it("switches the selected competition without following another draw's rows", () => {
    const first = rowsForCompetitionSelection(groups, flat, { kind: "draw", drawId: 1 });
    const second = rowsForCompetitionSelection(groups, flat, { kind: "draw", drawId: 2 });
    expect(first.rows.map((row) => row.teamId)).toEqual([101, 102]);
    expect(second.rows.map((row) => row.teamId)).toEqual([202, 201]);
    const refreshed = rowsForCompetitionSelection(
      groups.map((group) =>
        group.id === 11
          ? { ...group, rows: [{ teamId: 102, drawId: 1, teamName: "ABC School", points: 4 }] }
          : group,
      ),
      flat,
      parseCompetitionSelection("group:11"),
    );
    expect(refreshed.group?.id).toBe(11);
    expect(refreshed.rows[0]?.teamId).toBe(102);
    expect(refreshed.rows.some((row) => row.drawId === 2)).toBe(false);
  });

  it("keeps identical knockout labels on separate draw boards and links matches by fixture id", () => {
    const fixtures = [
      { id: 501, drawId: 1, bracketRound: 0, bracketSlot: 0, roundName: "Semi Final 1", homeTeamId: 101, awayTeamId: 103 },
      { id: 502, drawId: 1, bracketRound: 0, bracketSlot: 1, roundName: "Semi Final 2", homeTeamId: 102, awayTeamId: 104 },
      { id: 503, drawId: 1, bracketRound: 1, bracketSlot: 0, roundName: "Final", homeTeamId: 101, awayTeamId: 102 },
      { id: 601, drawId: 2, bracketRound: 0, bracketSlot: 0, roundName: "Semi Final 1", homeTeamId: 201, awayTeamId: 203 },
      { id: 603, drawId: 2, bracketRound: 1, bracketSlot: 0, roundName: "Final", homeTeamId: 201, awayTeamId: 202 },
    ];
    const matches = [
      { id: 1, fixtureId: 501, homeTeamId: 101, awayTeamId: 103, roundName: "Semi Final 1" },
      { id: 2, fixtureId: 601, homeTeamId: 201, awayTeamId: 203, roundName: "Semi Final 1" },
    ];
    const boards = bracketBoardsByDraw(fixtures, [
      { id: 1, name: "Classes 4–5–6" },
      { id: 2, name: "Classes 7–8–9" },
    ]);
    expect(boards).toHaveLength(2);
    expect(boards[0]?.fixtures.map((fixture) => fixture.id)).toEqual([501, 502, 503]);
    expect(boards[1]?.fixtures.map((fixture) => fixture.id)).toEqual([601, 603]);
    expect(matchForBracketFixture(fixtures[0]!, matches)?.id).toBe(1);
    expect(matchForBracketFixture(fixtures[3]!, matches)?.id).toBe(2);
    expect(matchForBracketFixture(fixtures[0]!, matches)?.id).not.toBe(2);
  });
});
