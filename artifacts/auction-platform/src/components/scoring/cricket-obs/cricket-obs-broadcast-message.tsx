/**
 * Cricket OBS Broadcast Message Component
 * Professional lower-third linear television broadcast card (e.g. VIP guest, sponsor rep, commentator, official).
 * 
 * Strict Television Chyron Design:
 * - Positioned safely above the bottom scorebug inside broadcast action-safe insets
 * - Dominant primary name with secondary details description line
 * - Gold accent structural anchor bar
 * - High-contrast Obsidian broadcast chassis
 * - Smooth fade/slide entry and exit animations
 * - Pure plain-text rendering (zero HTML injection)
 * - Remains on-screen until explicit operator close
 */

import { AnimatePresence, motion } from "framer-motion";
import { BROADCAST_FONTS } from "@/components/broadcast/tokens";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_SCOREBOARD_SHELL,
  BIDWAR_SCOREBOARD_PANEL,
} from "@/lib/bidwar-broadcast-colors";
import { BROADCAST_OVERLAY_SAFE_INSET_X } from "@/lib/broadcast-overlay";
import type { CricketBroadcastMessage } from "@/lib/cricket-obs-view-model";

interface Props {
  broadcastMessage?: CricketBroadcastMessage | null;
  alignRight?: boolean;
  tournamentName?: string;
}

export function CricketObsBroadcastMessage({
  broadcastMessage,
  alignRight = true,
  tournamentName,
}: Props) {
  const isVisible = Boolean(broadcastMessage?.active && broadcastMessage?.name);

  return (
    <div
      className="pointer-events-none absolute z-35 flex flex-col justify-end"
      style={{
        bottom: alignRight ? "156px" : "164px",
        left: alignRight ? undefined : `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
        right: alignRight ? `${BROADCAST_OVERLAY_SAFE_INSET_X}px` : undefined,
        maxWidth: "680px",
      }}
    >
      <AnimatePresence mode="wait">
        {isVisible && broadcastMessage ? (
          <motion.div
            key={`broadcast-msg-${broadcastMessage.name}`}
            initial={{ opacity: 0, x: alignRight ? 320 : -320 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: alignRight ? 320 : -320 }}
            transition={{
              duration: 0.45,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="relative flex items-stretch select-none overflow-hidden"
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
                minWidth: "320px",
                maxWidth: "640px",
              }}
            >
              {/* Kicker bar with official BidWar logo + Tournament Name in WHITE */}
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
                    fontFamily: BROADCAST_FONTS.body,
                    letterSpacing: "0.20em",
                    color: "#FFFFFF",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    lineHeight: 1,
                  }}
                >
                  {tournamentName || "BIDWAR PREMIER LEAGUE"}
                </span>
              </div>

              {/* Primary Dominant Name */}
              <div
                className="text-3xl font-bold uppercase tracking-wider text-white leading-none truncate"
                style={{
                  fontFamily: BROADCAST_FONTS.display,
                  letterSpacing: "0.04em",
                  textShadow: "0 2px 8px rgba(0, 0, 0, 0.95)",
                }}
              >
                {broadcastMessage.name}
              </div>

              {/* Secondary Details Line in YELLOW */}
              {broadcastMessage.details ? (
                <div
                  className="text-sm font-bold uppercase tracking-wide mt-1 line-clamp-2"
                  style={{
                    fontFamily: BROADCAST_FONTS.body,
                    color: BIDWAR_BROADCAST_YELLOW,
                    lineHeight: "1.3",
                    letterSpacing: "0.05em",
                    textShadow: "0 1px 4px rgba(0, 0, 0, 0.9)",
                  }}
                >
                  {broadcastMessage.details}
                </div>
              ) : null}
            </div>

            {/* Right solid gold structural spine */}
            <div
              style={{
                width: "4.5px",
                flexShrink: 0,
                alignSelf: "stretch",
                background: BIDWAR_BROADCAST_YELLOW,
                boxShadow: `0 0 12px rgba(255, 215, 0, 0.4)`,
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
