/**
 * Platform Catalog — public surface.
 * Import only from `@workspace/platform-core/catalog` (or this index).
 * Never import pack files (rules/cricket/…, presentation/…) from app code.
 */

export { CatalogRegistry } from "./registry.ts";
export type { CatalogRegistryApi } from "./registry.ts";

export {
  LEGACY_COMPETITION_TYPE_ID,
  LEGACY_PROFILE,
  LEGACY_VARIANT_ID,
  type CatalogEntryBase,
  type CatalogRecommendation,
  type CatalogStatus,
  type CatalogValidationResult,
  type CompetitionTypeCatalogEntry,
  type ListProfilesFilter,
  type PresentationProfileCatalogEntry,
  type ResolvedTournamentBindings,
  type RuleProfileCatalogEntry,
  type SportCatalogEntry,
  type SuggestDefaultsInput,
  type TournamentBindingColumns,
  type TournamentCreateBindings,
  type VariantCatalogEntry,
} from "./types.ts";
