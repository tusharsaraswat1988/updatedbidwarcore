import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { OBS_V2 } from "./obs-v2-tokens";

export interface ObsV2CameraZoneProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * ObsV2CameraZone — The Unobstructed Live Video Viewport (876px)
 *
 * Implements:
 * - 100% transparent zone between top header (64px) and bottom scorebug (140px).
 * - Pointer-events-none so no accidental click absorption occurs.
 * - Guaranteed visual clearance for live cricket broadcast footage.
 */
export const ObsV2CameraZone = forwardRef<HTMLDivElement, ObsV2CameraZoneProps>(
  function ObsV2CameraZone({ children, className = "", style, ...rest }, ref) {
    const topOffset = OBS_V2.canvas.headerHeight;
    const bottomOffset = OBS_V2.canvas.scorebugHeight;
    const height = OBS_V2.canvas.height - topOffset - bottomOffset;

    return (
      <div
        ref={ref}
        className={`obs-v2-camera-zone pointer-events-none absolute left-0 right-0 ${className}`}
        style={{
          top: `${topOffset}px`,
          height: `${height}px`,
          backgroundColor: "transparent",
          zIndex: OBS_V2.layer.cameraFeed,
          ...style,
        }}
        data-camera-height={height}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
