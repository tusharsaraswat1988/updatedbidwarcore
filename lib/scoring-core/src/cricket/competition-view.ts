/**
 * Consumer identity for cricket competitions.
 * A scoring draw is the competition. Group names and round names are labels.
 */

export type CompetitionSelection =
  | { kind: "all" }
  | { kind: "group"; groupId: number }
  | { kind: "draw"; drawId: number }
  | { kind: "round"; drawId: number; roundKey: string }
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

/** Collapse surrounding and repeated whitespace. Hyphens and the label text stay as written. */
export function normalizeRoundKey(roundName: string): string {
  return roundName.trim().replace(/\s+/g, " ");
}

export function roundSelectorToken(drawId: number, roundName: string): string {
  return `draw:${drawId}:round:${normalizeRoundKey(roundName)}`;
}

export function roundKeysEqual(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizeRoundKey(left ?? "");
  const b = normalizeRoundKey(right ?? "");
  return a.length > 0 && a.toLowerCase() === b.toLowerCase();
}

export function parseCompetitionSelection(value?: string | null): CompetitionSelection {
  if (!value || value.trim() === "" || value.trim().toLowerCase() === "all") {
    return { kind: "all" };
  }
  const trimmed = value.trim();
  const groupMatch = /^group:(\d+)$/.exec(trimmed);
  if (groupMatch) return { kind: "group", groupId: Number(groupMatch[1]) };
  const roundMatch = /^draw:(\d+):round:(.+)$/.exec(trimmed);
  if (roundMatch) {
    const drawId = Number(roundMatch[1]);
    const roundKey = normalizeRoundKey(roundMatch[2] ?? "");
    if (Number.isInteger(drawId) && drawId > 0 && roundKey.length > 0) {
      return { kind: "round", drawId, roundKey };
    }
  }
  const drawMatch = /^draw:(\d+)$/.exec(trimmed);
  if (drawMatch) return { kind: "draw", drawId: Number(drawMatch[1]) };
  return { kind: "label", label: trimmed };
}

