/**
 * Fixture Product Layer (EPIC-06).
 * Import from `@workspace/platform-core/fixture`.
 * Public APIs must speak Identity / Configuration / Nodes / Advancement / Validation / History —
 * never runtime draw/fixture tables or generators.
 */

export {
  resolveBadmintonFixtureConfiguration,
  resolveScoringFixtureConfiguration,
  mergeFixtureConfigBlob,
  type BadmintonDrawRuntimeColumns,
  type ScoringDrawRuntimeColumns,
  type FixtureConfigBlob,
} from "./configuration.ts";
export {
  mapBadmintonDrawToIdentity,
  mapBadmintonDrawToConfiguration,
  mapBadmintonDrawToLifecycle,
  mapBadmintonFixturesToNodes,
  mapScoringDrawToIdentity,
  mapScoringDrawToConfiguration,
  mapScoringDrawToLifecycle,
  mapScoringFixturesToNodes,
  buildFixtureAdvancementView,
  type BadmintonDrawBridgeRow,
  type BadmintonFixtureBridgeRow,
  type ScoringDrawBridgeRow,
  type ScoringFixtureBridgeRow,
} from "./bridges.ts";
export {
  validateFixture,
  type CompetitionStateForFixture,
  type FixtureValidationContext,
} from "./validation.ts";
export { buildFixtureConfigurationHistoryPayload } from "./plan.ts";
export {
  isValidFixtureLifecycleTransition,
  lifecycleAfterFixtureLock,
  resolveFixtureLifecycle,
} from "./lifecycle.ts";
export { encodeFixtureId, parseFixtureId } from "./ids.ts";
export {
  FIXTURE_CONFIGURATION_SCHEMA_VERSION,
  FIXTURE_LIFECYCLE_ORDER,
  type AdvancementRuleId,
  type FixtureAdvancementView,
  type FixtureConfiguration,
  type FixtureConfigurationHistoryEntry,
  type FixtureConfigurationHistoryPayload,
  type FixtureIdentity,
  type FixtureLifecycle,
  type FixtureLifecycleStatusId,
  type FixtureNode,
  type FixtureNodeAdvancement,
  type FixtureNodeKindId,
  type FixtureReadiness,
  type FixtureSource,
  type FixtureTypeId,
  type FixtureValidationResult,
  type MatchBlueprint,
  type MatchBlueprintSide,
  type ValidationIssue,
} from "./types.ts";
