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
} from "./api-fetch";

export {
  type TournamentFeatures,
  TOURNAMENT_FEATURE_DEFAULTS,
  resolveTournamentFeatures,
  mergeTournamentFeatures,
  isBuzzStudioEnabled,
  tournamentFeaturesSchemaShape,
} from "./tournament-features";

export {
  SCORING_APP_BASE,
  scoringAppPath,
  scoringAppHomePath,
  scoringAppPublicUrl,
  openScoringApp,
} from "./scoring-urls";

export {
  OWNER_APP_BASE,
  ownerJoinPath,
  ownerJoinAppPath,
  ownerDashboardAppPath,
  ownerJoinPublicUrl,
} from "./owner-urls";

export { parseOptionalEmail } from "./email";

export * from "./mobile-app-urls";

export {
  DEFAULT_API_DEV_PORT,
  DEFAULT_AUCTION_DEV_PORT,
  DEFAULT_OWNER_DEV_PORT,
  DEFAULT_SCORING_DEV_PORT,
  DEFAULT_MOBILE_DEV_PORT,
} from "./ports";
