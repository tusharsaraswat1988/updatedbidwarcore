import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { OBS_V2 } from "./obs-v2-tokens";
import { ObsV2Surface } from "./obs-v2-surface";
import { ObsV2Text, ObsV2Label } from "./obs-v2-typography";
import type { ObsV2BroadcastMessageData } from "./types";

export interface ObsV2BroadcastMessageProps extends HTMLAttributes<HTMLDivElement> {
  /** The broadcast message payload to display (or null to hide) */
  message: ObsV2BroadcastMessageData | null;
  className?: string;
  style?: CSSProperties;
}

/**
 * ObsV2BroadcastMessage — Broadcast Lower-Third Chyron Plate
 *
 * Implements:
 * - Positioned within the 5% action-safe area, docked 16px above the 140px scorebug.
 * - Left-aligned (`left: 96px`, `bottom: 156px`), preserving full 100% camera visibility across the center.
 * - Restrained width (`min-w-[420px] max-w-[680px]`), occupying only the necessary physical space.
 * - Layered Obsidian surface with 3px Brand Gold structural rail and specular hairline.
 * - High-contrast broadcast typography hierarchy: Eyebrow label → Display headline → Supporting detail.
 * - Subordinate BidWar platform identity tag.
 * - Snappy broadcast entrance and exit transitions (220ms, ease: [0.16, 1, 0.3, 1]).
 */
export const ObsV2BroadcastMessage = forwardRef<HTMLDivElement, ObsV2BroadcastMessageProps>(
  function ObsV2BroadcastMessage({ message, className = "", style, ...rest }, ref) {
    const isVisible = Boolean(message && message.message && message.message.trim().length > 0);

    return (
      <div
        ref={ref}
        className={`obs-v2-broadcast-message pointer-events-none absolute select-none ${className}`}
        style={{
          bottom: `${OBS_V2.canvas.scorebugHeight + OBS_V2.spacing.lg}px`,
          left: `${OBS_V2.canvas.safeX}px`,
          zIndex: OBS_V2.layer.slates,
          ...style,
        }}
        data-broadcast-message-active={isVisible ? "true" : "false"}
        {...rest}
      >
        <AnimatePresence mode="wait">
          {isVisible && message ? (
            <motion.div
              key="broadcast-message-plate"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{
                duration: 0.22,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="min-w-[420px] max-w-[680px] overflow-hidden"
            >
              <ObsV2Surface
                level="elevated"
                rail="brand"
                railPosition="left"
                className="px-5 py-3.5 flex flex-col gap-1.5 shadow-2xl"
                style={{
                  borderTop: `1px solid ${OBS_V2.color.hairline}`,
                  borderRight: `1px solid ${OBS_V2.color.standard}`,
                  borderBottom: `1px solid ${OBS_V2.color.standard}`,
                  borderLeft: `3px solid ${OBS_V2.color.brand}`,
                  borderRadius: `${OBS_V2.geometry.radius.sm}px`,
                  background: OBS_V2.color.gradient.elevated,
                }}
              >
                {/* Header Row: Eyebrow + Platform Identity */}
                <div className="flex items-center justify-between gap-4">
                  {message.eyebrow ? (
                    <ObsV2Label
                      style={{
                        color: OBS_V2.color.brand,
                        letterSpacing: OBS_V2.typography.tracking.wider,
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      {message.eyebrow}
                    </ObsV2Label>
                  ) : (
                    <div />
                  )}

                  <span
                    className="font-mono text-[10px] uppercase font-bold tracking-[0.2em]"
                    style={{ color: OBS_V2.color.textMuted }}
                  >
                    BIDWAR
                  </span>
                </div>

                {/* Primary Message Headline */}
                <ObsV2Text
                  variant="headline"
                  className="font-normal uppercase leading-tight tracking-wide"
                  style={{
                    color: OBS_V2.color.text,
                    fontSize: "24px",
                  }}
                >
                  {message.message}
                </ObsV2Text>

                {/* Supporting Narrative Detail (Optional) */}
                {message.supportingText ? (
                  <ObsV2Text
                    variant="body"
                    className="font-medium text-xs tracking-normal leading-normal"
                    style={{
                      color: OBS_V2.color.textSecondary,
                    }}
                  >
                    {message.supportingText}
                  </ObsV2Text>
                ) : null}
              </ObsV2Surface>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  },
);
