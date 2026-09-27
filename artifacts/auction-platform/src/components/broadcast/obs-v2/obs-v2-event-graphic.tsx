import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { OBS_V2 } from "./obs-v2-tokens";
import type { ObsV2BroadcastEvent } from "./obs-v2-events";

export interface ObsV2EventGraphicProps extends HTMLAttributes<HTMLDivElement> {
  /** The currently active broadcast event (or null if none) */
  event: ObsV2BroadcastEvent | null;
  className?: string;
  style?: CSSProperties;
}

export interface EventDisplayConfig {
  text: string;
  color: string;
  glowColor: string;
}

/**
 * Derives the clean, high-impact broadcast callout text and color for live scoring events.
 * Eliminates clutter, containers, and secondary labels so viewers see only the striking glowing number/callout.
 */
export function getEventDisplayText(event: ObsV2BroadcastEvent): EventDisplayConfig {
  switch (event.type) {
    case "SIX":
      return {
        text: "SIX !",
        color: "#FFD700",
        glowColor: "rgba(255, 215, 0, 0.9)",
      };
    case "FOUR":
      return {
        text: "FOUR !",
        color: "#FFB800",
        glowColor: "rgba(255, 184, 0, 0.9)",
      };
    case "WICKET":
      return {
        text: "WICKET !",
        color: "#FF2A3A",
        glowColor: "rgba(255, 42, 58, 0.9)",
      };
    case "WIDE":
      return {
        text: "WIDE !",
        color: "#38BDF8",
        glowColor: "rgba(56, 189, 248, 0.9)",
      };
    case "NO_BALL":
      return {
        text: "NO BALL !",
        color: "#FF8C00",
        glowColor: "rgba(255, 140, 0, 0.9)",
      };
    case "FREE_HIT":
      return {
        text: "FREE HIT !",
        color: "#00E5FF",
        glowColor: "rgba(0, 229, 255, 0.9)",
      };
    case "SUPERBALL":
      return {
        text: "SUPERBALL !",
        color: "#FFD700",
        glowColor: "rgba(255, 215, 0, 0.9)",
      };
    case "MILESTONE":
      if (event.milestoneValue === 100 || event.title?.includes("100")) {
        return {
          text: "100 !",
          color: "#22C55E",
          glowColor: "rgba(34, 197, 94, 0.9)",
        };
      }
      return {
        text: "50 !",
        color: "#22C55E",
        glowColor: "rgba(34, 197, 94, 0.9)",
      };
    case "MATCH_WON":
      return {
        text: "MATCH WON !",
        color: "#FFD700",
        glowColor: "rgba(255, 215, 0, 0.9)",
      };
    default: {
      const base = (event.title || event.type || "").trim();
      const text = base.endsWith("!") ? base : `${base} !`;
      const color = event.accentColor || OBS_V2.color.brand || "#FFD700";
      return {
        text,
        color,
        glowColor: `${color}cc`,
      };
    }
  }
}

/**
 * ObsV2EventGraphic — Minimalist Central Broadcast Callout
 *
 * Television Broadcast Impact Moment:
 * - Positioned strictly inside the Camera Safe Area (y = 96px to 880px)
 * - Centered vertically and horizontally with zero clutter or opaque container boxes
 * - Pure high-impact glowing animated lettering (e.g. "SIX !", "FOUR !", "WICKET !")
 * - Broadcast Timing: Snappy entrance (0–250ms) → Hold & Radiant Glow → Smooth Exit
 */
export const ObsV2EventGraphic = forwardRef<HTMLDivElement, ObsV2EventGraphicProps>(
  function ObsV2EventGraphic({ event, className = "", style, ...rest }, ref) {
    const display = event ? getEventDisplayText(event) : null;

    return (
      <div
        ref={ref}
        className={`obs-v2-central-event-impact pointer-events-none absolute inset-0 flex items-center justify-center select-none ${className}`}
        style={{
          width: "100%",
          height: "100%",
          zIndex: OBS_V2.layer.eventFlash,
          ...style,
        }}
        data-event-active={event ? "true" : "false"}
        data-event-type={event?.type}
        {...rest}
      >
        <AnimatePresence mode="wait">
          {event && display ? (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, scale: 0.6, y: 16 }}
              animate={{
                opacity: 1,
                scale: [0.6, 1.08, 1],
                y: [16, -4, 0],
              }}
              exit={{
                opacity: 0,
                scale: 1.12,
                filter: "blur(10px)",
              }}
              transition={{
                duration: 0.32,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="relative flex items-center justify-center pointer-events-none select-none px-8 py-4"
            >
              {/* Soft ambient radial bloom aura */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full blur-3xl opacity-50"
                style={{
                  background: `radial-gradient(ellipse at 50% 50%, ${display.glowColor} 0%, transparent 65%)`,
                  transform: "scale(1.4)",
                }}
              />

              {/* Big bold glowing animated callout */}
              <span
                className="relative z-10 text-8xl sm:text-9xl md:text-[140px] font-black italic tracking-wider leading-none"
                style={{
                  fontFamily: "'Bebas Neue', 'Barlow Condensed', 'Impact', sans-serif",
                  color: display.color,
                  textShadow: `
                    0 0 20px ${display.color},
                    0 0 45px ${display.glowColor},
                    0 0 80px ${display.glowColor},
                    0 4px 18px rgba(0, 0, 0, 0.95),
                    0 8px 36px rgba(0, 0, 0, 0.9)
                  `,
                  WebkitTextStroke: "2px rgba(0, 0, 0, 0.6)",
                  filter: `drop-shadow(0 0 35px ${display.glowColor})`,
                }}
              >
                {display.text}
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  },
);

ObsV2EventGraphic.displayName = "ObsV2EventGraphic";
