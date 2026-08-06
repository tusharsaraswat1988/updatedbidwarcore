import type { ValidationIssue, ValidationSeverity } from "../catalog/resolve/types.ts";

export type FixtureSource = "badminton" | "cricket";

export type FixtureTypeId =
  | "league"
  | "knockout"
  | "round_robin"
  | "group"
  | "swiss"
  | "double_elimination"
  | "custom"
  | string;

export type FixtureLifecycleStatusId =
  | "draft"
  | "generated"
  | "validated"
  | "locked"
  | "ready"
  | "completed"
  | "archived";

export type FixtureNodeKindId =
  | "contest"
  | "bye"
  | "placeholder"
  | "qualifier"
  | string;

export type AdvancementRuleId =
  | "winner_advances"
  | "loser_advances"
  | "points_table"
  | "group_qualification"
  | "best_performer"
  | "manual"
  | "future"
  | string;

/** Stable platform identity — independent of matches, schedule, courts, time, results. */
export type FixtureIdentity = {
  id: string;
  tournamentId: number;
  typeId: FixtureTypeId;
  source: FixtureSource;
};

/**
 * Working Fixture Configuration.
 * Never includes lifecycle, schedule, court, date, time, officials, or matches.
 */
export type FixtureConfiguration = {
  fixtureId: string;
  tournamentId: number;
  name: string;
  typeId: FixtureTypeId;
  competitionFormat: string | null;
  numberOfRounds: number | null;
  legs: number | null;
  groups: number | null;
  qualificationRules: Record<string, unknown> | null;
  thirdPlaceMatch: boolean;
  placementRules: Record<string, unknown> | null;
  customSettings: Record<string, unknown> | null;
  locked: boolean;
  planVersion: number | null;
};

/** Lifecycle is a separate module — not part of Configuration. */
export type FixtureLifecycle = {
  fixtureId: string;
  tournamentId: number;
  status: FixtureLifecycleStatusId;
  locked: boolean;
};

/** Planned side slot on a Match Blueprint — never execution. */
export type MatchBlueprintSide = {
  sideId: "side_a" | "side_b" | string;
  subject:
    | { kind: "team"; id: string; displayName: string }
    | { kind: "participant"; id: string; displayName: string }
    | { kind: "tbd"; label: string }
    | null;
};

/**
 * Match Blueprint — first-class product concept.
 * Not a table. Not runtime. Not Match Identity.
 */
export type MatchBlueprint = {
  blueprintId: string;
  sides: readonly MatchBlueprintSide[];
  ruleProfileId: string | null;
  presentationProfileId: string | null;
  expectedOutcome: string | null;
  advancementRuleIds: readonly AdvancementRuleId[];
};

export type FixtureNodeAdvancement = {
  ruleId: AdvancementRuleId;
  targetNodeId: string | null;
};

/**
 * Fixture Node — position in the competition structure.
 * Some nodes carry Match Blueprints; some remain structural placeholders.
 */
export type FixtureNode = {
  nodeId: string;
  kindId: FixtureNodeKindId;
  roundLabel: string | null;
  slot: number | null;
  blueprint: MatchBlueprint | null;
  advancements: readonly FixtureNodeAdvancement[];
};

export type FixtureAdvancementView = {
  fixtureId: string;
  tournamentId: number;
  rules: readonly {
    ruleId: AdvancementRuleId;
    fromNodeId: string;
    targetNodeId: string | null;
  }[];
};

export type FixtureConfigurationHistoryPayload = {
  schemaVersion: string;
  name: string;
  typeId: FixtureTypeId;
  competitionFormat: string | null;
  numberOfRounds: number | null;
  legs: number | null;
  groups: number | null;
  qualificationRules: Record<string, unknown> | null;
  thirdPlaceMatch: boolean;
  placementRules: Record<string, unknown> | null;
  customSettings: Record<string, unknown> | null;
  /** Locked node + Match Blueprint structure only — never schedules/matches/results. */
  nodes: readonly FixtureNode[];
  validationSummary: {
    errorCount: number;
    warningCount: number;
    infoCount: number;
    issues: readonly ValidationIssue[];
  };
  frozenAt: string;
};

export type FixtureConfigurationHistoryEntry = {
  fixtureId: string;
  tournamentId: number;
  version: number;
  payload: FixtureConfigurationHistoryPayload;
  frozenAt: string;
  frozenBy: string | null;
};

export type FixtureValidationResult = {
  issues: readonly ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  readiness: "ready" | "almost_ready" | "not_ready";
};

export type FixtureReadiness = FixtureValidationResult["readiness"];

export const FIXTURE_CONFIGURATION_SCHEMA_VERSION = "1.0.0";

export const FIXTURE_LIFECYCLE_ORDER: readonly FixtureLifecycleStatusId[] = [
  "draft",
  "generated",
  "validated",
  "locked",
  "ready",
  "completed",
  "archived",
] as const;

export type { ValidationIssue, ValidationSeverity };
