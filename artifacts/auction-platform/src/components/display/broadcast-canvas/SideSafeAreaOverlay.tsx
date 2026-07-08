import {
  BROADCAST_CANVAS_HEIGHT,
  BROADCAST_CANVAS_WIDTH,
  BROADCAST_SAFE_BOTTOM,
  BROADCAST_SAFE_LEFT,
  BROADCAST_SAFE_RIGHT,
  BROADCAST_SAFE_TOP,
} from "@/lib/broadcast-canvas/constants";
import { isDeveloperMode } from "@/lib/broadcast-canvas/preview-mode";
import { useBroadcastCanvasPreviewOptional } from "./BroadcastCanvasProvider";

/** Debug overlay — safe margins, center guides, pixel grid. Developer mode only. */
export function SideSafeAreaOverlay() {
  const ctx = useBroadcastCanvasPreviewOptional();
  if (!ctx || !isDeveloperMode(ctx.preview)) return null;

  const guides = ctx.preview.guides;
  if (guides.size === 0) return null;

  return (
    <>
      {guides.has("safe") ? (
        <div
          className="broadcast-safe-guide"
          aria-hidden
          style={{
            left: BROADCAST_SAFE_LEFT,
            top: BROADCAST_SAFE_TOP,
            width: BROADCAST_CANVAS_WIDTH - BROADCAST_SAFE_LEFT - BROADCAST_SAFE_RIGHT,
            height:
              BROADCAST_CANVAS_HEIGHT - BROADCAST_SAFE_TOP - BROADCAST_SAFE_BOTTOM,
          }}
        />
      ) : null}
      {guides.has("center") ? (
        <>
          <div className="broadcast-center-guide-v" aria-hidden />
          <div className="broadcast-center-guide-h" aria-hidden />
        </>
      ) : null}
      {guides.has("grid") ? <div className="broadcast-pixel-grid" aria-hidden /> : null}
    </>
  );
}
