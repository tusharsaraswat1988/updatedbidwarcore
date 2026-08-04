/**
 * Platform Catalog — public surface.
 * Import only from `@workspace/platform-core/catalog` (or this index).
 * Never import pack files (rules/cricket/…, presentation/…) from app code.
 */

export { CatalogRegistry } from "./registry.ts";
export type { CatalogRegistryApi } from "./registry.ts";

export { resolveRuleProfile, resolveResultOk } from "./resolve/resolver.ts";
export { computeSnapshotHash } from "./resolve/hash.ts";
export {
  compareSemver,
  isCompatibleUpgrade,
  isSemver,
  parseSemver,
  satisfiesSemverRange,
} from "./versioning/semver.ts";

export type {
  MatchRuleOverrides,
  ResolveContext,
  ResolveLayerId,
  ResolveResult,
  ResolveSummary,
  ResolutionMode,
  ResolvedRuleEntry,
  ResolvedRuleSnapshot,
  TournamentRuleOverrides,
  ValidationIssue,
  ValidationSeverity,
} from "./resolve/types.ts";

export {
  ASSET_EPOCH,
  LEGACY_COMPETITION_TYPE_ID,
  LEGACY_PROFILE,
  LEGACY_VARIANT_ID,
  type CatalogEntryBase,
  type CatalogRecommendation,
  type CatalogStatus,
  type CatalogValidationResult,
  type CompetitionTypeCatalogEntry,
  type ConcreteRuleValue,
  type DeclarativeRuntimeBinding,
  type ListProfilesFilter,
  type PresentationProfileCatalogEntry,
  type ResolvedTournamentBindings,
  type RuleCategoryEntry,
  type RuleDefinitionEntry,
  type RuleProfileCatalogEntry,
  type RuleProfileValueEntry,
  type RuleValueType,
  type SportCatalogEntry,
  type SuggestDefaultsInput,
  type TournamentBindingColumns,
  type TournamentCreateBindings,
  type VariantCatalogEntry,
} from "./types.ts";
