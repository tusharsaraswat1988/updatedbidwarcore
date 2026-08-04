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
  ResolvedTournamentBindings,
  RuleProfileCatalogEntry,
  SportCatalogEntry,
  TournamentBindingColumns,
  TournamentCreateBindings,
  VariantCatalogEntry,
} from "./catalog/index.ts";
