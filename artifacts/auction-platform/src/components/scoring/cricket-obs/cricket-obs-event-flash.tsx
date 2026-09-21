import { AnimatePresence, motion } from "framer-motion";
import type { CricketObsFlashKind } from "@/lib/cricket-obs-view-model";

type FlashConfig = {
  title: string;
  subtitle?: string;
  bgGradient: string;
  borderGradient: string;
  textColor: string;
  glowColor: string;
  icon: string;
};

const FLASH_CONFIGS: Record<CricketObsFlashKind, FlashConfig> = {
  FOUR: {
    title: "FOUR!",
    subtitle: "CRACKING BOUNDARY",
    bgGradient: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #172554 100%)",
    borderGradient: "#60a5fa",
    textColor: "#ffffff",
    glowColor: "rgba(59, 130, 246, 0.6)",
    icon: "⚡",
  },
  SIX: {
    title: "MAXIMUM 6!",
    subtitle: "HUGE HIT INTO THE STANDS",
    bgGradient: "linear-gradient(135deg, #581c87 0%, #7e22ce 50%, #3b0764 100%)",
    borderGradient: "#c084fc",
    textColor: "#ffffff",
    glowColor: "rgba(168, 85, 247, 0.7)",
    icon: "💥",
  },
  SUPERBALL: {
    title: "SUPER BALL!",
    subtitle: "2X RUNS · BATTER PROTECTED",
    bgGradient: "linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #431407 100%)",
    borderGradient: "#fb923c",
    textColor: "#ffffff",
    glowColor: "rgba(234, 88, 12, 0.75)",
    icon: "🔥",
  },
  SUPER_OVER: {
    title: "SUPER OVER!",
    subtitle: "MATCH TIED · 1 OVER SHOOTOUT",
    bgGradient: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #0f172a 100%)",
    borderGradient: "#818cf8",
    textColor: "#ffffff",
    glowColor: "rgba(99, 102, 241, 0.6)",
    icon: "⚡",
  },
  WICKET: {
    title: "WICKET!",
    subtitle: "OUT! MAJOR BREAKTHROUGH",
    bgGradient: "linear-gradient(135deg, #7f1d1d 0%, #b91c1c 50%, #450a0a 100%)",
    borderGradient: "#f87171",
    textColor: "#ffffff",
    glowColor: "rgba(239, 68, 68, 0.8)",
    icon: "🚨",
  },
  FREE_HIT: {
    title: "FREE HIT!",
    subtitle: "CANNOT BE DISMISSED BOWLED/CAUGHT",
    bgGradient: "linear-gradient(135deg, #0e7490 0%, #06b6d4 50%, #164e63 100%)",
    borderGradient: "#22d3ee",
    textColor: "#ffffff",
    glowColor: "rgba(6, 182, 212, 0.7)",
    icon: "🎯",
  },
  NO_BALL: {
    title: "NO BALL!",
    subtitle: "EXTRA RUN + FREE HIT AWARDED",
    bgGradient: "linear-gradient(135deg, #854d0e 0%, #ca8a04 50%, #422006 100%)",
    borderGradient: "#facc15",
    textColor: "#ffffff",
    glowColor: "rgba(234, 179, 8, 0.6)",
    icon: "⚠️",
  },
  WIDE: {
    title: "WIDE BALL",
    subtitle: "EXTRA RUN AWARDED",
    bgGradient: "linear-gradient(135deg, #1e293b 0%, #334155 50%, #0f172a 100%)",
    borderGradient: "#94a3b8",
    textColor: "#ffffff",
    glowColor: "rgba(148, 163, 184, 0.4)",
    icon: "↔️",
  },
  NEW_BATSMAN: {
    title: "NEW BATSMAN",
    subtitle: "WALKING IN TO BAT",
    bgGradient: "linear-gradient(135deg, #064e3b 0%, #059669 50%, #022c22 100%)",
    borderGradient: "#34d399",
    textColor: "#ffffff",
    glowColor: "rgba(16, 185, 129, 0.6)",
    icon: "🏏",
  },
  TOSS_WIN: {
    title: "TOSS UPDATE",
    subtitle: "DECISION ANNOUNCED",
    bgGradient: "linear-gradient(135deg, #1c1917 0%, #44403c 50%, #0c0a09 100%)",
    borderGradient: "#fbbf24",
    textColor: "#ffffff",
    glowColor: "rgba(251, 191, 36, 0.5)",
    icon: "🪙",
  },
  MATCH_WON: {
    title: "MATCH WON!",
    subtitle: "CHAMPIONS · VICTORY ACHIEVED",
    bgGradient: "linear-gradient(135deg, #78350f 0%, #d97706 50%, #451a03 100%)",
    borderGradient: "#fbbf24",
    textColor: "#ffffff",
    glowColor: "rgba(245, 158, 11, 0.9)",
    icon: "🏆",
  },
};

/**
 * Component 4: Real-time Scoring Animations (Come-and-Go Event Alerts)
 * Triggered on scorer actions:
 * - FOUR, SIX, SUPERBALL, SUPER OVER, NO BALL, FREE HIT, WIDE, WICKET, NEW BATSMAN, TOSS WIN
 */
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
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <AnimatePresence mode="wait">
        {flash && token && config ? (
          <motion.div
            key={token}
            initial={{ opacity: 0, scale: 0.6, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 24,
            }}
            className="relative flex flex-col items-center overflow-hidden rounded-2xl border-2 px-12 py-5 shadow-2xl"
            style={{
              background: config.bgGradient,
              borderColor: config.borderGradient,
              boxShadow: `0 20px 60px ${config.glowColor}, 0 0 40px ${config.glowColor}`,
              fontFamily: "'Barlow Condensed', 'Space Grotesk', sans-serif",
            }}
          >
            {/* Top speedline shine */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />

            <div className="relative flex items-center gap-4">
              <span className="text-4xl drop-shadow">{config.icon}</span>
              <div className="flex flex-col items-center">
                <span
                  className="text-5xl font-black italic tracking-wider text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]"
                  style={{ letterSpacing: "0.1em" }}
                >
                  {config.title}
                </span>
                <span className="text-sm font-black uppercase tracking-[0.24em] text-amber-300 drop-shadow">
                  {detail ? detail.toUpperCase() : config.subtitle}
                </span>
              </div>
              <span className="text-4xl drop-shadow">{config.icon}</span>
            </div>

            {/* Bottom BidWar watermark pill */}
            <div className="mt-2 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-0.5 text-[9px] font-black tracking-widest text-white/70">
              <span>BIDWAR</span>
              <span>·</span>
              <span>MOMENTUM</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
