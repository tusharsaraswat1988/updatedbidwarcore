/**
 * Cricket OBS Real-time Broadcast Event Takeover
 * Scorebug-docked linear television animation system.
 *
 * Disciplined 4-Phase Broadcast Timing:
 * - Entry:  220ms (Lateral wipe / upward expansion)
 * - Impact: 180ms (Precision typographic lock-in)
 * - Hold:   2600ms (High-contrast hold for viewer comprehension)
 * - Exit:   240ms (Crisp collapse back to live scorebug)
 *
 * Absolutely NO emojis. Zero bouncy spring physics.
 */

import { AnimatePresence, motion } from "framer-motion";
import { BROADCAST_FONTS } from "@/components/broadcast/tokens";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_SCOREBOARD_SHELL,
  BIDWAR_SCOREBOARD_PANEL,
} from "@/lib/bidwar-broadcast-colors";
import { BROADCAST_OVERLAY_SAFE_INSET_X } from "@/lib/broadcast-overlay";
import type { CricketObsFlashKind } from "@/lib/cricket-obs-view-model";

type FlashConfig = {
  title: string;
  subtitle: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
};

const FLASH_CONFIGS: Record<CricketObsFlashKind, FlashConfig> = {
  FOUR: {
    title: "BOUNDARY 4",
    subtitle: "FOUR RUNS OFF THE BAT",
    accentColor: BIDWAR_BROADCAST_YELLOW,
    bgColor: BIDWAR_SCOREBOARD_SHELL,
    textColor: "#FFFFFF",
    borderColor: BIDWAR_BROADCAST_YELLOW,
  },
  SIX: {
    title: "MAXIMUM 6",
    subtitle: "MASSIVE HIT INTO THE STANDS",
    accentColor: BIDWAR_BROADCAST_YELLOW,
    bgColor: BIDWAR_SCOREBOARD_SHELL,
    textColor: "#FFFFFF",
    borderColor: BIDWAR_BROADCAST_YELLOW,
  },
  SUPERBALL: {
    title: "SUPERBALL",
    subtitle: "2X RUNS MULTIPLIER ACTIVE",
    accentColor: BIDWAR_BROADCAST_YELLOW,
    bgColor: BIDWAR_SCOREBOARD_SHELL,
    textColor: "#FFFFFF",
    borderColor: BIDWAR_BROADCAST_YELLOW,
  },
  SUPER_OVER: {
    title: "SUPER OVER",
    subtitle: "MATCH TIED · ONE OVER ELIMINATOR",
    accentColor: BIDWAR_BROADCAST_YELLOW,
    bgColor: BIDWAR_SCOREBOARD_SHELL,
    textColor: "#FFFFFF",
    borderColor: BIDWAR_BROADCAST_YELLOW,
  },
  WICKET: {
    title: "WICKET",
    subtitle: "BATTER DISMISSED · MAJOR BREAKTHROUGH",
    accentColor: "#E11D48",
    bgColor: "#140408",
    textColor: "#FFFFFF",
    borderColor: "#E11D48",
  },
  FREE_HIT: {
    title: "FREE HIT",
    subtitle: "NO DISMISSAL ON NEXT LEGAL BALL",
    accentColor: "#06B6D4",
    bgColor: "#04141E",
    textColor: "#FFFFFF",
    borderColor: "#06B6D4",
  },
  NO_BALL: {
    title: "NO BALL",
    subtitle: "EXTRA RUN · FREE HIT AWARDED NEXT DELIVERY",
    accentColor: BIDWAR_BROADCAST_YELLOW,
    bgColor: BIDWAR_SCOREBOARD_SHELL,
    textColor: "#FFFFFF",
    borderColor: BIDWAR_BROADCAST_YELLOW,
  },
  WIDE: {
    title: "WIDE BALL",
    subtitle: "ILLEGAL DELIVERY · EXTRA RUN CONCEDED",
    accentColor: "#94A3B8",
    bgColor: BIDWAR_SCOREBOARD_SHELL,
    textColor: "#FFFFFF",
    borderColor: "#94A3B8",
  },
  NEW_BATSMAN: {
    title: "NEW BATTER",
    subtitle: "WALKING IN TO TAKE GUARD",
    accentColor: "#06B6D4",
    bgColor: BIDWAR_SCOREBOARD_SHELL,
    textColor: "#FFFFFF",
    borderColor: "#06B6D4",
  },
  TOSS_WIN: {
    title: "TOSS UPDATE",
    subtitle: "OFFICIAL DECISION ANNOUNCED",
    accentColor: BIDWAR_BROADCAST_YELLOW,
    bgColor: BIDWAR_SCOREBOARD_SHELL,
    textColor: "#FFFFFF",
    borderColor: BIDWAR_BROADCAST_YELLOW,
  },
  MATCH_WON: {
    title: "MATCH WON",
    subtitle: "CHAMPIONS · VICTORY ACHIEVED",
    accentColor: BIDWAR_BROADCAST_YELLOW,
    bgColor: BIDWAR_SCOREBOARD_SHELL,
    textColor: "#FFFFFF",
    borderColor: BIDWAR_BROADCAST_YELLOW,
  },
};

export function CricketObsEventFlash({
  flash,
  token,
  detail,
}: {
  flash: CricketObsFlashKind | null;
  token: string | null;
  detail?: string | null;
}) {
  const config = flash ? FLASH_CONFIGS[flash] : null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-[140px] z-40 flex flex-col justify-end"
      style={{
        paddingLeft: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
        paddingRight: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
      }}
    >
      <AnimatePresence mode="wait">
        {flash && token && config ? (
          <motion.div
            key={token}
            initial={{ opacity: 0, y: 24, scaleY: 0.9 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: 12, scaleY: 0.95 }}
            transition={{
              duration: 0.22,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="relative flex w-full items-stretch justify-between overflow-hidden shadow-2xl border-t-2"
            style={{
              background: config.bgColor,
              borderColor: config.borderColor,
              minHeight: "56px",
            }}
          >
            {/* Left Primary Event Title */}
            <div className="flex items-center gap-4 px-6 py-2.5">
              <div
                className="h-6 w-1.5"
                style={{ background: config.accentColor }}
              />
              <div className="flex items-baseline gap-3">
                <span
                  className="text-4xl font-normal uppercase tracking-wider text-white leading-none"
                  style={{
                    fontFamily: BROADCAST_FONTS.display,
                    color: config.accentColor,
                    letterSpacing: "0.06em",
                  }}
                >
                  {config.title}
                </span>
                <span
                  className="text-xs font-bold uppercase tracking-widest text-white/80"
                  style={{ fontFamily: BROADCAST_FONTS.body }}
                >
                  {detail || config.subtitle}
                </span>
              </div>
            </div>

            {/* Right Brand Anchor */}
            <div
              className="flex items-center gap-3 px-6 py-2.5 text-xs font-bold uppercase tracking-widest"
              style={{
                background: BIDWAR_SCOREBOARD_PANEL,
                fontFamily: BROADCAST_FONTS.body,
                borderLeft: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <span style={{ color: BIDWAR_BROADCAST_YELLOW }}>BIDWAR BROADCAST</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
