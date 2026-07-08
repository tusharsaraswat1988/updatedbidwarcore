import type { CSSProperties, ReactNode } from "react";
import {
  BROADCAST_CANVAS_HEIGHT,
  BROADCAST_CANVAS_WIDTH,
} from "@/lib/broadcast-canvas/constants";

/**
 * Fixed 1080×1920 broadcast design surface.
 * All children use absolute positioning relative to this canvas.
 */
export function DisplayCanvas({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`display-canvas auction-stage ${className ?? ""}`}
      style={{
        width: BROADCAST_CANVAS_WIDTH,
        height: BROADCAST_CANVAS_HEIGHT,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
