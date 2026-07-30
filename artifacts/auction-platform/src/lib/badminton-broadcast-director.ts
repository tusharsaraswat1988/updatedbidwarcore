/**
 * Resolve Operator Broadcast Director scenes for Venue Scoreboard + OBS Overlay.
 */

import type { BadmintonMatchState } from "@workspace/badminton-core";

export type BadmintonOverlayScene =
  | "auto"
  | "compact"
  | "full"
  | "intro"
  | "winner"
  | "sponsor"
  | "multi"
  | "results";

export type BadmintonVenueScene =
  | "auto"
  | "live_score"
  | "standby"
  | "multi"
  | "intro"
  | "winner"
  | "sponsor"
  | "next"
  | "results";

export type OverlayGraphicType =
  | "compact"
  | "full"
  | "intro"
  | "winner"
  | "sponsor"
  | "results";

const OVERLAY_GRAPHIC_TYPES: readonly OverlayGraphicType[] = [
  "compact",
  "full",
  "intro",
  "winner",
  "sponsor",
  "results",
] as const;

/** Camera-covering moment graphics that must not stay up during a live rally. */
const RALLY_UNSAFE_OVERLAY_TYPES: readonly OverlayGraphicType[] = [
  "intro",
  "sponsor",
  "results",
] as const;

/** Max live courts shown on OBS/venue multi strip (was 3 — raised for multi-hall events). */
export const MAX_MULTI_COURT_ROWS = 6;

const VENUE_MOMENT_SCENES: readonly BadmintonVenueScene[] = [
  "intro",
  "winner",
  "sponsor",
  "next",
  "results",
] as const;

export function parseOverlayScene(raw: unknown): BadmintonOverlayScene {
  if (
    raw === "auto" ||
    raw === "compact" ||
    raw === "full" ||
    raw === "intro" ||
    raw === "winner" ||
    raw === "sponsor" ||
    raw === "multi" ||
    raw === "results"
  ) {
    return raw;
  }
  return "auto";
}

export function parseVenueScene(raw: unknown): BadmintonVenueScene {
  if (
    raw === "auto" ||
    raw === "live_score" ||
    raw === "standby" ||
    raw === "multi" ||
    raw === "intro" ||
    raw === "winner" ||
    raw === "sponsor" ||
    raw === "next" ||
    raw === "results"
  ) {
    return raw;
  }
  return "auto";
}

export function isMultiCourtOverlayScene(
  overlayScene: BadmintonOverlayScene | undefined | null,
): boolean {
  return overlayScene === "multi";
}

export function isMultiCourtVenueScene(
  venueScene: BadmintonVenueScene | undefined | null,
): boolean {
  return venueScene === "multi";
}

export function isVenueMomentScene(
  venueScene: BadmintonVenueScene | undefined | null,
): boolean {
  return !!venueScene && (VENUE_MOMENT_SCENES as readonly string[]).includes(venueScene);
}

/** Effective OBS graphic type — server scene wins over URL `?type=` when not `auto`/`multi`. */
export function resolveOverlayGraphicType(
  overlayScene: BadmintonOverlayScene | undefined | null,
  urlType: string | undefined | null,
): OverlayGraphicType {
  if (overlayScene && overlayScene !== "auto" && overlayScene !== "multi") {
    return overlayScene;
  }
  if (urlType && (OVERLAY_GRAPHIC_TYPES as readonly string[]).includes(urlType)) {
    return urlType as OverlayGraphicType;
  }
  return "compact";
}

/**
 * True while a rally can be in progress — camera must stay clear of center moments.
 * Timeouts / intervals allow sponsor & intro packages.
 */
export function isObsActiveRally(
  state: Pick<BadmintonMatchState, "matchStatus" | "activeTimeout" | "inInterval"> | null | undefined,
): boolean {
  if (!state) return false;
  if (state.matchStatus !== "live") return false;
  if (state.activeTimeout) return false;
  if (state.inInterval) return false;
  return true;
}

/** True once any scoring progress exists — intro/sponsor must yield the camera. */
export function hasObsRallyProgress(
  state: Pick<
    BadmintonMatchState,
    "totalRallies" | "leftScore" | "rightScore" | "gamesLeft" | "gamesRight"
  > | null | undefined,
): boolean {
  if (!state) return false;
  return (
    (state.totalRallies ?? 0) > 0 ||
    state.leftScore > 0 ||
    state.rightScore > 0 ||
    state.gamesLeft > 0 ||
    state.gamesRight > 0
  );
}

/**
 * During live play after the first rally, force camera-safe score graphics when
 * the director left intro/sponsor up. Pre-rally walk-on packages still allowed.
 * Winner / full / compact pass through.
 */
export function resolvePlaySafeOverlayType(
  type: OverlayGraphicType,
  state: Pick<
    BadmintonMatchState,
    | "matchStatus"
    | "activeTimeout"
    | "inInterval"
    | "totalRallies"
    | "leftScore"
    | "rightScore"
    | "gamesLeft"
    | "gamesRight"
  > | null | undefined,
): OverlayGraphicType {
  if (!isObsActiveRally(state)) return type;
  if (!(RALLY_UNSAFE_OVERLAY_TYPES as readonly string[]).includes(type)) return type;
  if (!hasObsRallyProgress(state)) return type;
  return "compact";
}

/** Slim top strip + chyron during live play score bugs (compact/full). */
export function shouldUseObsPlayDensity(
  type: OverlayGraphicType,
  state: Pick<BadmintonMatchState, "matchStatus" | "activeTimeout" | "inInterval"> | null | undefined,
  multiCourtMode = false,
): boolean {
  if (multiCourtMode) return true;
  if (type !== "compact" && type !== "full") return false;
  return isObsActiveRally(state) || state?.matchStatus === "live";
}

/**
 * @deprecated Tiny corner bug removed — compact always uses a full lower-third.
 * Kept returning false so callers compile until cleaned up.
 */
export function shouldUseObsCornerBug(
  _type: OverlayGraphicType,
  _state: Pick<BadmintonMatchState, "matchStatus" | "activeTimeout" | "inInterval"> | null | undefined,
  _multiCourtMode = false,
): boolean {
  return false;
}

/** Director moment packages auto-clear so they cannot stick over live play. */
export const BROADCAST_MOMENT_AUTO_CLEAR_MS = 12_000;

/** OBS CEF: slower ticker / longer sponsor holds to cut rAF + image churn. */
export const OBS_CHYRON_PX_PER_SEC = 36;
export const OBS_SPONSOR_CAROUSEL_ROTATE_MS = 6_500;

/**
 * Whether Venue Scoreboard should show the single-match live board.
 * Standby, multi-court, and director moment scenes use dedicated layouts.
 */
export function shouldShowVenueLiveBoard(
  venueScene: BadmintonVenueScene | undefined | null,
  hasMatchState: boolean,
): boolean {
  if (venueScene === "standby" || venueScene === "multi" || isVenueMomentScene(venueScene)) {
    return false;
  }
  return hasMatchState;
}
