import { describe, expect, it } from "vitest";
import {
  bracketBoardsByDraw,
  bracketMatchesByDraw,
  broadcastStageChoices,
  competitionGroupTitle,
  cricketGroupChoices,
  groupChoiceIsSelected,
  groupSelectorToken,
  legacyRoundGroupLabels,
  matchMatchesLegacyGroupLabel,
  resolvedMatchGroupId,
  usesLegacyGroupNameFilter,
  isMultiDrawCompetition,
  knockoutBroadcastStageChoices,
  listTeamCompetitionRows,
  matchForBracketFixture,
  mergeObsDirectorSnapshot,
  parseCompetitionSelection,
  partitionByDraw,
  rankInDraw,
  resolveCompetitionGroup,
  resolveKnockoutStageSelection,
  resolveTeamStanding,
  retainStageSelection,
  roundSelectorToken,
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

const stageFixtures = [
  { id: 501, drawId: 1, roundName: "Semi-Finals", homeTeamId: 101, awayTeamId: 102 },
  { id: 502, drawId: 1, roundName: "Final", homeTeamId: 101, awayTeamId: 103 },
  { id: 601, drawId: 2, roundName: "Semi-Finals", homeTeamId: 201, awayTeamId: 202 },
  { id: 602, drawId: 2, roundName: "Final", homeTeamId: 201, awayTeamId: 203 },
];

const stageMatches = [
  { id: 11, fixtureId: 501, roundName: "Semi-Finals" },
  { id: 12, fixtureId: 502, roundName: "Final" },
  { id: 21, fixtureId: 601, roundName: "Semi-Finals" },
  { id: 22, fixtureId: 602, roundName: "Final" },
];

const stageDraws = [
  { id: 1, name: "Classes 4–5–6" },
  { id: 2, name: "Classes 7–8–9" },
];

describe("knockout stage identity", () => {
  it("selecting D1 Semi-Finals shows only D1 fixtures", () => {
    const token = roundSelectorToken(1, "Semi-Finals");
    expect(token).toBe("draw:1:round:Semi-Finals");
    const resolved = resolveKnockoutStageSelection(
      stageFixtures,
      stageMatches,
      parseCompetitionSelection(token),
    );
    expect(resolved.ambiguous).toBe(false);
    expect(resolved.drawId).toBe(1);
    expect(resolved.fixtures.map((fixture) => fixture.id)).toEqual([501]);
    expect(resolved.matches.map((match) => match.id)).toEqual([11]);
    expect(resolved.fixtures.some((fixture) => fixture.drawId === 2)).toBe(false);
  });

  it("selecting D2 Semi-Finals shows only D2 fixtures", () => {
    const resolved = resolveKnockoutStageSelection(
      stageFixtures,
      stageMatches,
      parseCompetitionSelection(roundSelectorToken(2, "Semi-Finals")),
    );
    expect(resolved.fixtures.map((fixture) => fixture.id)).toEqual([601]);
    expect(resolved.matches.map((match) => match.id)).toEqual([21]);
    expect(resolved.matches.some((match) => match.id === 11)).toBe(false);
  });

  it("treats a shared plain Semi-Finals token as unresolved", () => {
    const resolved = resolveKnockoutStageSelection(
      stageFixtures,
      stageMatches,
      parseCompetitionSelection("Semi-Finals"),
    );
    expect(resolved.ambiguous).toBe(true);
    expect(resolved.fixtures).toEqual([]);
    expect(resolved.matches).toEqual([]);
    expect(resolved.fixtures[0]).not.toEqual(stageFixtures[0]);
    expect(resolved.matches.map((match) => match.id)).not.toContain(11);
    expect(resolved.matches.map((match) => match.id)).not.toContain(21);
  });

  it("keeps a plain Semi-Finals token when only one draw has that stage", () => {
    const singleFixtures = stageFixtures.filter((fixture) => fixture.drawId === 1);
    const singleMatches = stageMatches.filter((match) => match.fixtureId === 501 || match.fixtureId === 502);
    const resolved = resolveKnockoutStageSelection(
      singleFixtures,
      singleMatches,
      parseCompetitionSelection("Semi-Finals"),
    );
    expect(resolved.ambiguous).toBe(false);
    expect(resolved.drawId).toBe(1);
    expect(resolved.fixtures.map((fixture) => fixture.id)).toEqual([501]);
    expect(resolved.matches.map((match) => match.id)).toEqual([11]);
  });

  it("keeps D1 Final and D2 Final on separate slates", () => {
    const d1 = resolveKnockoutStageSelection(
      stageFixtures,
      stageMatches,
      parseCompetitionSelection(roundSelectorToken(1, "Final")),
    );
    const d2 = resolveKnockoutStageSelection(
      stageFixtures,
      stageMatches,
      parseCompetitionSelection(roundSelectorToken(2, "Final")),
    );
    expect(d1.fixtures.map((fixture) => fixture.id)).toEqual([502]);
    expect(d2.fixtures.map((fixture) => fixture.id)).toEqual([602]);
    expect(d1.matches.map((match) => match.id)).toEqual([12]);
    expect(d2.matches.map((match) => match.id)).toEqual([22]);
  });

  it("preserves a stored D1 stage token when D2 has the same stage name", () => {
    const stored = roundSelectorToken(1, "Semi-Finals");
    const refreshed = mergeObsDirectorSnapshot(
      { overlay: "standings", stageOrGroup: stored },
      { type: "cricket_obs_director", overlay: "standings", timestamp: 20 },
    );
    expect(refreshed.stageOrGroup).toBe(stored);
    const resolved = resolveKnockoutStageSelection(
      stageFixtures,
      stageMatches,
      parseCompetitionSelection(refreshed.stageOrGroup),
    );
    expect(resolved.drawId).toBe(1);
    expect(resolved.fixtures.map((fixture) => fixture.id)).toEqual([501]);
  });

  it("does not retarget a D1 stage when a D2 scoring event arrives", () => {
    const current = roundSelectorToken(1, "Semi-Finals");
    const retained = retainStageSelection(current, {
      type: "scoring_state",
      channel: "scoring",
      drawId: 2,
      roundName: "Semi-Finals",
    });
    expect(retained).toBe(current);
    const merged = mergeObsDirectorSnapshot(
      { overlay: "standings", stageOrGroup: current },
      { type: "scoring_state", roundName: "Semi-Finals", drawId: 2 },
    );
    expect(merged.stageOrGroup).toBe(current);
    const resolved = resolveKnockoutStageSelection(
      stageFixtures,
      stageMatches,
      parseCompetitionSelection(retained),
    );
    expect(resolved.fixtures.map((fixture) => fixture.id)).toEqual([501]);
    expect(resolved.matches.some((match) => match.fixtureId === 601)).toBe(false);
  });

  it("offers a separate broadcast choice for each draw that shares a stage label", () => {
    const choices = knockoutBroadcastStageChoices(stageFixtures, stageMatches, stageDraws);
    const semis = choices.filter((choice) => choice.roundKey === "Semi-Finals");
    expect(semis.map((choice) => choice.token)).toEqual([
      "draw:1:round:Semi-Finals",
      "draw:2:round:Semi-Finals",
    ]);
    expect(broadcastStageChoices(stageFixtures, stageMatches, stageDraws).some((choice) => choice.token === "Semi-Finals")).toBe(false);
  });

  it("does not place an unlinked match on another draw's bracket", () => {
    const boards = bracketMatchesByDraw(
      [
        { id: 11, fixtureId: 501, roundName: "Semi-Finals" },
        { id: 21, fixtureId: 601, roundName: "Semi-Finals" },
        { id: 99, fixtureId: null, roundName: "Semi-Finals" },
      ],
      stageFixtures,
    );
    expect(boards.map((board) => board.drawId)).toEqual([1, 2]);
    expect(boards[0]?.matches.map((match) => match.id)).toEqual([11]);
    expect(boards[1]?.matches.map((match) => match.id)).toEqual([21]);
    const d1Board = bracketBoardsByDraw(
      stageFixtures.filter((fixture) => fixture.drawId === 1).map((fixture) => ({
        ...fixture,
        bracketRound: fixture.roundName === "Final" ? 1 : 0,
        bracketSlot: 0,
        homeTeamId: 1,
        awayTeamId: 2,
      })),
      stageDraws,
    );
    expect(d1Board).toHaveLength(1);
    expect(d1Board[0]?.fixtures.every((fixture) => fixture.drawId === 1)).toBe(true);
  });
});

describe("group filter identity", () => {
  const sharedNameGroups = [
    { id: 11, name: "Group A", drawId: 1, drawName: "Classes 4–5–6", displayName: "Classes 4–5–6 — Group A" },
    { id: 21, name: "Group A", drawId: 2, drawName: "Classes 7–8–9", displayName: "Classes 7–8–9 — Group A" },
  ];
  const fixtures = [
    { id: 501, groupId: 11, drawId: 1 },
    { id: 601, groupId: 21, drawId: 2 },
    { id: 701, groupId: null, drawId: 1 },
  ];
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const matches = [
    { id: 1, fixtureId: 501, roundName: "Classes 4–5–6 · Group A — Round 1" },
    { id: 2, fixtureId: 601, roundName: "Classes 7–8–9 · Group A — Round 1" },
    { id: 3, fixtureId: 701, roundName: "Final" },
    { id: 4, fixtureId: null, roundName: "Group A — Round 2" },
  ];

  it("keeps two Group A competitions as separate choices", () => {
    expect(cricketGroupChoices(sharedNameGroups)).toEqual([
      { id: 11, label: "Classes 4–5–6 — Group A" },
      { id: 21, label: "Classes 7–8–9 — Group A" },
    ]);
  });

  it("selects D1 Group A matches by fixture group id", () => {
    const selected = matches.filter((match) => resolvedMatchGroupId(match, fixtureById) === 11);
    expect(selected.map((match) => match.id)).toEqual([1]);
  });

  it("selects D2 Group A matches by fixture group id", () => {
    const selected = matches.filter((match) => resolvedMatchGroupId(match, fixtureById) === 21);
    expect(selected.map((match) => match.id)).toEqual([2]);
  });

  it("does not treat a null group id as membership in every group", () => {
    expect(resolvedMatchGroupId(matches[2]!, fixtureById)).toBeNull();
    expect(resolvedMatchGroupId(matches[3]!, fixtureById)).toBeNull();
    expect(matches.filter((match) => resolvedMatchGroupId(match, fixtureById) === 11).map((m) => m.id)).toEqual([1]);
  });

  it("uses a match group id when the fixture map is absent", () => {
    expect(resolvedMatchGroupId({ fixtureId: 501, groupId: 11 })).toBe(11);
    expect(resolvedMatchGroupId({ fixtureId: 601, groupId: 21 })).toBe(21);
  });

  it("refuses a round-name group filter once more than one draw exists", () => {
    expect(usesLegacyGroupNameFilter({ groupCount: 0, drawIds: [1, 2] })).toBe(false);
    expect(usesLegacyGroupNameFilter({ groupCount: 2, drawIds: [1] })).toBe(false);
    expect(usesLegacyGroupNameFilter({ groupCount: 0, drawIds: [1] })).toBe(true);
    expect(legacyRoundGroupLabels(matches)).toEqual(["Group A"]);
    expect(matchMatchesLegacyGroupLabel("Group A — Round 1", "Group A")).toBe(true);
  });

  it("highlights a plain group name only when that name is unique", () => {
    expect(groupChoiceIsSelected("Group A", sharedNameGroups[0]!, sharedNameGroups)).toBe(false);
    expect(groupChoiceIsSelected("group:11", sharedNameGroups[0]!, sharedNameGroups)).toBe(true);
    expect(groupChoiceIsSelected("group:21", sharedNameGroups[0]!, sharedNameGroups)).toBe(false);
    const only = [{ id: 11, name: "Group A" }];
    expect(groupChoiceIsSelected("Group A", only[0]!, only)).toBe(true);
  });
});
