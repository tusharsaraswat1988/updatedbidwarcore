import type {
  FixtureAdvancementView,
  FixtureIdentity,
  FixtureNode,
  FixtureNodeAdvancement,
  MatchBlueprint,
  MatchBlueprintSide,
} from "./types.ts";
import { encodeFixtureId } from "./ids.ts";
import {
  resolveBadmintonFixtureConfiguration,
  resolveScoringFixtureConfiguration,
  type BadmintonDrawRuntimeColumns,
  type ScoringDrawRuntimeColumns,
} from "./configuration.ts";
import { resolveFixtureLifecycle } from "./lifecycle.ts";

/** Runtime badminton draw row — never returned from product APIs. */
export type BadmintonDrawBridgeRow = BadmintonDrawRuntimeColumns & {
  lifecycleStatus?: string | null;
};

/** Runtime badminton fixture row — mapped to Fixture Node / Blueprint. */
export type BadmintonFixtureBridgeRow = {
  id: number;
  drawId: number;
  slotNumber?: number | null;
  registrationAId?: number | null;
  registrationBId?: number | null;
  winnerAdvancesTo?: number | null;
  loserAdvancesTo?: number | null;
  status?: string | null;
  metaJson?: Record<string, unknown> | null;
};

/** Runtime scoring draw row — never returned from product APIs. */
export type ScoringDrawBridgeRow = ScoringDrawRuntimeColumns & {
  lifecycleStatus?: string | null;
};

/** Runtime scoring fixture row — mapped to Fixture Node / Blueprint. */
export type ScoringFixtureBridgeRow = {
  id: number;
  drawId?: number | null;
  bracketRound?: number | null;
  bracketSlot?: number | null;
  fixtureNumber?: number | null;
  roundName?: string | null;
  homeTeamId: number;
  awayTeamId: number;
  status?: string | null;
};

function nodeIdForRuntime(prefix: string, runtimeId: number): string {
  return `${prefix}-${runtimeId}`;
}

function sideFromRegistration(
  sideId: "side_a" | "side_b",
  registrationId: number | null | undefined,
  labels?: Map<number, string>,
): MatchBlueprintSide {
  if (registrationId == null) {
    return { sideId, subject: { kind: "tbd", label: "TBD" } };
  }
  return {
    sideId,
    subject: {
      kind: "participant",
      id: `badminton-registration:${registrationId}`,
      displayName: labels?.get(registrationId) ?? `Entry ${registrationId}`,
    },
  };
}

function sideFromTeam(
  sideId: "side_a" | "side_b",
  teamId: number,
  labels?: Map<number, string>,
): MatchBlueprintSide {
  if (!teamId || teamId <= 0) {
    return { sideId, subject: { kind: "tbd", label: "TBD" } };
  }
  return {
    sideId,
    subject: {
      kind: "team",
      id: String(teamId),
      displayName: labels?.get(teamId) ?? `Team ${teamId}`,
    },
  };
}

function inferBadmintonNodeKind(row: BadmintonFixtureBridgeRow): string {
  const a = row.registrationAId;
  const b = row.registrationBId;
  if ((a == null && b != null) || (b == null && a != null)) return "bye";
  if (a == null && b == null) return "placeholder";
  return "contest";
}

/** BadmintonDrawsBridge → Fixture Identity. */
export function mapBadmintonDrawToIdentity(row: BadmintonDrawBridgeRow): FixtureIdentity {
  const config = resolveBadmintonFixtureConfiguration(row);
  return {
    id: encodeFixtureId("badminton", row.id),
    tournamentId: row.tournamentId,
    typeId: config.typeId,
    source: "badminton",
  };
}

export function mapBadmintonDrawToConfiguration(
  row: BadmintonDrawBridgeRow,
  opts?: { planVersion?: number | null },
) {
  return resolveBadmintonFixtureConfiguration(row, opts);
}

export function mapBadmintonDrawToLifecycle(
  row: BadmintonDrawBridgeRow,
  hasStructure: boolean,
) {
  return resolveFixtureLifecycle(
    encodeFixtureId("badminton", row.id),
    row.tournamentId,
    row.lifecycleStatus,
    !!row.configurationLocked,
    hasStructure,
  );
}

/**
 * Badminton fixtures → Fixture Nodes + Match Blueprints.
 * Advancement uses catalog rule ids — never embeds winner/loser as platform logic.
 */
