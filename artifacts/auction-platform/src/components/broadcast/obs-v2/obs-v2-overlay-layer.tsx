import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { OBS_V2 } from "./obs-v2-tokens";

export interface ObsV2OverlayLayerProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * ObsV2OverlayLayer — Host Container for Full-Screen Broadcast Slates & Event Takeovers
 *
 * Implements:
 * - 1920×1080 fixed positioning layer docked at z-index 40.
 * - Pointer-events-none baseline (interactive controls remain separate).
 * - Host slot for future event flashes (boundaries, wickets) and full slates (scorecard, sponsors).
 */
export const ObsV2OverlayLayer = forwardRef<HTMLDivElement, ObsV2OverlayLayerProps>(
  function ObsV2OverlayLayer({ children, className = "", style, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={`obs-v2-overlay-layer pointer-events-none absolute inset-0 ${className}`}
        style={{
          zIndex: OBS_V2.layer.slates,
          ...style,
        }}
        data-overlay-layer="true"
        {...rest}
      >
        {children}
      </div>
    );
  },
);
