/**
 * Canonical BidWar brand assets for Buzz Studio templates (SSR + export safe).
 */

import { resolvePlatformReverseLogoUrl } from "@workspace/api-base/branding-assets";

/** Absolute URL — works in Playwright export and live preview. */
export const BIDWAR_REVERSE_LOGO_URL = resolvePlatformReverseLogoUrl();
