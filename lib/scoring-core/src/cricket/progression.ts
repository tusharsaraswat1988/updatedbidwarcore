import type { TeamStandingComputed } from "./standings";

export type StageType = "league" | "round_robin" | "knockout";

export type QualificationRuleType = "top_n_per_group" | "top_n_overall" | "custom";

export type QualificationRule = {
  type: QualificationRuleType;
  count: number;
};

export type ParticipantSource =
  | { type: "direct"; teamId: number }
  | { type: "group_rank"; groupName: string; groupId?: number | null; rank: number }
  | { type: "winner_of"; fixtureId?: number; roundName?: string; bracketRound?: number; bracketSlot?: number }
  | { type: "loser_of"; fixtureId?: number; roundName?: string; bracketRound?: number; bracketSlot?: number };

export type PlannedFixtureTemplate = {
  roundName: string;
  bracketRound?: number;
  bracketSlot?: number;
  homeSource: ParticipantSource;
  awaySource: ParticipantSource;
  groupName?: string;
  winnerAdvancesToSlot?: "home" | "away";
  targetRoundName?: string;
};

export type CompetitionStage = {
  id: string;
  name: string;
  type: StageType;
  order: number;
  groups?: Array<{ name: string; teamIds: number[] }>;
  qualification?: QualificationRule;
  fixtures?: PlannedFixtureTemplate[];
};

export type StageProgressionConfig = {
  stages: CompetitionStage[];
};

export type GroupStandingsMap = Record<
  string,
  {
    groupName: string;
    groupId?: number | null;
    standings: TeamStandingComputed[];
    isComplete: boolean;
  }
>;

export type QualificationResolutionResult = {
  isReady: boolean;
  qualifiersBySlotKey: Record<string, number>; // e.g. "Group A#1" -> teamId
  qualifierTeamIds: number[];
  errors: string[];
};

export function makeSlotKey(groupName: string, rank: number): string {
  return `${groupName.trim().toUpperCase()}#${rank}`;
}

/**
 * Validates group completeness and resolves qualified teams from authoritative group standings.
 *
 * Rules:
 * 1. Every group in the stage must have completed all scheduled matches.
 * 2. Each group must have at least `count` teams in standings.
 * 3. Prevents duplicate teams across qualification slots.
 * 4. Consumes authoritative standings (points % > NRR > head-to-head > teamId).
 */
export function resolveGroupQualifications(
  groups: Array<{ name: string; groupId?: number | null }>,
  rule: QualificationRule,
  groupStandings: GroupStandingsMap,
): QualificationResolutionResult {
  const errors: string[] = [];
  const qualifiersBySlotKey: Record<string, number> = {};
  const qualifierTeamIds: number[] = [];
  const seenTeamIds = new Set<number>();

  if (!groups || groups.length === 0) {
    return {
      isReady: false,
      qualifiersBySlotKey: {},
      qualifierTeamIds: [],
      errors: ["No groups defined for qualification"],
    };
  }

  for (const g of groups) {
    const groupData = groupStandings[g.name] ?? groupStandings[g.name.toUpperCase()];
    if (!groupData) {
      errors.push(`Group '${g.name}' has no standings data`);
      continue;
    }

    if (!groupData.isComplete) {
      errors.push(`Group '${g.name}' has incomplete matches`);
      continue;
    }

    if (groupData.standings.length < rule.count) {
      errors.push(
        `Group '${g.name}' only has ${groupData.standings.length} teams, but ${rule.count} qualifiers required`,
      );
      continue;
    }

    for (let r = 1; r <= rule.count; r++) {
      const standing = groupData.standings[r - 1];
      if (!standing) {
        errors.push(`Missing rank ${r} team in group '${g.name}'`);
        continue;
      }

      if (seenTeamIds.has(standing.teamId)) {
        errors.push(
          `Duplicate qualification: team ${standing.teamId} appears multiple times in qualified slots`,
        );
        continue;
      }

      seenTeamIds.add(standing.teamId);
      const slotKey = makeSlotKey(g.name, r);
      qualifiersBySlotKey[slotKey] = standing.teamId;
      qualifierTeamIds.push(standing.teamId);
    }
  }

  return {
    isReady: errors.length === 0,
    qualifiersBySlotKey,
    qualifierTeamIds,
    errors,
  };
}

