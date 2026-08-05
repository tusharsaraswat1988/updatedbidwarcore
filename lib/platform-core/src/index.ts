/**
 * @workspace/platform-core — minimal shared platform kernel.
 *
 * Owns only cross-cutting primitives used by every domain:
 * HTTP helpers, tournament feature flags, app URL builders, tooling.
 * Domain logic belongs in auth / branding / player-registry / media / etc.
 */

export {
  API_PREFIX,
  apiUrl,
  apiFetch,
  type ApiFetchOptions,
} from "./api-fetch.ts";

export {
  type TournamentFeatures,
  TOURNAMENT_FEATURE_DEFAULTS,
  resolveTournamentFeatures,
  mergeTournamentFeatures,
  isBuzzStudioEnabled,
  tournamentFeaturesSchemaShape,
} from "./tournament-features.ts";

export {
  SCORING_APP_BASE,
  scoringAppPath,
  scoringAppHomePath,
  scoringAppPublicUrl,
  openScoringApp,
} from "./scoring-urls.ts";

export {
  OWNER_APP_BASE,
  ownerJoinPath,
  ownerJoinAppPath,
  ownerDashboardAppPath,
  ownerJoinPublicUrl,
} from "./owner-urls.ts";

export { parseOptionalEmail } from "./email.ts";

export * from "./mobile-app-urls.ts";

export {
  DEFAULT_API_DEV_PORT,
  DEFAULT_AUCTION_DEV_PORT,
  DEFAULT_OWNER_DEV_PORT,
  DEFAULT_SCORING_DEV_PORT,
  DEFAULT_MOBILE_DEV_PORT,
} from "./ports.ts";

export {
  CatalogRegistry,
  LEGACY_COMPETITION_TYPE_ID,
  LEGACY_PROFILE,
  LEGACY_VARIANT_ID,
} from "./catalog/index.ts";
export type {
  CatalogValidationResult,
  CompetitionTypeCatalogEntry,
  PresentationProfileCatalogEntry,
  RegistrationModeCatalogEntry,
  ResolveContext,
  ResolveResult,
  ResolvedRuleSnapshot,
  ResolvedTournamentBindings,
  RuleProfileCatalogEntry,
  SportCatalogEntry,
  TeamFormationStrategyCatalogEntry,
  TournamentBindingColumns,
  TournamentCreateBindings,
  VariantCatalogEntry,
} from "./catalog/index.ts";

export {
  resolveCompetitionConfiguration,
  validateCompetitionConfiguration,
  buildCompetitionStatus,
  buildCompetitionPlanPayload,
  resolveTransitionRequest,
  mapAuctionPlayersToParticipants,
  mapBadmintonRegistrationsToParticipants,
} from "./competition/index.ts";
export type {
  CompetitionAggregate,
  CompetitionConfiguration,
  CompetitionPlan,
  CompetitionStatus,
  CompetitionValidationResult,
  Participant,
} from "./competition/index.ts";

export {
  resolveTeamConfiguration,
  mapAuctionTeamToIdentity,
  mapAuctionTeamToConfiguration,
  mapAuctionSignalsToMembers,
  mapMasterTeamBrandingHint,
  validateTeam,
  buildTeamConfigurationHistoryPayload,
  isValidLifecycleTransition,
  lifecycleAfterLock,
} from "./team/index.ts";
export type {
  TeamConfiguration,
  TeamIdentity,
  TeamMember,
  TeamValidationResult,
} from "./team/index.ts";

export {
  resolveMatchConfiguration,
  mapScoringMatchToIdentity,
  mapScoringMatchToConfiguration,
  mapScoringMatchToLifecycle,
  mapScoringMatchToSides,
  mapScoringMatchToOfficials,
  validateMatch,
  buildMatchConfigurationHistoryPayload,
  isValidMatchLifecycleTransition,
  lifecycleAfterMatchLock,
} from "./match/index.ts";
export type {
  MatchConfiguration,
  MatchIdentity,
  MatchSide,
  MatchOfficial,
  MatchValidationResult,
} from "./match/index.ts";

