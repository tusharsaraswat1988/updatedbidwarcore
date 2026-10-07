/**
 * Consumer identity for cricket competitions.
 * A scoring draw is the competition. Group names and round names are labels.
 */

export type CompetitionSelection =
  | { kind: "all" }
  | { kind: "group"; groupId: number }
  | { kind: "draw"; drawId: number }
  | { kind: "label"; label: string };

export type CompetitionGroupView<TRow> = {
  id: number;
  name: string;
  drawId?: number | null;
  drawName?: string | null;
  displayName?: string | null;
  qualifiersPerGroup?: number;
  rows: TRow[];
};

export type CompetitionStandingRef = {
  teamId: number;
  drawId?: number | null;
  drawName?: string | null;
};

export type DrawCompetitionSection<TRow, TGroup extends CompetitionGroupView<TRow>> = {
  drawId: number | null;
  drawName: string;
  groups: TGroup[];
  /** Draw-scoped rows only. Null draw_id rows are never copied into a draw section. */
  rows: TRow[];
};

export function competitionGroupTitle(group: {
  name: string;
  drawName?: string | null;
  displayName?: string | null;
}): string {
  const display = group.displayName?.trim();
  if (display) return display;
  const drawName = group.drawName?.trim();
  if (drawName && !group.name.toLowerCase().includes(drawName.toLowerCase())) {
    return `${drawName} — ${group.name}`;
  }
  return group.name;
}

export function groupSelectorToken(groupId: number): string {
  return `group:${groupId}`;
}

export function drawSelectorToken(drawId: number): string {
  return `draw:${drawId}`;
}

export function parseCompetitionSelection(value?: string | null): CompetitionSelection {
  if (!value || value.trim() === "" || value.trim().toLowerCase() === "all") {
    return { kind: "all" };
  }
  const trimmed = value.trim();
  const groupMatch = /^group:(\d+)$/.exec(trimmed);
  if (groupMatch) return { kind: "group", groupId: Number(groupMatch[1]) };
  const drawMatch = /^draw:(\d+)$/.exec(trimmed);
  if (drawMatch) return { kind: "draw", drawId: Number(drawMatch[1]) };
  return { kind: "label", label: trimmed };
}

export function isMultiDrawCompetition(
  groups: Array<{ drawId?: number | null }>,
  rows: Array<{ drawId?: number | null }> = [],
): boolean {
  const ids = new Set<number>();
  for (const group of groups) {
    if (group.drawId != null) ids.add(group.drawId);
  }
  for (const row of rows) {
    if (row.drawId != null) ids.add(row.drawId);
  }
  return ids.size > 1;
}

export function partitionByDraw<
  TRow extends CompetitionStandingRef,
  TGroup extends CompetitionGroupView<TRow>,
>(groups: TGroup[], rows: TRow[]): Array<DrawCompetitionSection<TRow, TGroup>> {
  const names = new Map<number, string>();
  const ids = new Set<number>();
  for (const group of groups) {
    if (group.drawId == null) continue;
    ids.add(group.drawId);
    if (group.drawName?.trim()) names.set(group.drawId, group.drawName.trim());
  }
  for (const row of rows) {
    if (row.drawId == null) continue;
    ids.add(row.drawId);
    const rowName = row.drawName?.trim();
    if (rowName && !names.has(row.drawId)) names.set(row.drawId, rowName);
  }

  const sections = [...ids]
    .sort((a, b) => a - b)
    .map((drawId) => ({
      drawId,
      drawName: names.get(drawId) ?? `Competition ${drawId}`,
      groups: groups.filter((group) => group.drawId === drawId),
      rows: rows.filter((row) => row.drawId === drawId),
    }));

  if (sections.length > 0) return sections;

  return [
    {
      drawId: null,
      drawName: "Standings",
      groups: groups.filter((group) => group.drawId == null),
      rows: rows.filter((row) => row.drawId == null || row.drawId === undefined),
    },
  ];
}

export function resolveCompetitionGroup<T extends {
  id: number;
  name: string;
  displayName?: string | null;
}>(
  groups: T[],
  selection: CompetitionSelection,
): { group: T | null; ambiguous: boolean } {
  if (selection.kind === "all" || selection.kind === "draw") {
    return { group: null, ambiguous: false };
  }
  if (selection.kind === "group") {
    return {
      group: groups.find((group) => group.id === selection.groupId) ?? null,
      ambiguous: false,
    };
  }
  const label = selection.label.trim().toLowerCase();
  const matches = groups.filter((group) => {
    const name = group.name.trim().toLowerCase();
    const display = (group.displayName ?? "").trim().toLowerCase();
    return name === label || (display.length > 0 && display === label);
  });
  if (matches.length === 1) return { group: matches[0]!, ambiguous: false };
  if (matches.length > 1) return { group: null, ambiguous: true };
  return { group: null, ambiguous: false };
}

export function rowsForCompetitionSelection<
  TRow extends CompetitionStandingRef,
  TGroup extends CompetitionGroupView<TRow>,