export function mapBadmintonFixturesToNodes(
  fixtures: readonly BadmintonFixtureBridgeRow[],
  opts?: {
    registrationLabels?: Map<number, string>;
    ruleProfileId?: string | null;
    presentationProfileId?: string | null;
  },
): FixtureNode[] {
  const byRuntimeId = new Map(fixtures.map((f) => [f.id, f]));
  return fixtures.map((row) => {
    const kindId = inferBadmintonNodeKind(row);
    const advancements: FixtureNodeAdvancement[] = [];
    if (row.winnerAdvancesTo != null && byRuntimeId.has(row.winnerAdvancesTo)) {
      advancements.push({
        ruleId: "winner_advances",
        targetNodeId: nodeIdForRuntime("bf", row.winnerAdvancesTo),
      });
    }
    if (row.loserAdvancesTo != null && byRuntimeId.has(row.loserAdvancesTo)) {
      advancements.push({
        ruleId: "loser_advances",
        targetNodeId: nodeIdForRuntime("bf", row.loserAdvancesTo),
      });
    }

    const blueprint: MatchBlueprint | null =
      kindId === "bye" && (row.registrationAId == null || row.registrationBId == null)
        ? null
        : {
            blueprintId: `bp-bf-${row.id}`,
            sides: [
              sideFromRegistration("side_a", row.registrationAId, opts?.registrationLabels),
              sideFromRegistration("side_b", row.registrationBId, opts?.registrationLabels),
            ],
            ruleProfileId: opts?.ruleProfileId ?? null,
            presentationProfileId: opts?.presentationProfileId ?? null,
            expectedOutcome: null,
            advancementRuleIds: advancements.map((a) => a.ruleId),
          };

    // Bye nodes stay structural; contest/placeholder may carry blueprints.
    const finalBlueprint =
      kindId === "bye"
        ? null
        : kindId === "placeholder" && !row.registrationAId && !row.registrationBId
          ? blueprint
          : blueprint;

    return {
      nodeId: nodeIdForRuntime("bf", row.id),
      kindId,
      roundLabel: null,
      slot: row.slotNumber ?? null,
      blueprint: kindId === "contest" || kindId === "placeholder" ? finalBlueprint : null,
      advancements,
    };
  });
}

/** ScoringDrawsBridge → Fixture Identity. */
export function mapScoringDrawToIdentity(row: ScoringDrawBridgeRow): FixtureIdentity {
  const config = resolveScoringFixtureConfiguration(row);
  return {
    id: encodeFixtureId("cricket", row.id),
    tournamentId: row.tournamentId,
    typeId: config.typeId,
    source: "cricket",
  };
}

export function mapScoringDrawToConfiguration(
  row: ScoringDrawBridgeRow,
  opts?: { planVersion?: number | null; groupCount?: number | null },
) {
  return resolveScoringFixtureConfiguration(row, opts);
}

export function mapScoringDrawToLifecycle(
  row: ScoringDrawBridgeRow,
  hasStructure: boolean,
) {
  return resolveFixtureLifecycle(
    encodeFixtureId("cricket", row.id),
    row.tournamentId,
    row.lifecycleStatus,
    !!row.configurationLocked,
    hasStructure,
  );
}

export function mapScoringFixturesToNodes(
  fixtures: readonly ScoringFixtureBridgeRow[],
  opts?: {
    teamLabels?: Map<number, string>;
    ruleProfileId?: string | null;
    presentationProfileId?: string | null;
  },
): FixtureNode[] {
  return fixtures.map((row) => {
    const bothTbd = (!row.homeTeamId || row.homeTeamId <= 0) && (!row.awayTeamId || row.awayTeamId <= 0);
    const oneSide =
      (row.homeTeamId > 0 && (!row.awayTeamId || row.awayTeamId <= 0)) ||
      (row.awayTeamId > 0 && (!row.homeTeamId || row.homeTeamId <= 0));
    const kindId = oneSide ? "bye" : bothTbd ? "placeholder" : "contest";

    const blueprint: MatchBlueprint | null =
      kindId === "bye"
        ? null
        : {
            blueprintId: `bp-sf-${row.id}`,
            sides: [
              sideFromTeam("side_a", row.homeTeamId, opts?.teamLabels),
              sideFromTeam("side_b", row.awayTeamId, opts?.teamLabels),
            ],
            ruleProfileId: opts?.ruleProfileId ?? null,
            presentationProfileId: opts?.presentationProfileId ?? null,
            expectedOutcome: null,
            advancementRuleIds: [],
          };

    return {
      nodeId: nodeIdForRuntime("sf", row.id),
      kindId,
      roundLabel: row.roundName ?? (row.bracketRound != null ? `Round ${row.bracketRound}` : null),
      slot: row.bracketSlot ?? row.fixtureNumber ?? null,
      blueprint,
      advancements: [],
    };
  });
}

export function buildFixtureAdvancementView(
  fixtureId: string,
  tournamentId: number,
  nodes: readonly FixtureNode[],
): FixtureAdvancementView {
  const rules = nodes.flatMap((node) =>
    node.advancements.map((a) => ({
      ruleId: a.ruleId,
      fromNodeId: node.nodeId,
      targetNodeId: a.targetNodeId,
    })),
  );
  return { fixtureId, tournamentId, rules };
}
