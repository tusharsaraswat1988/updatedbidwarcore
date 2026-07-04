/**
 * Broadcast Overlay — landscape browser-source overlay for live streaming.
 * Compatible with OBS, vMix, Wirecast, XSplit, StreamYard, and any
 * browser-source capable broadcast software.
 *
 * Internal route remains `/tournament/:id/obs` for backward compatibility.
 */

/** Primary supported canvas size (16:9 landscape). */
export const BROADCAST_OVERLAY_WIDTH = 1920;
export const BROADCAST_OVERLAY_HEIGHT = 1080;
export const BROADCAST_OVERLAY_ASPECT = "16:9" as const;

/**
 * Action-safe inset for 1920×1080 (~5%).
 * Critical UI (player card, bid panel, sponsor carousel) stays inside this box.
 */
export const BROADCAST_OVERLAY_SAFE_INSET_X = 96;
export const BROADCAST_OVERLAY_SAFE_INSET_Y = 54;

/** Horizontal padding used by the lower-third bid panel. */
export const BROADCAST_OVERLAY_PANEL_PADDING_X = 48;

/** Horizontal inset for right-side sponsor chrome (px). */
export const BROADCAST_OVERLAY_CORNER_INSET_X = 40;
/** Horizontal inset for top-left tournament logo — closer to the edge than sponsors. */
export const BROADCAST_OVERLAY_TOURNAMENT_INSET_X = 16;
/** Small gap between the top edge and the logo row (px). */
export const BROADCAST_OVERLAY_TOP_INSET_Y = 10;
/** Shared height for BidWar center mark and sponsor logos in the top row (px). */
export const BROADCAST_OVERLAY_TOP_LOGO_HEIGHT = 56;
/** Tournament crest — 25% larger than the shared logo height. */
export const BROADCAST_OVERLAY_TOURNAMENT_LOGO_HEIGHT = Math.round(
  BROADCAST_OVERLAY_TOP_LOGO_HEIGHT * 1.25,
);
export const BROADCAST_OVERLAY_TOURNAMENT_LOGO_MAX_WIDTH = 250;
/** Top-right sponsor crest — 20% larger than the shared logo height. */
export const BROADCAST_OVERLAY_SPONSOR_LOGO_HEIGHT = Math.round(
  BROADCAST_OVERLAY_TOP_LOGO_HEIGHT * 1.2,
);
export const BROADCAST_OVERLAY_SPONSOR_LOGO_MAX_WIDTH = 240;
export const BROADCAST_OVERLAY_TOP_ROW_HEIGHT = Math.max(
  BROADCAST_OVERLAY_TOP_LOGO_HEIGHT,
  BROADCAST_OVERLAY_TOURNAMENT_LOGO_HEIGHT,
  BROADCAST_OVERLAY_SPONSOR_LOGO_HEIGHT,
);
/** Gap between logo row and tournament title (px). */
export const BROADCAST_OVERLAY_TOURNAMENT_NAME_GAP = 4;

/** Max width for sponsor name/type captions below logo (logo size unchanged). */
export const BROADCAST_OVERLAY_SPONSOR_CAPTION_MAX_WIDTH = 320;

/** Admin-uploaded OBS broadcast logo (OBS_WATERMARK) — shown full PNG at top center. */
export const BROADCAST_OVERLAY_OBS_LOGO_MAX_HEIGHT = BROADCAST_OVERLAY_TOP_LOGO_HEIGHT;
export const BROADCAST_OVERLAY_OBS_LOGO_MAX_WIDTH = 440;
export const BROADCAST_OVERLAY_BRAND_Z_INDEX = 35;

/** Bottom ticker credit segment (interleaved with sponsor names on Broadcast Overlay). */
export const BIDWAR_TICKER_CREDIT = "Powered by BidWar";

export const BROADCAST_OVERLAY_METADATA = {
  recommendedResolution: "1920 × 1080",
  aspectRatio: "16:9",
  updateMethod: "Real-time automatic updates",
  usage: "Browser Source compatible",
} as const;

export const BROADCAST_OVERLAY_QUICK_SETUP = [
  { step: 1, text: "Copy Broadcast Overlay URL" },
  { step: 2, text: "Open OBS, vMix, Wirecast, or your broadcast software" },
  { step: 3, text: "Add Browser Source" },
  { step: 4, text: "Set Width = 1920" },
  { step: 5, text: "Set Height = 1080" },
  { step: 6, text: "Done" },
] as const;

/** Relative path (internal route; user-facing name is Broadcast Overlay). */
export function broadcastOverlayPath(tournamentId: number): string {
  return `/tournament/${tournamentId}/obs`;
}

/** Browser preview — camera feed + live overlay (no OBS required). */
export function broadcastOverlayPreviewPath(tournamentId: number): string {
  return `/tournament/${tournamentId}/obs/preview`;
}

export function broadcastOverlayUrl(origin: string, tournamentId: number): string {
  return `${origin}${broadcastOverlayPath(tournamentId)}`;
}

export function broadcastOverlayPreviewUrl(origin: string, tournamentId: number): string {
  return `${origin}${broadcastOverlayPreviewPath(tournamentId)}`;
}