/**
 * Build generic, configuration-driven stage progression graph for league + knockout tournaments.
 * Supports arbitrary number of groups (1, 2, 3, 4, ...) and arbitrary qualifiers per group (1, 2, 4).
 */
export function buildLeagueKnockoutStages(
  groups: Array<{ name: string; teamIds: number[] }>,
  options?: {
    qualifiersPerGroup?: number;
    doubleRoundRobin?: boolean;
    hasThirdPlaceMatch?: boolean;
  },
): StageProgressionConfig {
  const qualifiersPerGroup = options?.qualifiersPerGroup ?? (groups.length === 1 ? 2 : 2);
  const stages: CompetitionStage[] = [];

  // Stage 0: League / Group Stage
  stages.push({
    id: "stage-groups",
    name: groups.length > 1 ? "Group Stage" : "League Stage",
    type: "league",
    order: 0,
    groups,
    qualification: {
      type: "top_n_per_group",
      count: qualifiersPerGroup,
    },
  });

  const numGroups = groups.length;
  const totalQualifiers = numGroups * qualifiersPerGroup;

  // Knockout stage generator based on total qualifiers count
  if (totalQualifiers === 2) {
    // 2 qualifiers -> Final directly (e.g. Single group top 2, or 2 groups top 1)
    const homeSource: ParticipantSource =
      numGroups === 1
        ? { type: "group_rank", groupName: groups[0]!.name, rank: 1 }
        : { type: "group_rank", groupName: groups[0]!.name, rank: 1 };
    const awaySource: ParticipantSource =
      numGroups === 1
        ? { type: "group_rank", groupName: groups[0]!.name, rank: 2 }
        : { type: "group_rank", groupName: groups[1]!.name, rank: 1 };

    stages.push({
      id: "stage-final",
      name: "Final",
      type: "knockout",
      order: 1,
      fixtures: [
        {
          roundName: "Final",
          bracketRound: 0,
          bracketSlot: 0,
          homeSource,
          awaySource,
        },
      ],
    });
  } else if (totalQualifiers === 4) {
    // 4 qualifiers -> 2 Semi Finals + 1 Final
    let sf1Home: ParticipantSource;
    let sf1Away: ParticipantSource;
    let sf2Home: ParticipantSource;
    let sf2Away: ParticipantSource;

    if (numGroups === 2 && qualifiersPerGroup === 2) {
      // Cross-group semis: A1 vs B2, B1 vs A2
      const gA = groups[0]!.name;
      const gB = groups[1]!.name;
      sf1Home = { type: "group_rank", groupName: gA, rank: 1 };
      sf1Away = { type: "group_rank", groupName: gB, rank: 2 };
      sf2Home = { type: "group_rank", groupName: gB, rank: 1 };
      sf2Away = { type: "group_rank", groupName: gA, rank: 2 };
    } else if (numGroups === 4 && qualifiersPerGroup === 1) {
      // 4 groups top 1: A1 vs B1, C1 vs D1
      sf1Home = { type: "group_rank", groupName: groups[0]!.name, rank: 1 };
      sf1Away = { type: "group_rank", groupName: groups[1]!.name, rank: 1 };
      sf2Home = { type: "group_rank", groupName: groups[2]!.name, rank: 1 };
      sf2Away = { type: "group_rank", groupName: groups[3]!.name, rank: 1 };
    } else {
      // Generic 1 group top 4 (1 vs 4, 2 vs 3)
      const g = groups[0]!.name;
      sf1Home = { type: "group_rank", groupName: g, rank: 1 };
      sf1Away = { type: "group_rank", groupName: g, rank: 4 };
      sf2Home = { type: "group_rank", groupName: g, rank: 2 };
      sf2Away = { type: "group_rank", groupName: g, rank: 3 };
    }

    stages.push({
      id: "stage-semifinals",
      name: "Semi Finals",
      type: "knockout",
      order: 1,
      fixtures: [
        {
          roundName: "Semi Final 1",
          bracketRound: 0,
          bracketSlot: 0,
          homeSource: sf1Home,
          awaySource: sf1Away,
          winnerAdvancesToSlot: "home",
          targetRoundName: "Final",
        },
        {
          roundName: "Semi Final 2",
          bracketRound: 0,
          bracketSlot: 1,
          homeSource: sf2Home,
          awaySource: sf2Away,
          winnerAdvancesToSlot: "away",
          targetRoundName: "Final",
        },
      ],
    });

    stages.push({
      id: "stage-final",
      name: "Final",
      type: "knockout",
      order: 2,
      fixtures: [
        {
          roundName: "Final",
          bracketRound: 1,
          bracketSlot: 0,
          homeSource: { type: "winner_of", roundName: "Semi Final 1", bracketRound: 0, bracketSlot: 0 },
          awaySource: { type: "winner_of", roundName: "Semi Final 2", bracketRound: 0, bracketSlot: 1 },
        },
      ],
    });
  } else if (totalQualifiers === 8) {
    // 8 qualifiers -> Quarter Finals (4) -> Semi Finals (2) -> Final (1)
    const qfFixtures: PlannedFixtureTemplate[] = [];
    if (numGroups === 2 && qualifiersPerGroup === 4) {
      const gA = groups[0]!.name;
      const gB = groups[1]!.name;
      qfFixtures.push(
        { roundName: "Quarter Final 1", bracketRound: 0, bracketSlot: 0, homeSource: { type: "group_rank", groupName: gA, rank: 1 }, awaySource: { type: "group_rank", groupName: gB, rank: 4 }, winnerAdvancesToSlot: "home", targetRoundName: "Semi Final 1" },
        { roundName: "Quarter Final 2", bracketRound: 0, bracketSlot: 1, homeSource: { type: "group_rank", groupName: gB, rank: 2 }, awaySource: { type: "group_rank", groupName: gA, rank: 3 }, winnerAdvancesToSlot: "away", targetRoundName: "Semi Final 1" },
        { roundName: "Quarter Final 3", bracketRound: 0, bracketSlot: 2, homeSource: { type: "group_rank", groupName: gB, rank: 1 }, awaySource: { type: "group_rank", groupName: gA, rank: 4 }, winnerAdvancesToSlot: "home", targetRoundName: "Semi Final 2" },
        { roundName: "Quarter Final 4", bracketRound: 0, bracketSlot: 3, homeSource: { type: "group_rank", groupName: gA, rank: 2 }, awaySource: { type: "group_rank", groupName: gB, rank: 3 }, winnerAdvancesToSlot: "away", targetRoundName: "Semi Final 2" },
      );
    } else if (numGroups === 4 && qualifiersPerGroup === 2) {
      const [gA, gB, gC, gD] = groups.map((g) => g.name);
      qfFixtures.push(
        { roundName: "Quarter Final 1", bracketRound: 0, bracketSlot: 0, homeSource: { type: "group_rank", groupName: gA!, rank: 1 }, awaySource: { type: "group_rank", groupName: gB!, rank: 2 }, winnerAdvancesToSlot: "home", targetRoundName: "Semi Final 1" },
        { roundName: "Quarter Final 2", bracketRound: 0, bracketSlot: 1, homeSource: { type: "group_rank", groupName: gC!, rank: 1 }, awaySource: { type: "group_rank", groupName: gD!, rank: 2 }, winnerAdvancesToSlot: "away", targetRoundName: "Semi Final 1" },
        { roundName: "Quarter Final 3", bracketRound: 0, bracketSlot: 2, homeSource: { type: "group_rank", groupName: gB!, rank: 1 }, awaySource: { type: "group_rank", groupName: gA!, rank: 2 }, winnerAdvancesToSlot: "home", targetRoundName: "Semi Final 2" },
        { roundName: "Quarter Final 4", bracketRound: 0, bracketSlot: 3, homeSource: { type: "group_rank", groupName: gD!, rank: 1 }, awaySource: { type: "group_rank", groupName: gC!, rank: 2 }, winnerAdvancesToSlot: "away", targetRoundName: "Semi Final 2" },
      );
    } else {
      for (let i = 0; i < 4; i++) {
        qfFixtures.push({
          roundName: `Quarter Final ${i + 1}`,
          bracketRound: 0,
          bracketSlot: i,
          homeSource: { type: "group_rank", groupName: groups[0]!.name, rank: i + 1 },
          awaySource: { type: "group_rank", groupName: groups[0]!.name, rank: 8 - i },
          winnerAdvancesToSlot: i % 2 === 0 ? "home" : "away",
          targetRoundName: i < 2 ? "Semi Final 1" : "Semi Final 2",
        });
      }
    }

    stages.push({
      id: "stage-quarterfinals",
      name: "Quarter Finals",
      type: "knockout",
      order: 1,
      fixtures: qfFixtures,
    });

    stages.push({
      id: "stage-semifinals",
      name: "Semi Finals",
      type: "knockout",
      order: 2,
      fixtures: [
        {
          roundName: "Semi Final 1",
          bracketRound: 1,
          bracketSlot: 0,
          homeSource: { type: "winner_of", roundName: "Quarter Final 1", bracketRound: 0, bracketSlot: 0 },
          awaySource: { type: "winner_of", roundName: "Quarter Final 2", bracketRound: 0, bracketSlot: 1 },
          winnerAdvancesToSlot: "home",
          targetRoundName: "Final",
        },
        {
          roundName: "Semi Final 2",
          bracketRound: 1,
          bracketSlot: 1,
          homeSource: { type: "winner_of", roundName: "Quarter Final 3", bracketRound: 0, bracketSlot: 2 },
          awaySource: { type: "winner_of", roundName: "Quarter Final 4", bracketRound: 0, bracketSlot: 3 },
          winnerAdvancesToSlot: "away",
          targetRoundName: "Final",
        },
      ],
    });

    stages.push({
      id: "stage-final",
      name: "Final",
      type: "knockout",
      order: 3,
      fixtures: [
        {
          roundName: "Final",
          bracketRound: 2,
          bracketSlot: 0,
          homeSource: { type: "winner_of", roundName: "Semi Final 1", bracketRound: 1, bracketSlot: 0 },
          awaySource: { type: "winner_of", roundName: "Semi Final 2", bracketRound: 1, bracketSlot: 1 },
        },
      ],
    });
  } else if (totalQualifiers === 16) {
    // 16 qualifiers -> Round of 16 (8) -> Quarter Finals (4) -> Semi Finals (2) -> Final (1)
    const r16Fixtures: PlannedFixtureTemplate[] = [];
    if (numGroups === 4 && qualifiersPerGroup === 4) {
      const [gA, gB, gC, gD] = groups.map((g) => g.name);
      r16Fixtures.push(
        { roundName: "Round of 16 - 1", bracketRound: 0, bracketSlot: 0, homeSource: { type: "group_rank", groupName: gA!, rank: 1 }, awaySource: { type: "group_rank", groupName: gB!, rank: 4 }, winnerAdvancesToSlot: "home", targetRoundName: "Quarter Final 1" },
        { roundName: "Round of 16 - 2", bracketRound: 0, bracketSlot: 1, homeSource: { type: "group_rank", groupName: gC!, rank: 2 }, awaySource: { type: "group_rank", groupName: gD!, rank: 3 }, winnerAdvancesToSlot: "away", targetRoundName: "Quarter Final 1" },
        { roundName: "Round of 16 - 3", bracketRound: 0, bracketSlot: 2, homeSource: { type: "group_rank", groupName: gB!, rank: 1 }, awaySource: { type: "group_rank", groupName: gA!, rank: 4 }, winnerAdvancesToSlot: "home", targetRoundName: "Quarter Final 2" },
        { roundName: "Round of 16 - 4", bracketRound: 0, bracketSlot: 3, homeSource: { type: "group_rank", groupName: gD!, rank: 2 }, awaySource: { type: "group_rank", groupName: gC!, rank: 3 }, winnerAdvancesToSlot: "away", targetRoundName: "Quarter Final 2" },
        { roundName: "Round of 16 - 5", bracketRound: 0, bracketSlot: 4, homeSource: { type: "group_rank", groupName: gC!, rank: 1 }, awaySource: { type: "group_rank", groupName: gD!, rank: 4 }, winnerAdvancesToSlot: "home", targetRoundName: "Quarter Final 3" },
        { roundName: "Round of 16 - 6", bracketRound: 0, bracketSlot: 5, homeSource: { type: "group_rank", groupName: gA!, rank: 2 }, awaySource: { type: "group_rank", groupName: gB!, rank: 3 }, winnerAdvancesToSlot: "away", targetRoundName: "Quarter Final 3" },
        { roundName: "Round of 16 - 7", bracketRound: 0, bracketSlot: 6, homeSource: { type: "group_rank", groupName: gD!, rank: 1 }, awaySource: { type: "group_rank", groupName: gC!, rank: 4 }, winnerAdvancesToSlot: "home", targetRoundName: "Quarter Final 4" },
        { roundName: "Round of 16 - 8", bracketRound: 0, bracketSlot: 7, homeSource: { type: "group_rank", groupName: gB!, rank: 2 }, awaySource: { type: "group_rank", groupName: gA!, rank: 3 }, winnerAdvancesToSlot: "away", targetRoundName: "Quarter Final 4" },
      );
    } else {
      for (let i = 0; i < 8; i++) {
        r16Fixtures.push({
          roundName: `Round of 16 - ${i + 1}`,
          bracketRound: 0,
          bracketSlot: i,
          homeSource: { type: "group_rank", groupName: groups[0]!.name, rank: i + 1 },
          awaySource: { type: "group_rank", groupName: groups[0]!.name, rank: 16 - i },
          winnerAdvancesToSlot: i % 2 === 0 ? "home" : "away",
          targetRoundName: `Quarter Final ${Math.floor(i / 2) + 1}`,
        });
      }
    }

    stages.push({
      id: "stage-round-of-16",
      name: "Round of 16",
      type: "knockout",
      order: 1,
      fixtures: r16Fixtures,
    });

    stages.push({
      id: "stage-quarterfinals",
      name: "Quarter Finals",
      type: "knockout",
      order: 2,
      fixtures: [
        { roundName: "Quarter Final 1", bracketRound: 1, bracketSlot: 0, homeSource: { type: "winner_of", roundName: "Round of 16 - 1", bracketRound: 0, bracketSlot: 0 }, awaySource: { type: "winner_of", roundName: "Round of 16 - 2", bracketRound: 0, bracketSlot: 1 }, winnerAdvancesToSlot: "home", targetRoundName: "Semi Final 1" },
        { roundName: "Quarter Final 2", bracketRound: 1, bracketSlot: 1, homeSource: { type: "winner_of", roundName: "Round of 16 - 3", bracketRound: 0, bracketSlot: 2 }, awaySource: { type: "winner_of", roundName: "Round of 16 - 4", bracketRound: 0, bracketSlot: 3 }, winnerAdvancesToSlot: "away", targetRoundName: "Semi Final 1" },
        { roundName: "Quarter Final 3", bracketRound: 1, bracketSlot: 2, homeSource: { type: "winner_of", roundName: "Round of 16 - 5", bracketRound: 0, bracketSlot: 4 }, awaySource: { type: "winner_of", roundName: "Round of 16 - 6", bracketRound: 0, bracketSlot: 5 }, winnerAdvancesToSlot: "home", targetRoundName: "Semi Final 2" },
        { roundName: "Quarter Final 4", bracketRound: 1, bracketSlot: 3, homeSource: { type: "winner_of", roundName: "Round of 16 - 7", bracketRound: 0, bracketSlot: 6 }, awaySource: { type: "winner_of", roundName: "Round of 16 - 8", bracketRound: 0, bracketSlot: 7 }, winnerAdvancesToSlot: "away", targetRoundName: "Semi Final 2" },
      ],
    });

    stages.push({
      id: "stage-semifinals",
      name: "Semi Finals",
      type: "knockout",
      order: 3,
      fixtures: [
        { roundName: "Semi Final 1", bracketRound: 2, bracketSlot: 0, homeSource: { type: "winner_of", roundName: "Quarter Final 1", bracketRound: 1, bracketSlot: 0 }, awaySource: { type: "winner_of", roundName: "Quarter Final 2", bracketRound: 1, bracketSlot: 1 }, winnerAdvancesToSlot: "home", targetRoundName: "Final" },
        { roundName: "Semi Final 2", bracketRound: 2, bracketSlot: 1, homeSource: { type: "winner_of", roundName: "Quarter Final 3", bracketRound: 1, bracketSlot: 2 }, awaySource: { type: "winner_of", roundName: "Quarter Final 4", bracketRound: 1, bracketSlot: 3 }, winnerAdvancesToSlot: "away", targetRoundName: "Final" },
      ],
    });

    stages.push({
      id: "stage-final",
      name: "Final",
      type: "knockout",
      order: 4,
      fixtures: [
        { roundName: "Final", bracketRound: 3, bracketSlot: 0, homeSource: { type: "winner_of", roundName: "Semi Final 1", bracketRound: 2, bracketSlot: 0 }, awaySource: { type: "winner_of", roundName: "Semi Final 2", bracketRound: 2, bracketSlot: 1 } },
      ],
    });
  }

  return { stages };
}