/** Round and legacy labels are the only selections that should be painted as text. */
export function competitionSelectionLabel(value?: string | null): string {
  const selection = parseCompetitionSelection(value);
  if (selection.kind === "round") return selection.roundKey;
  if (selection.kind === "label") return selection.label;
  return "";
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
  if (selection.kind === "all" || selection.kind === "draw" || selection.kind === "round") {
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
  if (selection.kind === "round") {
    return { rows: [], group: null, ambiguous: false, qualifiers: 0 };
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

export type KnockoutFixtureRef = {
  id: number;
  drawId?: number | null;
  roundName?: string | null;
};

export type KnockoutMatchRef = {
  id: number;
  fixtureId?: number | null;
  roundName?: string | null;
};

export type KnockoutStageResolution<
  TFixture extends KnockoutFixtureRef,
  TMatch extends KnockoutMatchRef,
> = {
  fixtures: TFixture[];
  matches: TMatch[];
  ambiguous: boolean;
  drawId: number | null;
  roundKey: string | null;
};

function emptyKnockoutStage<
  TFixture extends KnockoutFixtureRef,
  TMatch extends KnockoutMatchRef,
>(ambiguous = false, roundKey: string | null = null): KnockoutStageResolution<TFixture, TMatch> {
  return { fixtures: [], matches: [], ambiguous, drawId: null, roundKey };
}

function matchesForFixtures<TMatch extends KnockoutMatchRef>(
  matches: TMatch[],
  fixtureIds: Set<number>,
): TMatch[] {
  return matches.filter((match) => match.fixtureId != null && fixtureIds.has(match.fixtureId));
}

/**
 * Knockout stage identity is the draw, then the round label inside that draw.
 * A plain round name is accepted only when exactly one draw owns that label.
 * Two draws with the same label stay unresolved. The first fixture is never chosen.
 */
export function resolveKnockoutStageSelection<
  TFixture extends KnockoutFixtureRef,
  TMatch extends KnockoutMatchRef,
>(
  fixtures: TFixture[],
  matches: TMatch[],
  selection: CompetitionSelection,
): KnockoutStageResolution<TFixture, TMatch> {
  if (selection.kind === "round") {
    const stageFixtures = fixtures.filter(
      (fixture) =>
        fixture.drawId === selection.drawId && roundKeysEqual(fixture.roundName, selection.roundKey),
    );
    const fixtureIds = new Set(stageFixtures.map((fixture) => fixture.id));
    return {
      fixtures: stageFixtures,
      matches: matchesForFixtures(matches, fixtureIds),
      ambiguous: false,
      drawId: selection.drawId,
      roundKey: selection.roundKey,
    };
  }

  if (selection.kind !== "label") return emptyKnockoutStage();

  const roundKey = normalizeRoundKey(selection.label);
  const labeled = fixtures.filter((fixture) => roundKeysEqual(fixture.roundName, roundKey));
  const drawIds = new Set(
    labeled.map((fixture) => fixture.drawId).filter((id): id is number => id != null),
  );
  if (drawIds.size > 1) return emptyKnockoutStage(true, roundKey);

  if (drawIds.size === 1) {
    const drawId = [...drawIds][0]!;
    const stageFixtures = labeled.filter((fixture) => fixture.drawId === drawId);
    const fixtureIds = new Set(stageFixtures.map((fixture) => fixture.id));
    return {
      fixtures: stageFixtures,
      matches: matchesForFixtures(matches, fixtureIds),
      ambiguous: false,
      drawId,
      roundKey,
    };
  }

  const tournamentDraws = new Set(
    fixtures.map((fixture) => fixture.drawId).filter((id): id is number => id != null),
  );
  if (tournamentDraws.size > 1) return emptyKnockoutStage(true, roundKey);

  const namedMatches = matches.filter((match) => roundKeysEqual(match.roundName, roundKey));
  if (namedMatches.length === 0) return emptyKnockoutStage(false, roundKey);

  if (tournamentDraws.size === 1) {
    const drawId = [...tournamentDraws][0]!;
    const drawFixtureIds = new Set(
      fixtures.filter((fixture) => fixture.drawId === drawId).map((fixture) => fixture.id),
    );
    const stageMatches = namedMatches.filter(
      (match) => match.fixtureId == null || drawFixtureIds.has(match.fixtureId),
    );
    const stageFixtures = fixtures.filter(
      (fixture) => fixture.drawId === drawId && stageMatches.some((match) => match.fixtureId === fixture.id),
    );
    return {
      fixtures: stageFixtures,
      matches: stageMatches,
      ambiguous: false,
      drawId,
      roundKey,
    };
  }

  return {
    fixtures: [],
    matches: namedMatches,
    ambiguous: false,
    drawId: null,
    roundKey,
  };
}

export type BroadcastStageChoice = {
  drawId: number | null;
  drawName: string | null;
  roundKey: string;
  token: string;
  fixtureIds: number[];
};

export function isKnockoutRoundLabel(roundName: string): boolean {
  return /final|semi|quarter|eliminator|qualifier|play-?off|knockout|round of \d+/i.test(roundName);
}

function drawNameFor(
  drawId: number,
  draws: Array<{ id: number; name?: string | null }>,
): string {
  return draws.find((draw) => draw.id === drawId)?.name?.trim() || `Competition ${drawId}`;
}

/** One choice per draw + round label. The token always carries the draw when one exists. */
export function broadcastStageChoices(
  fixtures: KnockoutFixtureRef[],
  matches: KnockoutMatchRef[] = [],
  draws: Array<{ id: number; name?: string | null }> = [],
): BroadcastStageChoice[] {
  const buckets = new Map<string, BroadcastStageChoice>();
  for (const fixture of fixtures) {
    if (fixture.drawId == null) continue;
    const roundKey = normalizeRoundKey(fixture.roundName ?? "");
    if (!roundKey) continue;
    const mapKey = `${fixture.drawId}\0${roundKey.toLowerCase()}`;
    const existing = buckets.get(mapKey);
    if (existing) {
      existing.fixtureIds.push(fixture.id);
      continue;
    }
    buckets.set(mapKey, {
      drawId: fixture.drawId,
      drawName: drawNameFor(fixture.drawId, draws),
      roundKey,
      token: roundSelectorToken(fixture.drawId, roundKey),
      fixtureIds: [fixture.id],
    });
  }
  if (buckets.size > 0) {
    return [...buckets.values()].sort(
      (a, b) => (a.drawId ?? 0) - (b.drawId ?? 0) || a.roundKey.localeCompare(b.roundKey),
    );
  }

  const drawIds = new Set(
    fixtures.map((fixture) => fixture.drawId).filter((id): id is number => id != null),
  );
  if (drawIds.size > 1) return [];

  const onlyDraw = drawIds.size === 1 ? [...drawIds][0]! : null;
  const seen = new Set<string>();
  const legacy: BroadcastStageChoice[] = [];
  for (const match of matches) {
    const roundKey = normalizeRoundKey(match.roundName ?? "");
    if (!roundKey) continue;
    const key = roundKey.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    legacy.push({
      drawId: onlyDraw,
      drawName: onlyDraw == null ? null : drawNameFor(onlyDraw, draws),
      roundKey,
      token: onlyDraw == null ? roundKey : roundSelectorToken(onlyDraw, roundKey),
      fixtureIds: [],
    });
  }
  return legacy.sort((a, b) => a.roundKey.localeCompare(b.roundKey));
}

export function knockoutBroadcastStageChoices(
  fixtures: KnockoutFixtureRef[],
  matches: KnockoutMatchRef[] = [],
  draws: Array<{ id: number; name?: string | null }> = [],
): BroadcastStageChoice[] {
  return broadcastStageChoices(fixtures, matches, draws).filter((choice) =>
    isKnockoutRoundLabel(choice.roundKey),
  );
}

export function stageChoiceIsSelected(
  current: string | null | undefined,
  choice: BroadcastStageChoice,
  choices: BroadcastStageChoice[],
): boolean {
  if (!current) return false;
  if (current === choice.token) return true;
  const selection = parseCompetitionSelection(current);
  if (selection.kind === "round") {
    return selection.drawId === choice.drawId && roundKeysEqual(selection.roundKey, choice.roundKey);
  }
  if (selection.kind === "label") {
    const same = choices.filter((item) => roundKeysEqual(item.roundKey, selection.label));
    return same.length === 1 && same[0]?.token === choice.token;
  }
  return false;
}

/**
 * A scoring update must not replace the selected stage.
 * A director event replaces it only when it carries a new stage token.
 */
export function retainStageSelection(
  current: string | null | undefined,
  event: {
    type?: string;
    channel?: string;
    stageOrGroup?: string | null;
    roundName?: string | null;
    drawId?: number | null;
  } | null | undefined,
): string | undefined {
  const kept = current ?? undefined;
  if (!event) return kept;
  const channel = event.channel ?? event.type ?? "";
  if (channel === "scoring" || channel === "scoring_state" || channel === "scoring_replay") {
    return kept;
  }
  if (typeof event.stageOrGroup === "string") return event.stageOrGroup;
  return kept;
}

export function mergeObsDirectorSnapshot<T extends { stageOrGroup?: string | null; type?: string }>(
  previous: T | null | undefined,
  incoming: T,
): T {
  const type = incoming.type ?? "";
  if (type === "scoring" || type === "scoring_state" || type === "scoring_replay") {
    return previous ?? incoming;
  }
  const nextStage = retainStageSelection(previous?.stageOrGroup, incoming);
  return {
    ...(previous ?? ({} as T)),
    ...incoming,
    stageOrGroup: nextStage,
  };
}

/**
 * Fallback boards for matches that are not already on a bracket fixture.
 * A match joins a draw only through its fixture. Unlinked matches stay off
 * every board once more than one draw exists.
 */
export function bracketMatchesByDraw<TMatch extends { fixtureId?: number | null }>(
  matches: TMatch[],
  fixtures: Array<{ id: number; drawId?: number | null }>,
): Array<{ drawId: number | null; matches: TMatch[] }> {
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const drawIds = new Set(
    fixtures.map((fixture) => fixture.drawId).filter((id): id is number => id != null),
  );
  const multi = drawIds.size > 1;
  const buckets = new Map<number | null, TMatch[]>();
  for (const match of matches) {
    const fixture = match.fixtureId != null ? fixtureById.get(match.fixtureId) : undefined;
    if (!fixture || fixture.drawId == null) {
      if (multi) continue;
      const list = buckets.get(null) ?? [];
      list.push(match);
      buckets.set(null, list);
      continue;
    }
    const list = buckets.get(fixture.drawId) ?? [];
    list.push(match);
    buckets.set(fixture.drawId, list);
  }
  return [...buckets.entries()]
    .sort((a, b) => (a[0] ?? 999999) - (b[0] ?? 999999))
    .map(([drawId, stageMatches]) => ({ drawId, matches: stageMatches }));
}

export type CricketGroupChoice = {
  id: number;
  label: string;
};

/**
 * One choice per scoring group. A shared display name is qualified with the
 * competition so two "Group A" rows stay separate controls.
 */
export function cricketGroupChoices(
  groups: Array<{
    id: number;
    name: string;
    drawName?: string | null;
    displayName?: string | null;
  }>,
): CricketGroupChoice[] {
  const nameCounts = new Map<string, number>();
  for (const group of groups) {
    const key = group.name.trim().toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  return groups.map((group) => {
    const shared = (nameCounts.get(group.name.trim().toLowerCase()) ?? 0) > 1;
    const qualified =
      group.displayName?.trim() ||
      (group.drawName?.trim() ? `${group.drawName.trim()} — ${group.name}` : group.name);
    return { id: group.id, label: shared ? qualified : group.name };
  });
}

/**
 * A stored group token matches by group id. A plain name matches only when
 * exactly one group in the tournament carries that name.
 */
export function groupChoiceIsSelected(
  stageOrGroup: string | null | undefined,
  group: { id: number; name: string },
  groups: Array<{ id: number; name: string }>,
): boolean {
  if (!stageOrGroup) return false;
  if (stageOrGroup === groupSelectorToken(group.id)) return true;
  const label = stageOrGroup.trim().toLowerCase();
  const named = groups.filter((candidate) => candidate.name.trim().toLowerCase() === label);
  return named.length === 1 && named[0]!.id === group.id;
}

const LEGACY_GROUP_LABEL = /Group\s+([A-Z0-9]+)/i;

/** Labels parsed from round names. Used only when no scoring group rows exist. */
export function legacyRoundGroupLabels(
  matches: Array<{ roundName?: string | null }>,
): string[] {
  const labels = new Set<string>();
  for (const match of matches) {
    const found = (match.roundName ?? "").match(LEGACY_GROUP_LABEL);
    if (found?.[1]) labels.add(`Group ${found[1].toUpperCase()}`);
  }
  return [...labels].sort();
}

/**
 * Round-name group filters are a single-draw legacy path. Once group rows
 * exist, or more than one draw exists, a name inside roundName is not identity.
 */
export function usesLegacyGroupNameFilter(args: {
  groupCount: number;
  drawIds: Array<number | null | undefined>;
}): boolean {
  if (args.groupCount > 0) return false;
  const ids = new Set(args.drawIds.filter((id): id is number => id != null));
  return ids.size <= 1;
}

export function resolvedMatchGroupId(
  match: { fixtureId?: number | null; groupId?: number | null },
  fixturesById?: ReadonlyMap<number, { groupId?: number | null }>,
): number | null {
  if (match.groupId != null) return match.groupId;
  if (match.fixtureId == null || !fixturesById) return null;
  return fixturesById.get(match.fixtureId)?.groupId ?? null;
}

export function matchMatchesLegacyGroupLabel(
  roundName: string | null | undefined,
  label: string,
): boolean {
  return (roundName ?? "").toLowerCase().includes(label.trim().toLowerCase());
}
