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

export function BroadcastMessageV2({ message, alignRight = false }: BroadcastMessageV2Props) {
  const isVisible = Boolean(message?.active && message?.name);

  return (
    <div
      className="pointer-events-none absolute z-[35] flex flex-col justify-end"
      style={{
        // Position safely above scorebug (scorebugHeight + some breathing room)
        bottom: `${OBS_V2.canvas.scorebugHeight + 16}px`,
        left: alignRight ? undefined : `${OBS_V2.canvas.safeX}px`,
        right: alignRight ? `${OBS_V2.canvas.safeX}px` : undefined,
        maxWidth: "640px",
      }}
    >
      <AnimatePresence mode="wait">
        {isVisible && message ? (
          <motion.div
            key={`bw-msg-${message.name}`}
            initial={{ opacity: 0, x: alignRight ? 36 : -36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: alignRight ? 24 : -24 }}
            transition={{
              duration: 0.22,
              ease: OBS_V2.motion.easing.snappy,
            }}
            className="relative flex items-stretch overflow-hidden select-none"
            style={{
              boxShadow: OBS_V2.depth.shadow.elevated,
              background: OBS_V2.color.panel,
              borderTop: `1px solid ${OBS_V2.color.standard}`,
              borderBottom: `1px solid ${OBS_V2.color.standard}`,
              // V2 gold accent rail — left or right depending on alignment
              borderLeft: alignRight
                ? `1px solid ${OBS_V2.color.standard}`
                : `3px solid ${OBS_V2.color.brand}`,
              borderRight: alignRight
                ? `3px solid ${OBS_V2.color.brand}`
                : `1px solid ${OBS_V2.color.standard}`,
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
              {/* Kicker label */}
              <div
                style={{
                  fontSize: OBS_V2.typography.scale.label.fontSize,
                  fontFamily: OBS_V2.typography.family.body,
                  letterSpacing: OBS_V2.typography.tracking.wider,
                  color: OBS_V2.color.brand,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  marginBottom: 3,
                }}
              >
                BIDWAR BROADCAST
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
                width: "6px",
                flexShrink: 0,
                alignSelf: "stretch",
                background: OBS_V2.color.carbon,
                borderLeft: `1px solid ${OBS_V2.color.hairline}`,
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
