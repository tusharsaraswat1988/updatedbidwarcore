import { memo, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, Pause } from "lucide-react";

export type AuctionStatusOverlayMode = "paused" | "break";

function useMmSsCountdown(endsAt: string | null | undefined) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!endsAt) {
      setLabel(null);
      return;
    }
    const tick = () => {
      const secs = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
      const mins = Math.floor(secs / 60);
      const rem = secs % 60;
      setLabel(secs > 0 ? `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}` : null);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  return label;
}

/**
 * Shared pause / break banner for LED, Live Viewer, and OBS.
 * Sits over the main content area — header, sponsor carousel, and ticker stay visible.
 */
export const AuctionStatusOverlay = memo(function AuctionStatusOverlay({
  mode,
  breakEndsAt,
  breakMessage,
  className = "",
}: {
  mode: AuctionStatusOverlayMode;
  breakEndsAt?: string | null;
  breakMessage?: string | null;
  className?: string;
}) {
  const isBreak = mode === "break";
  const countdown = useMmSsCountdown(isBreak ? breakEndsAt : null);

  const Icon = isBreak ? Coffee : Pause;
  const title = isBreak ? "☕ AUCTION BREAK" : "⏸ AUCTION PAUSED";
  const subtitle = isBreak
    ? (breakMessage?.trim() || "Auction will resume shortly")
    : "Bidding Temporarily Stopped";

  const accentBorder = isBreak ? "border-orange-500/45" : "border-yellow-500/45";
  const accentGlow = isBreak
    ? "from-orange-600/25 via-amber-500/15 to-transparent"
    : "from-yellow-500/25 via-amber-400/15 to-transparent";
  const iconColor = isBreak ? "text-orange-400" : "text-yellow-400";
  const titleColor = isBreak ? "text-orange-100" : "text-yellow-100";
  const ringColor = isBreak ? "shadow-orange-500/20" : "shadow-yellow-500/20";

  return (
    <AnimatePresence>
      <motion.div
        key={mode}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className={`absolute inset-0 z-30 flex items-center justify-center pointer-events-none ${className}`}
        aria-live="polite"
        role="status"
      >
        <div className={`absolute inset-0 bg-gradient-to-b ${accentGlow} to-black/20`} />
        <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -8 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={`relative flex flex-col items-center gap-3 px-8 py-7 md:px-12 md:py-9 rounded-3xl border-2 ${accentBorder} bg-black/70 backdrop-blur-md shadow-2xl ${ringColor} max-w-[92%] text-center`}
        >
          <div className={`flex items-center justify-center w-14 h-14 rounded-2xl border ${accentBorder} bg-black/50`}>
            <Icon className={`w-7 h-7 ${iconColor}`} strokeWidth={2.5} />
          </div>

          <h2 className={`font-display font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-tight uppercase ${titleColor}`}>
            {title}
          </h2>

          <p className="text-sm md:text-base lg:text-lg text-white/70 font-medium max-w-md">
            {subtitle}
          </p>

          {isBreak && countdown && (
            <p className={`font-display font-black text-3xl md:text-4xl tabular-nums tracking-wider ${iconColor}`}>
              {countdown}
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});
