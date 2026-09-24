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
}

export function CricketObsBroadcastMessage({ broadcastMessage }: Props) {
  const isVisible = Boolean(broadcastMessage?.active && broadcastMessage?.name);

  return (
    <div
      className="pointer-events-none absolute z-35 flex flex-col justify-end"
      style={{
        bottom: "164px",
        left: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
        maxWidth: "600px",
      }}
    >
      <AnimatePresence mode="wait">
        {isVisible && broadcastMessage ? (
          <motion.div
            key={`broadcast-msg-${broadcastMessage.name}`}
            initial={{ opacity: 0, x: -36, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -24, scale: 0.98 }}
            transition={{
              duration: 0.26,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="relative flex items-stretch overflow-hidden border shadow-2xl select-none"
            style={{
              background: BIDWAR_SCOREBOARD_SHELL,
              borderColor: "rgba(255, 255, 255, 0.14)",
              borderLeft: `4px solid ${BIDWAR_BROADCAST_YELLOW}`,
            }}
          >
            {/* Content Container */}
            <div className="flex flex-col justify-center px-5 py-3 min-w-[280px] max-w-[560px]">
              {/* Primary Dominant Name */}
              <div
                className="text-2xl font-bold uppercase tracking-wider text-white leading-tight truncate"
                style={{
                  fontFamily: BROADCAST_FONTS.display,
                  letterSpacing: "0.05em",
                }}
              >
                {broadcastMessage.name}
              </div>

              {/* Secondary Details Line */}
              {broadcastMessage.details ? (
                <div
                  className="text-xs font-semibold uppercase tracking-wide text-white/80 mt-0.5 line-clamp-2"
                  style={{
                    fontFamily: BROADCAST_FONTS.body,
                    color: "rgba(255, 255, 255, 0.85)",
                    lineHeight: "1.35",
                  }}
                >
                  {broadcastMessage.details}
                </div>
              ) : null}
            </div>

            {/* Subtle Right Accent Notch */}
            <div
              className="w-1.5 shrink-0 self-stretch"
              style={{
                background: BIDWAR_SCOREBOARD_PANEL,
                borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
