/**
 * Single source of truth for frontend → API URL shape.
 *
 * Production / same-origin: relative `/api/...` (static + API on one host).
 * Local Vite dev: same relative paths; vite.config proxies `/api` to the API server.
 */

export {
  computeNextBidAmount,
  validateBidAmount,
  type BidAmountInput,
} from "./auction-bid";

export {
  TRIAL_AUCTION_ELIGIBLE_TEAM_LIMIT,
  TRIAL_AUCTION_PARTICIPATION_ERROR,
  isAuctionLicenseActive,
  isTeamEligibleForTrialAuction,
} from "./auction-trial";

export {
  BID_ACK_TIMEOUT_MS,
  BID_WATCHDOG_MS,
  decideBidMutationApply,
  isBidAckPayload,
  isBidUiBusy,
  logBidLifecycle,
  mergeBidFields,
  nextMonotonicVersion,
  reduceBidUiPhase,
  shouldAcceptMonotonicVersion,
  shouldApplyBidDelta,
  simulateRapidBidVersionRace,
  type BidLifecycleEvent,
  type BidLifecycleLog,
  type BidMutationDecision,
  type BidMutationPayload,
  type BidUiPhase,
} from "./auction-bid-sync";

export {
  computeEffectiveCapacity,
  computePurseRemaining,
  assertCapacityNotBelowUsed,
} from "./purse-capacity";

export {
  PURSE_BOOSTER_LED_DURATION_MS,
  createLedPurseBoosterOverlay,
  replayLedPurseBoosterOverlay,
  parseLedPurseBoosterOverlay,
  type LedPurseBoosterOverlay,
  type LedPurseBoosterTeamLine,
} from "./purse-booster-led";

export { parseOptionalEmail } from "./email";

export {
  type BidValueMode,
  type BidValueSource,
  parseBidValueOptions,
  serializeBidValueOptions,
  isPlayerBidValueMode,
  getOrganizerBidOptions,
  shouldShowPlayerBidValueSelector,
  bidValueSourceLabel,
  resolvePlayerBidFields,
  canEditPlayerBidValue,
} from "./bid-value";

export {
  resolveRetainedSpend,
  resolveRetainedPriceForSave,
  type RetainedSpendPlayer,
} from "./retained-price";

export {
  buildTeamReportAuctionRules,
  computeTeamReportPlanningRows,
  describeBidIncrementRules,
  type TeamReportAuctionRules,
} from "./team-report-rules";

export {
  type ReAuctionStrategy,
  type ReAuctionStrategyMode,
  type OpeningBidInput,
  parseReAuctionStrategy,
  serializeReAuctionStrategy,
  resolveOpeningBid,
  validateFixedReAuctionAmount,
  parseReAuctionStrategyFromRequest,
} from "./re-auction-strategy";

export {
  buildPlayerExportRows,
  buildPlayerExportSheetValues,
  playerExportRowsToSheetValues,
  type ExportCategoryMap,
  type ExportTeamMap,
} from "./export-players-rows";

export { formatPlayerGender, formatPlayerGenderForWorkbook, parseWorkbookGenderLabel, WORKBOOK_GENDER_LABELS } from "./player-gender";
export { playerTagLabel } from "./player-tag-label";
export {
  collectSpecColumnLabels,
  resolvePlayerSpecifications,
  type PlayerSpecSource,
} from "./player-spec-export";

export { isPlayerSpecsV2Enabled } from "./player-specs-v2";
export { isPlayerSportProfilesEnabled } from "./player-sport-profiles";

export {
  getIstTodayDateString,
  validateAuctionDate,
  parseAuctionDateString,
  AUCTION_DATE_PAST_ERROR,
  type AuctionDateValidationResult,
} from "./auction-date";

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

export {
  VENUE_MIRROR_TTL_MS,
  evaluateVenueAuctionGuard,
  type VenueAuctionGuardInput,
  type VenueAuctionGuardResult,
} from "./venue-auction-guard";

/** Default API listen port when API_DEV_PROXY_TARGET / PORT are unset in tooling. */
export { DEFAULT_API_DEV_PORT } from "@workspace/platform-core";

/** Default Vite dev port for auction-platform. */
export { DEFAULT_AUCTION_DEV_PORT } from "@workspace/platform-core";

/** Default Vite dev port for owner-app. */
export { DEFAULT_OWNER_DEV_PORT } from "@workspace/platform-core";

/** Default Vite dev port for scoring-app. */
export { DEFAULT_SCORING_DEV_PORT } from "@workspace/platform-core";

/** Default Vite dev port for shared mobile-app (dual-auth shell). */
export { DEFAULT_MOBILE_DEV_PORT } from "@workspace/platform-core";

export {
  API_PREFIX,
  apiUrl,
  apiFetch,
  type ApiFetchOptions,
} from "./api-fetch";