>(
  groups: TGroup[],
  rows: TRow[],
  selection: CompetitionSelection,
): {
  rows: TRow[];
  group: TGroup | null;
  ambiguous: boolean;
  /** Rows to paint as the qualification band. Zero means no tournament-wide band. */
  qualifiers: number;
} {
  const { group, ambiguous } = resolveCompetitionGroup(groups, selection);
  if (ambiguous) {
    return { rows: [], group: null, ambiguous: true, qualifiers: 0 };
  }
  if (selection.kind === "group") {
    if (!group) return { rows: [], group: null, ambiguous: false, qualifiers: 0 };
    return {
      rows: group.rows,
      group,
      ambiguous: false,
      qualifiers: group.qualifiersPerGroup ?? 2,
    };
  }
  if (selection.kind === "label") {
    if (!group) return { rows: [], group: null, ambiguous: false, qualifiers: 0 };
    return {
      rows: group.rows,
      group,
      ambiguous: false,
      qualifiers: group.qualifiersPerGroup ?? 2,
    };
  }
  if (selection.kind === "draw") {
    return {
      rows: rows.filter((row) => row.drawId === selection.drawId),
      group: null,
      ambiguous: false,
      qualifiers: 0,
    };
  }
  if (isMultiDrawCompetition(groups, rows)) {
    return { rows: [], group: null, ambiguous: false, qualifiers: 0 };
  }
  return {
    rows,
    group: null,
    ambiguous: false,
    qualifiers: groups.length > 0 ? 0 : 4,
  };
}

export function listTeamCompetitionRows<T extends CompetitionStandingRef>(
  rows: T[],
  teamId: number,
): T[] {
  return rows.filter((row) => row.teamId === teamId && row.drawId != null);
}

/**
 * Pick one standing for a team.
 * A requested draw never falls through to another draw or a null draw_id row.
 * Several draw rows without a requested draw stay unresolved.
 * A null draw_id row is used only when it is the sole legacy table.
 */
export function resolveTeamStanding<T extends CompetitionStandingRef>(
  rows: T[],
  teamId: number,
  drawId?: number | null,
): T | null {
  if (drawId != null) {
    return rows.find((row) => row.teamId === teamId && row.drawId === drawId) ?? null;
  }
  const scoped = listTeamCompetitionRows(rows, teamId);
  if (scoped.length === 1) return scoped[0]!;
  if (scoped.length > 1) return null;
  const tournamentDraws = new Set(
    rows.map((row) => row.drawId).filter((id): id is number => id != null),
  );
  if (tournamentDraws.size > 0) return null;
  const legacy = rows.filter((row) => row.teamId === teamId && (row.drawId == null));
  return legacy.length === 1 ? legacy[0]! : null;
}

export function rankInDraw<T extends CompetitionStandingRef>(
  rows: T[],
  teamId: number,
  drawId: number | null,
): number | null {
  const table =
    drawId == null
      ? rows.filter((row) => row.drawId == null)
      : rows.filter((row) => row.drawId === drawId);
  const index = table.findIndex((row) => row.teamId === teamId);
  return index >= 0 ? index + 1 : null;
}

export type BracketFixtureRef = {
  id: number;
  drawId?: number | null;
  bracketRound?: number | null;
  bracketSlot?: number | null;
  roundName?: string | null;
  homeTeamId: number;
  awayTeamId: number;
};

export type BracketMatchRef = {
  id: number;
  fixtureId?: number | null;
  homeTeamId: number;
  awayTeamId: number;
  roundName?: string | null;
};

/** Fixture id is the match link. Round name is not. */
export function matchForBracketFixture<TMatch extends BracketMatchRef>(
  fixture: BracketFixtureRef,
  matches: TMatch[],
): TMatch | undefined {
  const linked = matches.find((match) => match.fixtureId === fixture.id);
  if (linked) return linked;
  if (fixture.homeTeamId <= 0 || fixture.awayTeamId <= 0) return undefined;
  const sameTeams = matches.filter(
    (match) =>
      match.fixtureId == null &&
      match.homeTeamId === fixture.homeTeamId &&
      match.awayTeamId === fixture.awayTeamId,
  );
  return sameTeams.length === 1 ? sameTeams[0] : undefined;
}

export type DrawBracketBoard<TFixture extends BracketFixtureRef> = {
  drawId: number | null;
  drawName: string;
  fixtures: TFixture[];
};

export function bracketBoardsByDraw<TFixture extends BracketFixtureRef>(
  fixtures: TFixture[],
  draws: Array<{ id: number; name?: string | null }> = [],
): Array<DrawBracketBoard<TFixture>> {
  const names = new Map(draws.map((draw) => [draw.id, draw.name?.trim() || `Competition ${draw.id}`]));
  const bracketFixtures = fixtures.filter((fixture) => fixture.bracketRound != null);
  const ids = new Set<number | null>();
  for (const fixture of bracketFixtures) ids.add(fixture.drawId ?? null);
  return [...ids]
    .sort((a, b) => {
      if (a == null) return 1;
      if (b == null) return -1;
      return a - b;
    })
    .map((drawId) => ({
      drawId,
      drawName: drawId == null ? "Knockout" : (names.get(drawId) ?? `Competition ${drawId}`),
      fixtures: bracketFixtures
        .filter((fixture) => (fixture.drawId ?? null) === drawId)
        .sort(
          (a, b) =>
            (a.bracketRound ?? 0) - (b.bracketRound ?? 0) ||
            (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0) ||
            a.id - b.id,
        ),
    }));
}
