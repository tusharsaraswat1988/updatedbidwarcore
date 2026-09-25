import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { OBS_V2 } from "./obs-v2-tokens";
import { ObsV2Rail } from "./obs-v2-rail";
import { ObsV2Surface } from "./obs-v2-surface";
import { ObsV2Text, ObsV2Label } from "./obs-v2-typography";
import type { ObsV2BroadcastEvent } from "./obs-v2-events";

export interface ObsV2EventGraphicProps extends HTMLAttributes<HTMLDivElement> {
  /** The currently active broadcast event (or null if none) */
  event: ObsV2BroadcastEvent | null;
  className?: string;
  style?: CSSProperties;
}

/**
 * ObsV2EventGraphic — Real-time Transient Television Broadcast Event Bar
 *
 * Implements:
 * - Docked directly above the 140px scorebug within the 5% action-safe area.
 * - Disciplined 3-phase broadcast timing: Snappy Entrance (220ms) → Hold (2600ms) → Collapse (220ms).
 * - Restrained V2 obsidian surfaces with continuous accent rails and semantic color hierarchy.
 * - Zero emojis, zero playful bouncing spring physics.
 */
export const ObsV2EventGraphic = forwardRef<HTMLDivElement, ObsV2EventGraphicProps>(
  function ObsV2EventGraphic({ event, className = "", style, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={`obs-v2-event-graphic pointer-events-none absolute inset-x-0 select-none ${className}`}
        style={{
          bottom: `${OBS_V2.canvas.scorebugHeight}px`,
          paddingLeft: `${OBS_V2.canvas.safeX}px`,
          paddingRight: `${OBS_V2.canvas.safeX}px`,
          zIndex: OBS_V2.layer.eventFlash,
          ...style,
        }}
        data-event-active={event ? "true" : "false"}
        data-event-type={event?.type}
        {...rest}
      >
        <AnimatePresence mode="wait">
          {event ? (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20, scaleY: 0.95 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: 10, scaleY: 0.95 }}
              transition={{
                duration: 0.22,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="relative flex w-full items-stretch justify-between overflow-hidden shadow-2xl"
              style={{
                background: OBS_V2.color.panel,
                borderTop: `2px solid ${event.accentColor}`,
                borderLeft: `1px solid ${event.borderColor}`,
                borderRight: `1px solid ${event.borderColor}`,
                borderBottom: `1px solid ${OBS_V2.color.hairline}`,
                minHeight: "60px",
              }}
            >
              {/* Left Pillar & Title Section */}
              <div className="flex items-center gap-4 px-6 py-2.5">
                {/* Structural Accent Pillar */}
                <div
                  className="h-8 w-2 rounded-xs"
                  style={{ backgroundColor: event.accentColor }}
                />

                {/* Typography Lockup */}
                <div className="flex items-baseline gap-3">
                  <ObsV2Text
                    variant="title"
                    className="font-normal uppercase leading-none"
                    style={{
                      color: event.accentColor,
                      letterSpacing: OBS_V2.typography.tracking.wide,
                    }}
                  >
                    {event.title}
                  </ObsV2Text>

                  <ObsV2Text
                    variant="body"
                    color="primary"
                    className="font-bold uppercase tracking-wider text-xs"
                  >
                    {event.subtitle}
                  </ObsV2Text>
                </div>
              </div>

              {/* Right Brand Anchor */}
              <div
                className="flex items-center gap-3 px-6 py-2.5"
                style={{
                  background: OBS_V2.color.carbon,
                  borderLeft: `1px solid ${OBS_V2.color.divider}`,
                }}
              >
                <ObsV2Label
                  style={{
                    color: OBS_V2.color.brand,
                    letterSpacing: OBS_V2.typography.tracking.wider,
                  }}
                >
                  BIDWAR BROADCAST
                </ObsV2Label>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  },
);
