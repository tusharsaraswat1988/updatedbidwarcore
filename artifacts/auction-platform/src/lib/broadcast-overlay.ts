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

/** Corner offsets for top chrome (logo, sponsor carousel, live badge). */
export const BROADCAST_OVERLAY_CORNER_INSET_X = 40;
export const BROADCAST_OVERLAY_CORNER_INSET_TOP = 32;
export const BROADCAST_OVERLAY_CORNER_INSET_TOP_ACTIVE = 90;

/** Top-left BidWar brand mark — modest vs sponsor carousel (h-24 ≈ 96px). */
export const BROADCAST_OVERLAY_BRAND_LOGO_HEIGHT = 22;
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

export function broadcastOverlayUrl(origin: string, tournamentId: number): string {
  return `${origin}${broadcastOverlayPath(tournamentId)}`;
}
