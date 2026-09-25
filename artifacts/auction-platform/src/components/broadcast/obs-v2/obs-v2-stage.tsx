import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";
import { OBS_V2 } from "./obs-v2-tokens";
import { ObsV2Canvas } from "./obs-v2-canvas";
import { ObsV2Header } from "./obs-v2-header";
import { ObsV2CameraZone } from "./obs-v2-camera-zone";
import { ObsV2OverlayLayer } from "./obs-v2-overlay-layer";
import { ObsV2Scorebug } from "./obs-v2-scorebug";
import { ObsV2EventGraphic } from "./obs-v2-event-graphic";
import { ObsV2BroadcastMessage } from "./obs-v2-broadcast-message";
import type { ObsV2BroadcastEvent } from "./obs-v2-events";
import {
  MOCK_OBS_V2_STAGE_DATA,
  MOCK_OBS_V2_BROADCAST_MESSAGE,
  type ObsV2StageData,
  type ObsV2BroadcastMessageData,
} from "./types";

export interface ObsV2StageProps extends HTMLAttributes<HTMLDivElement> {
  /** Master broadcast data model. Defaults to MOCK_OBS_V2_STAGE_DATA for preview. */
  data?: ObsV2StageData;
  /** Transient live broadcast event (FOUR, SIX, WICKET, MILESTONE, etc.) */
  activeEvent?: ObsV2BroadcastEvent | null;
  /** Visual prototype broadcast message plate. Defaults to MOCK_OBS_V2_BROADCAST_MESSAGE for preview. */
  broadcastMessage?: ObsV2BroadcastMessageData | null;
  /** When true, renders safe-area boundary lines and zone markers */
  showSafeGuides?: boolean;
  /** Responsive scale factor (e.g. 0.5 for previewing in small containers) */
  scale?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * ObsV2Stage — Master 1920×1080 Cricket Broadcast Stage
 *
 * Structural Architecture:
 * ┌────────────────────────────────────────────────────────┐
 * │ 1. ObsV2Header (64px) - BidWar & Tournament Context    │
 * ├────────────────────────────────────────────────────────┤
 * │                                                        │
 * │ 2. ObsV2CameraZone (876px) - 100% Transparent Viewport │
 * │                                                        │
 * │ 3. ObsV2OverlayLayer - Host for Future Slates          │
 * │    └── ObsV2EventGraphic - Real-time Event Takeovers   │
 * │                                                        │
 * ├────────────────────────────────────────────────────────┤
 * │ 4. ObsV2Scorebug (140px) - Primary Score & Context     │
 * └────────────────────────────────────────────────────────┘
 */
export const ObsV2Stage = forwardRef<HTMLDivElement, ObsV2StageProps>(
  function ObsV2Stage(
    {
      data = MOCK_OBS_V2_STAGE_DATA,
      activeEvent = null,
      broadcastMessage = MOCK_OBS_V2_BROADCAST_MESSAGE,
      showSafeGuides = false,
      scale,
      className = "",
      style,
      ...rest
    },
    ref,
  ) {
    return (
      <ObsV2Canvas
        ref={ref}
        showSafeGuides={showSafeGuides}
        scale={scale}
        phase={data.header.live ? "live" : "standby"}
        className={`obs-v2-stage ${className}`}
        style={style}
        {...rest}
      >
        {/* 1. TOP HEADER (64px) */}
        <ObsV2Header data={data.header} />

        {/* 2. CAMERA-SAFE TRANSPARENT VIEWPORT (876px) */}
        <ObsV2CameraZone />

        {/* 3. FUTURE OVERLAYS HOST LAYER */}
        <ObsV2OverlayLayer />

        {/* 4. BROADCAST MESSAGE CHYRON (Visual Prototype Lower-Third) */}
        <ObsV2BroadcastMessage message={broadcastMessage} />

        {/* 5. REAL-TIME EVENT GRAPHIC (Transient Bar Docked Above Scorebug) */}
        <ObsV2EventGraphic event={activeEvent} />

        {/* 6. BOTTOM SCOREBUG (140px) */}
        <ObsV2Scorebug data={data.scorebug} />

        {/* Supplementary Zone Marker Guides (When showSafeGuides is active) */}
        {showSafeGuides ? (
          <>
            {/* Header Zone Baseline Guide */}
            <div
              className="pointer-events-none absolute left-0 right-0 z-[998]"
              style={{
                top: `${OBS_V2.canvas.headerHeight}px`,
                borderBottom: "1px dotted rgba(255, 215, 0, 0.35)",
              }}
            />
            {/* Scorebug Zone Baseline Guide */}
            <div
              className="pointer-events-none absolute left-0 right-0 z-[998]"
              style={{
                bottom: `${OBS_V2.canvas.scorebugHeight}px`,
                borderTop: "1px dotted rgba(255, 215, 0, 0.35)",
              }}
            />
          </>
        ) : null}
      </ObsV2Canvas>
    );
  },
);
