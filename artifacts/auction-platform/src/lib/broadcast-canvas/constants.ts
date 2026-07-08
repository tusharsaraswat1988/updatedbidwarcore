/** Fixed vertical LED broadcast canvas — 1080x1920 (9:16). */
export const BROADCAST_CANVAS_WIDTH = 1080;
export const BROADCAST_CANVAS_HEIGHT = 1920;
export const BROADCAST_CANVAS_ASPECT = 9 / 16;

/** LED safe margins — important content must stay inside. */
export const BROADCAST_SAFE_TOP = 80;
export const BROADCAST_SAFE_BOTTOM = 100;
export const BROADCAST_SAFE_LEFT = 60;
export const BROADCAST_SAFE_RIGHT = 60;

export const BROADCAST_SAFE_CONTENT = {
  left: BROADCAST_SAFE_LEFT,
  top: BROADCAST_SAFE_TOP,
  width: BROADCAST_CANVAS_WIDTH - BROADCAST_SAFE_LEFT - BROADCAST_SAFE_RIGHT,
  height: BROADCAST_CANVAS_HEIGHT - BROADCAST_SAFE_TOP - BROADCAST_SAFE_BOTTOM,
} as const;

/** Shared side-LED layout coordinates (px, canvas-relative). */
export const SIDE_LED_LAYOUT = {
  headerLogoTop: 5,
  headerLogoMaxHeight: 72,
  headerLogoMaxWidth: 380,
  tournamentNameTop: 143,
  tournamentNameSize: 84,
  tournamentNameMaxWidth: 960,
  dividerTop: 292,
  dividerHeight: 2,
  /** Sponsor spotlight — logo centered in canvas middle */
  sponsorKickerTop: 714,
  sponsorKickerOffset: -72,
  sponsorKickerSize: 43,
  sponsorLogoTop: 786,
  sponsorLogoWidth: 400,
  sponsorLogoMaxHeight: 400,
  sponsorNameTop: 1258,
  sponsorNameGap: 72,
  sponsorNameSize: 90,
  sponsorCategoryTop: 1372,
  sponsorCategorySize: 32,
  sponsorFooterTop: 1720,
  sponsorFooterSize: 32,
  /** Player profile — compact header (~18% shorter than sponsor header band) */
  profileHeaderHeight: 254,
  profileLogoTop: 10,
  profileLogoMaxHeight: 70,
  profileLogoMaxWidth: 360,
  profileTitleTopWithLogo: 128,
  profileTitleTopNoLogo: 22,
  profileTitleSize: 58,
  profileTitleMaxWidth: 960,
  profileLiveDotTop: 28,
  profileLiveDotRight: 48,
  playerPhotoTop: 252,
  playerPhotoHeight: 728,
  playerSerialTop: 272,
  playerSerialRight: 48,
  playerSpecsTop: 980,
  playerSpecsPaddingY: 28,
  playerBidTop: 1180,
  playerBidAmountSize: 112,
  playerTimerRight: 48,
  statusBadgeTop: 1780,
  emptyStateTop: 820,
} as const;

/** Broadcast sponsor carousel timing (ms). */
export const SPONSOR_CAROUSEL_HOLD_MS = 7000;
export const SPONSOR_CAROUSEL_FADE_MS = 850;
