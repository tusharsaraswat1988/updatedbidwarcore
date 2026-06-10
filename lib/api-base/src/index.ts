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
  getIstTodayDateString,
  validateAuctionDate,
  parseAuctionDateString,
  AUCTION_DATE_PAST_ERROR,
  type AuctionDateValidationResult,
} from "./auction-date.ts";

export {
  OWNER_APP_BASE,
  ownerJoinPath,
  ownerDashboardAppPath,
  ownerJoinPublicUrl,
} from "./owner-urls.ts";

export const API_PREFIX = "/api";

/** Default API listen port when API_DEV_PROXY_TARGET / PORT are unset in tooling. */
export const DEFAULT_API_DEV_PORT = 8080;

/** Default Vite dev port for auction-platform. */
export const DEFAULT_AUCTION_DEV_PORT = 3000;

/** Default Vite dev port for owner-app. */
export const DEFAULT_OWNER_DEV_PORT = 5174;

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