export {
  resolveBadmintonFixtureConfiguration,
  resolveScoringFixtureConfiguration,
  mapBadmintonDrawToIdentity,
  mapBadmintonDrawToConfiguration,
  mapBadmintonDrawToLifecycle,
  mapBadmintonFixturesToNodes,
  mapScoringDrawToIdentity,
  mapScoringDrawToConfiguration,
  mapScoringDrawToLifecycle,
  mapScoringFixturesToNodes,
  buildFixtureAdvancementView,
  validateFixture,
  buildFixtureConfigurationHistoryPayload,
  isValidFixtureLifecycleTransition,
  lifecycleAfterFixtureLock,
  encodeFixtureId,
  parseFixtureId,
} from "./fixture/index.ts";
export type {
  FixtureConfiguration,
  FixtureIdentity,
  FixtureNode,
  MatchBlueprint,
  FixtureValidationResult,
} from "./fixture/index.ts";

export {
  resolveSchedulingConfiguration,
  mapDrawToSchedulingIdentity,
  mapDrawToSchedulingConfiguration,
  mapDrawToSchedulingLifecycle,
  mapBadmintonFixturesToSchedule,
  mapScoringFixturesToSchedule,
  validateScheduling,
  buildSchedulingConfigurationHistoryPayload,
  isValidSchedulingLifecycleTransition,
  lifecycleAfterSchedulingLock,
  encodeSchedulingId,
  parseSchedulingId,
} from "./scheduling/index.ts";
export type {
  SchedulingConfiguration,
  SchedulingIdentity,
  ScheduleSlot,
  ResourceAssignment,
  SchedulingValidationResult,
} from "./scheduling/index.ts";

export {
  mapRowToRuntimeIdentity,
  mapRowToExecutionPhaseState,
  mapRowToRuntimeListItem,
  buildRuntimeContextFromSnapshot,
  buildRuntimeSnapshot,
  buildSnapshotReferences,
  validateRuntimeMatch,
  isValidExecutionPhaseTransition,
  isPhaseAllowedForLifecycle,
  buildFreezeHistoryPayload,
  buildRuntimeHistoryEntry,
} from "./runtime-match/index.ts";
export type {
  RuntimeSnapshot,
  RuntimeContext,
  ExecutionPhaseState,
  RuntimeValidationResult,
  RuntimeHistoryEntry,
} from "./runtime-match/index.ts";

export {
  RuleEngine,
  resolve as resolveRules,
  preview as previewRules,
  validate as validateRules,
  ruleEngineResultOk,
  buildRuleResolutionContextFromParts,
  RULE_ENGINE_VERSION,
  RULE_ENGINE_INPUT_VERSION,
  RUNTIME_RULES_VERSION,
  RUNTIME_RULES_SCHEMA_VERSION,
} from "./rule-engine/index.ts";
export type {
  RuleEngineInput,
  RuleEngineResult,
  RuleEngineDiagnostics,
  RuleResolutionContext,
  RuleResolutionMode,
  ResolvedRuntimeRules,
  ExecutableRule,
  RuleOverrideDocument,
} from "./rule-engine/index.ts";

export {
  PresentationEngine,
  CapabilityCompiler,
  resolve as resolvePresentation,
  preview as previewPresentation,
  validate as validatePresentation,
  adapt as adaptPresentation,
  presentationEngineResultOk,
  buildPresentationResolutionContextFromParts,
  PRESENTATION_ENGINE_VERSION,
  PRESENTATION_ENGINE_INPUT_VERSION,
  PRESENTATION_SCHEMA_VERSION,
  PRESENTATION_CONTRACT_VERSION,
} from "./presentation-engine/index.ts";
export type {
  PresentationEngineInput,
  PresentationEngineResult,
  PresentationEngineDiagnostics,
  PresentationResolutionContext,
  PresentationResolutionMode,
  CompilationMode,
  ResolvedPresentationSnapshot,
  ResolvedPresentationContract,
  AdaptedPresentationContract,
  CapabilityCompilerResult,
  PresentationOverrideDocument,
} from "./presentation-engine/index.ts";