/**
 * Resolves a ParticipantSource to an authoritative team ID, or 0 if unready/unresolved.
 */
export function resolveParticipantSource(
  source: ParticipantSource,
  context: {
    qualifiersBySlotKey: Record<string, number>;
    matchWinnersByRoundName?: Record<string, number>;
    matchWinnersByFixtureId?: Record<number, number>;
  },
): { resolved: boolean; teamId: number; label: string } {
  if (source.type === "direct") {
    return { resolved: source.teamId > 0, teamId: source.teamId, label: `Team ${source.teamId}` };
  }

  if (source.type === "group_rank") {
    const key = makeSlotKey(source.groupName, source.rank);
    const teamId = context.qualifiersBySlotKey[key];
    if (teamId && teamId > 0) {
      return { resolved: true, teamId, label: `${source.groupName} #${source.rank} (Team ${teamId})` };
    }
    return { resolved: false, teamId: 0, label: `${source.groupName} Rank ${source.rank}` };
  }

  if (source.type === "winner_of") {
    if (source.fixtureId && context.matchWinnersByFixtureId?.[source.fixtureId]) {
      const winnerId = context.matchWinnersByFixtureId[source.fixtureId]!;
      return { resolved: winnerId > 0, teamId: winnerId, label: `Winner of #${source.fixtureId} (Team ${winnerId})` };
    }
    if (source.roundName) {
      const targetName = source.roundName.trim().toLowerCase();
      for (const [rName, winnerId] of Object.entries(context.matchWinnersByRoundName ?? {})) {
        if (rName.trim().toLowerCase() === targetName && winnerId > 0) {
          return { resolved: true, teamId: winnerId, label: `Winner of ${source.roundName} (Team ${winnerId})` };
        }
      }
    }
    return { resolved: false, teamId: 0, label: `Winner of ${source.roundName ?? "Match"}` };
  }

  if (source.type === "loser_of") {
    return { resolved: false, teamId: 0, label: `Loser of ${source.roundName ?? "Match"}` };
  }

  return { resolved: false, teamId: 0, label: "TBD" };
}
