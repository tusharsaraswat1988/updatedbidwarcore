import {
  BROADCAST_OVERLAY_HEIGHT,
  BROADCAST_OVERLAY_SAFE_INSET_X,
  BROADCAST_OVERLAY_SAFE_INSET_Y,
  BROADCAST_OVERLAY_WIDTH,
} from "@/lib/broadcast-overlay";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_BROADCAST_YELLOW_BORDER,
  BIDWAR_BROADCAST_YELLOW_SOFT,
} from "@/lib/bidwar-broadcast-colors";
import type { BroadcastTheme } from "./types";

export const BROADCAST_CANVAS = {
  width: BROADCAST_OVERLAY_WIDTH,
  height: BROADCAST_OVERLAY_HEIGHT,
  safeX: BROADCAST_OVERLAY_SAFE_INSET_X,
  safeY: BROADCAST_OVERLAY_SAFE_INSET_Y,
} as const;

export const BROADCAST_TYPO = {
  playerName: 54,
  currentBid: 72,
  soldPrice: 96,
  sceneTitle: 120,
  label: 11,
  meta: 14,
} as const;

export const BROADCAST_TRANSITION_MS = 300;

export const BROADCAST_FONTS = {
  display: "'Bebas Neue', 'Arial Narrow', Impact, sans-serif",
  body: "'Inter', 'Segoe UI', Arial, sans-serif",
  mono: "'JetBrains Mono', 'Consolas', monospace",
} as const;

export function themePalette(theme: BroadcastTheme) {
  switch (theme) {
    case "gold":
      return {
        accent: BIDWAR_BROADCAST_YELLOW,
        accentSoft: BIDWAR_BROADCAST_YELLOW_SOFT,
        accentBorder: BIDWAR_BROADCAST_YELLOW_BORDER,
        bg: "linear-gradient(145deg, #0a0804 0%, #1a1208 45%, #0d0a06 100%)",
        vignette: "radial-gradient(ellipse at 50% 40%, rgba(255,196,0,0.08) 0%, transparent 65%)",
      };
    case "crimson":
      return {
        accent: "#ef4444",
        accentSoft: "rgba(239,68,68,0.15)",
        accentBorder: "rgba(239,68,68,0.45)",
        bg: "linear-gradient(145deg, #0a0404 0%, #1a0808 45%, #0d0606 100%)",
        vignette: "radial-gradient(ellipse at 50% 40%, rgba(239,68,68,0.08) 0%, transparent 65%)",
      };
    default:
      return {
        accent: BIDWAR_BROADCAST_YELLOW,
        accentSoft: BIDWAR_BROADCAST_YELLOW_SOFT,
        accentBorder: BIDWAR_BROADCAST_YELLOW_BORDER,
        bg: "linear-gradient(145deg, #050508 0%, #0f1018 42%, #060608 100%)",
        vignette: "radial-gradient(ellipse at 50% 35%, rgba(255,196,0,0.06) 0%, transparent 60%)",
      };
  }
}
