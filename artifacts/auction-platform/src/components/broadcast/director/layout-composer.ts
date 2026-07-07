import {
  BROADCAST_OVERLAY_HEIGHT,
  BROADCAST_OVERLAY_SAFE_INSET_X,
  BROADCAST_OVERLAY_SAFE_INSET_Y,
  BROADCAST_OVERLAY_WIDTH,
} from "@/lib/broadcast-overlay";
import { SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX } from "../sponsor-ticker";
import type { BroadcastLayoutModel, BroadcastOutputTarget, BroadcastWidgetPlacement } from "./types";

const TOP_BAR_RESERVE = 100;

/** Safe-area layout composer — shared across all output targets. */
export function composeLayout(
  outputTarget: BroadcastOutputTarget,
  bottomRibbonHeight = SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX,
): BroadcastLayoutModel {
  const scale = outputTarget === "mobile-viewer" ? 0.85 : 1;
  const safeX = Math.round(BROADCAST_OVERLAY_SAFE_INSET_X * scale);
  const safeY = Math.round(BROADCAST_OVERLAY_SAFE_INSET_Y * scale);

  return {
    canvasWidth: BROADCAST_OVERLAY_WIDTH,
    canvasHeight: BROADCAST_OVERLAY_HEIGHT,
    safeInsetX: safeX,
    safeInsetY: safeY,
    contentTop: safeY + TOP_BAR_RESERVE,
    contentLeft: safeX,
    contentRight: safeX,
    contentBottom: bottomRibbonHeight + safeY,
    bottomRibbonHeight,
  };
}

export function defaultWidgets(sceneId: string): BroadcastWidgetPlacement[] {
  return [
    { id: "top-bar", slot: "top-left", visible: sceneId !== "BREAK", zIndex: 35 },
    { id: "sponsor-carousel", slot: "top-right", visible: true, zIndex: 20 },
    { id: "sponsor-ticker", slot: "bottom-left", visible: true, zIndex: 25 },
    { id: "lower-third", slot: "lower-third", visible: true, zIndex: 30 },
    { id: "connection-banner", slot: "center", visible: true, zIndex: 40 },
  ];
}
