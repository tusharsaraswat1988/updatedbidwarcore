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
} from "./auction-bid.ts";

export {
  computeEffectiveCapacity,
  computePurseRemaining,
  assertCapacityNotBelowUsed,
} from "./purse-capacity.ts";

export { parseOptionalEmail } from "./email.ts";

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
} from "./bid-value.ts";

export {
  buildPlayerExportRows,
  buildPlayerExportSheetValues,
  playerExportRowsToSheetValues,
  type ExportCategoryMap,
  type ExportTeamMap,
} from "./export-players-rows.ts";

export { formatPlayerGender, formatPlayerGenderForWorkbook, parseWorkbookGenderLabel, WORKBOOK_GENDER_LABELS } from "./player-gender.ts";
export { playerTagLabel } from "./player-tag-label.ts";
export {
  collectSpecColumnLabels,
  resolvePlayerSpecifications,
  type PlayerSpecSource,
} from "./player-spec-export.ts";

export { isPlayerSpecsV2Enabled } from "./player-specs-v2.ts";
export { isPlayerSportProfilesEnabled } from "./player-sport-profiles.ts";

export {
  getIstTodayDateString,
  validateAuctionDate,
  parseAuctionDateString,
  AUCTION_DATE_PAST_ERROR,
  type AuctionDateValidationResult,
} from "./auction-date.ts";

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

export {
  VENUE_MIRROR_TTL_MS,
  evaluateVenueAuctionGuard,
  type VenueAuctionGuardInput,
  type VenueAuctionGuardResult,
} from "./venue-auction-guard.ts";

export const API_PREFIX = "/api";

/** Default API listen port when API_DEV_PROXY_TARGET / PORT are unset in tooling. */
export const DEFAULT_API_DEV_PORT = 8080;

/** Default Vite dev port for auction-platform. */
export const DEFAULT_AUCTION_DEV_PORT = 3000;

/** Default Vite dev port for owner-app. */
export const DEFAULT_OWNER_DEV_PORT = 5174;

/** Default Vite dev port for scoring-app. */
export const DEFAULT_SCORING_DEV_PORT = 5175;

/**
 * Resolve a path for browser fetch/EventSource.
 * Accepts `/auth/...` (appends API_PREFIX) or `/api/...` (unchanged).
 */
export function apiUrl(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`apiUrl: path must start with / (got: ${path})`);
  }
  if (path === API_PREFIX || path.startsWith(`${API_PREFIX}/`)) {
    return path;
  }
  return `${API_PREFIX}${path}`;
}

export type ApiFetchOptions = RequestInit & {
  json?: unknown;
};

/**
 * Cookie-authenticated JSON API helper (browser / Vite dev with proxy).
 */
export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const { json, headers: headersInit, ...init } = options;
  const headers = new Headers(headersInit);
  if (json !== undefined) {
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    return fetch(apiUrl(path), {
      ...init,
      credentials: "include",
      headers,
      body: JSON.stringify(json),
    });
  }
  if (!headers.has("content-type") && init.body && typeof init.body === "string") {
    headers.set("content-type", "application/json");
  }
  return fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers,
  });
}
