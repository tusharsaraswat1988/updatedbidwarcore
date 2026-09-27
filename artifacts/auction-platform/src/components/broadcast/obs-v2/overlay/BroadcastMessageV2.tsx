/**
 * BroadcastMessageV2 — V2 Broadcast Chyron (Lower-Third Card)
 *
 * Visual Design: NEW V2 Lovable Design System
 * - Obsidian (#0C0C10) chassis with gold (#FFD700) left accent rail
 * - Bebas Neue display typography for primary name
 * - Inter body typography for secondary details
 * - Framer Motion: slide from left (220ms snappy), hold indefinitely until explicit dismiss
 * - Positioned above scorebug, left-aligned within broadcast safe area
 *
 * Functional Behaviour: Preserved from cricket-obs-broadcast-message.tsx
 * - Remains on screen until operator explicitly closes (no auto-dismiss)
 * - name: primary dominant line (VIP guest, official, sponsor name)
 * - details: secondary descriptive line
 * - active: visibility gate
 *
 * SOURCE EVENT: operator-controlled via CricketBroadcastMessage
 * ADAPTER: cricket-v2-adapter passes through vm.broadcastMessage
 * STATE: passed as prop from parent page
 * COMPONENT: BroadcastMessageV2
 * ENTER: x: -36 → 0, opacity: 0 → 1, 220ms snappy
 * HOLD: indefinite until dismissed
 * EXIT: x: 0 → -24, opacity: 1 → 0, 220ms snappy
 */

import { AnimatePresence, motion } from "framer-motion";
import { OBS_V2 } from "../obs-v2-tokens";

export interface BroadcastMessageV2Props {
  /** Broadcast message data from the live cricket view model */
  message?: {
    active: boolean;
    name: string;
    details?: string;
  } | null;
  /** Position — defaults to left-aligned above scorebug */
  alignRight?: boolean;
}

export function BroadcastMessageV2({ message, alignRight = true }: BroadcastMessageV2Props) {
  const isVisible = Boolean(message?.active && message?.name);

  // Position: Immediately above the 160px scorebug (zones.camera.bottom = 200px)
  // Right-entry within 96px action-safe bounds
  const bottomPosition = OBS_V2.canvas.zones.camera.bottom + 8; // 208px from bottom

  return (
    <div
      className="pointer-events-none absolute z-[35] flex flex-col justify-end"
      style={{
        bottom: `${bottomPosition}px`,
        right: `${OBS_V2.canvas.safeX}px`,
        maxWidth: "640px",
      }}
    >
      <AnimatePresence mode="wait">
        {isVisible && message ? (
          <motion.div
            key={`bw-msg-${message.name}`}
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            transition={{
              duration: 0.24,
              ease: OBS_V2.motion.easing.snappy,
            }}
            className="relative flex items-stretch overflow-hidden select-none"
            style={{
              boxShadow: OBS_V2.depth.shadow.elevated,
              background: OBS_V2.color.panel,
              borderTop: `1px solid ${OBS_V2.color.standard}`,
              borderBottom: `1px solid ${OBS_V2.color.standard}`,
              borderLeft: `1px solid ${OBS_V2.color.standard}`,
              borderRight: `3px solid ${OBS_V2.color.brand}`,
              borderRadius: "6px 0 0 6px",
            }}
          >
            {/* Content Container */}
            <div
              className="flex flex-col justify-center"
              style={{
                padding: `${OBS_V2.spacing.sm}px ${OBS_V2.spacing.xl}px`,
                minWidth: "280px",
                maxWidth: "600px",
              }}
            >
              {/* Kicker bar with real BidWar logo */}
              <div className="flex items-center gap-2 mb-1">
                <img
                  src="/assets/branding/bidwar-reverse-logo-official.png"
                  alt="BidWar"
                  className="h-3.5 w-auto object-contain"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.includes("broadcast/bidwar-reverse-logo-official")) {
                      target.src = "/assets/broadcast/bidwar-reverse-logo-official.png";
                    }
                  }}
                />
                <span
                  style={{
                    fontSize: OBS_V2.typography.scale.micro.fontSize,
                    fontFamily: OBS_V2.typography.family.body,
                    letterSpacing: OBS_V2.typography.tracking.widest,
                    color: OBS_V2.color.brand,
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  BROADCAST
                </span>
              </div>

              {/* Primary Dominant Name — Bebas Neue display */}
              <div
                style={{
                  ...OBS_V2.typography.scale.headline,
                  color: OBS_V2.color.text,
                  letterSpacing: "0.05em",
                  lineHeight: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "560px",
                }}
              >
                {message.name}
              </div>

              {/* Secondary Details Line */}
              {message.details && (
                <div
                  style={{
                    fontSize: OBS_V2.typography.scale.body.fontSize,
                    fontFamily: OBS_V2.typography.family.body,
                    color: OBS_V2.color.textSecondary,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    marginTop: 3,
                    lineHeight: 1.35,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {message.details}
                </div>
              )}
            </div>

            {/* Right structural accent notch */}
            <div
              style={{
                width: "4px",
                flexShrink: 0,
                alignSelf: "stretch",
                background: OBS_V2.color.brand,
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
