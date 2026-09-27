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

  // Position: Anchored directly above scorebug on the right, occupying exact associate sponsor territory
  const bottomPosition = 206; // 206px from bottom (same as AssociateSponsorScorebug)

  return (
    <div
      className="pointer-events-none absolute z-[35] flex flex-col justify-end"
      style={{
        bottom: `${bottomPosition}px`,
        right: "72px",
        maxWidth: "680px",
      }}
    >
      <AnimatePresence mode="wait">
        {isVisible && message ? (
          <motion.div
            key={`bw-msg-${message.name}`}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{
              duration: 0.22,
              ease: OBS_V2.motion.easing.snappy,
            }}
            className="relative flex items-stretch select-none"
            style={{
              clipPath:
                "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 10px), calc(100% - 12px) 100%, 0 100%)",
              background: "linear-gradient(180deg, #11131A 0%, #0C0C10 60%, #08080C 100%)",
              borderTop: "1px solid rgba(255, 255, 255, 0.16)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow: "0 20px 48px rgba(0, 0, 0, 0.95), 0 4px 16px rgba(0, 0, 0, 0.75)",
            }}
          >
            {/* Top directional metallic specular sheen */}
            <div
              className="absolute inset-x-0 top-0 h-[1.5px] pointer-events-none z-20"
              style={{
                background:
                  "linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 215, 0, 0.6) 70%, #FFD700 100%)",
              }}
            />

            {/* Content Container */}
            <div
              className="flex flex-col justify-center"
              style={{
                padding: "12px 28px 14px 22px",
                minWidth: "340px",
                maxWidth: "640px",
              }}
            >
              {/* Kicker bar with official BidWar logo */}
              <div className="flex items-center gap-2.5 mb-1.5">
                <img
                  src="/assets/branding/bidwar-reverse-logo-official.png"
                  alt="BidWar"
                  className="h-4 w-auto object-contain"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.includes("broadcast/bidwar-reverse-logo-official")) {
                      target.src = "/assets/broadcast/bidwar-reverse-logo-official.png";
                    }
                  }}
                />
                <span
                  style={{
                    fontSize: "12px",
                    fontFamily: OBS_V2.typography.family.body,
                    letterSpacing: "0.22em",
                    color: OBS_V2.color.brand,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    lineHeight: 1,
                  }}
                >
                  OFFICIAL BROADCAST
                </span>
              </div>

              {/* Primary Dominant Name — Bebas Neue display */}
              <div
                style={{
                  fontSize: "36px",
                  fontFamily: OBS_V2.typography.family.display,
                  color: "#FFFFFF",
                  letterSpacing: "0.04em",
                  lineHeight: 1.02,
                  textTransform: "uppercase",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "580px",
                  textShadow: "0 2px 8px rgba(0, 0, 0, 0.95)",
                }}
              >
                {message.name}
              </div>

              {/* Secondary Details Line */}
              {message.details && (
                <div
                  style={{
                    fontSize: "16px",
                    fontFamily: OBS_V2.typography.family.body,
                    color: "rgba(248, 250, 252, 0.82)",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    marginTop: 4,
                    lineHeight: 1.3,
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

            {/* Right solid gold structural spine */}
            <div
              style={{
                width: "4.5px",
                flexShrink: 0,
                alignSelf: "stretch",
                background: OBS_V2.color.brand,
                boxShadow: `0 0 12px ${OBS_V2.color.brandGlow}`,
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
