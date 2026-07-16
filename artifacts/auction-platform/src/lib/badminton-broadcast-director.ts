/**
 * Resolve Operator Broadcast Director scenes for Venue Scoreboard + OBS Overlay.
 */

export type BadmintonOverlayScene =
  | "auto"
  | "compact"
  | "full"
  | "intro"
  | "winner"
  | "sponsor"
  | "multi";

export type BadmintonVenueScene = "auto" | "live_score" | "standby" | "multi";

export type OverlayGraphicType = "compact" | "full" | "intro" | "winner" | "sponsor";

const OVERLAY_GRAPHIC_TYPES: readonly OverlayGraphicType[] = [
  "compact",
  "full",
  "intro",
  "winner",
  "sponsor",
] as const;

export const MAX_MULTI_COURT_ROWS = 3;

export function parseOverlayScene(raw: unknown): BadmintonOverlayScene {
  if (
    raw === "auto" ||
    raw === "compact" ||
    raw === "full" ||
    raw === "intro" ||
    raw === "winner" ||
    raw === "sponsor" ||
    raw === "multi"
  ) {
    return raw;
  }
  return "auto";
}

export function parseVenueScene(raw: unknown): BadmintonVenueScene {
  if (raw === "auto" || raw === "live_score" || raw === "standby" || raw === "multi") {
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
 * Whether Venue Scoreboard should show the single-match live board.
 * `standby` / `multi` do not use the single-match board.
 */
export function shouldShowVenueLiveBoard(
  venueScene: BadmintonVenueScene | undefined | null,
  hasMatchState: boolean,
): boolean {
  if (venueScene === "standby" || venueScene === "multi") return false;
  return hasMatchState;
}
