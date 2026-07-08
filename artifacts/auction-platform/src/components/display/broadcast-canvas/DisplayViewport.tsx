import { useRef, type ReactNode } from "react";
import {
  BROADCAST_CANVAS_HEIGHT,
  BROADCAST_CANVAS_WIDTH,
} from "@/lib/broadcast-canvas/constants";
import { useCanvasScale } from "@/lib/broadcast-canvas/use-canvas-scale";
import { useBroadcastCanvasPreview } from "./BroadcastCanvasProvider";

/**
 * Fills the browser viewport and scales the fixed canvas uniformly.
 * No layout reflow — only transform: scale() on the canvas wrapper.
 */
export function DisplayViewport({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const { preview } = useBroadcastCanvasPreview();
  const scale = useCanvasScale(
    viewportRef,
    preview.scaleMode,
    BROADCAST_CANVAS_WIDTH,
    BROADCAST_CANVAS_HEIGHT,
  );

  return (
    <div ref={viewportRef} className="display-viewport">
      <div
        className="display-canvas-scaler"
        style={{
          width: BROADCAST_CANVAS_WIDTH,
          height: BROADCAST_CANVAS_HEIGHT,
          transform: `translate3d(-50%, -50%, 0) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
