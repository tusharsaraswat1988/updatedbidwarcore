import { memo, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, Clock } from "lucide-react";

interface BreakCountdownOverlayProps {
  type: "break" | "pre-auction";
  endsAt: string;
  message: string | null;
  tournamentName: string | null | undefined;
  /** compact — slim banner instead of full-screen overlay (OBS / tablet views). */
  compact?: boolean;
  /** Where the compact banner anchors; default top. */
  compactPlacement?: "top" | "bottom";
  /** Pixels from the bottom edge when compactPlacement is bottom. */
  compactBottomOffset?: number;
}

function useCountdown(endsAt: string) {
  const [msLeft, setMsLeft] = useState(() => Math.max(0, new Date(endsAt).getTime() - Date.now()));

  useEffect(() => {
    setMsLeft(Math.max(0, new Date(endsAt).getTime() - Date.now()));
    const id = setInterval(() => {
      const remaining = new Date(endsAt).getTime() - Date.now();
      setMsLeft(Math.max(0, remaining));
    }, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const totalSecs = Math.ceil(msLeft / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const expired = msLeft <= 0;

  return { hours, mins, secs, totalSecs, expired };
}

function DigitBlock({ value, label }: { value: number; label: string }) {
  const str = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-36 md:w-44 md:h-48 lg:w-52 lg:h-56">
        {/* Background card */}
        <div className="absolute inset-0 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-sm" />
        {/* Center divider line */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-black/40 z-10" />
        {/* Digit */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.span
              key={str}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              className="text-7xl md:text-8xl lg:text-9xl font-display font-black text-white tabular-nums leading-none"
            >
              {str}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
      <span className="mt-3 text-xs md:text-sm font-bold uppercase tracking-[0.25em] text-white/50">
        {label}
      </span>
    </div>
  );
}

function Colon() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setVisible(v => !v), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      className="text-5xl md:text-7xl lg:text-8xl font-black text-white/60 mb-8 select-none transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0.15 }}
    >
      :
    </span>
  );
}

export const BreakCountdownOverlay = memo(function BreakCountdownOverlay({
  type,
  endsAt,
  message,
  tournamentName,
  compact = false,
  compactPlacement = "top",
  compactBottomOffset = 0,
}: BreakCountdownOverlayProps) {
  const { hours, mins, secs, expired } = useCountdown(endsAt);
  const showHours = hours > 0;

  // Show a short post-expiry notification on all displays before dismissing.
  const [showBanner, setShowBanner] = useState(true);
  useEffect(() => {
    if (!expired) return;
    setShowBanner(true);
    const id = setTimeout(() => setShowBanner(false), 4000);
    return () => clearTimeout(id);
  }, [expired, type]);

  // Reset dismiss state when countdown is restarted (new endsAt received)
  useEffect(() => {
    setShowBanner(true);
  }, [endsAt]);

  const isBreak = type === "break";
  const defaultLabel = isBreak ? "Back soon" : "Auction starts in";
  const displayLabel = message || defaultLabel;
  const Icon = isBreak ? Coffee : Clock;

  // Last-10-seconds urgency pulse for break timers only
  const isUrgent = isBreak && !expired && (hours === 0 && mins === 0 && secs <= 10);

  const iconColor = isBreak ? (isUrgent ? "text-red-400" : "text-amber-400") : "text-primary";
  const accentColor = isBreak
    ? (isUrgent ? "from-red-500/40 via-red-600/20" : "from-amber-500/30 via-orange-500/20")
    : "from-primary/30 via-yellow-500/20";
  const borderColor = isBreak ? (isUrgent ? "border-red-500/40" : "border-amber-500/20") : "border-primary/20";

  const visible = !expired || showBanner;

  // ── Compact banner (OBS lower strip / tablet views) ───────────────────────
  if (compact) {
    const mmss = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    const bannerText = expired
      ? (isBreak ? "We're back!" : `${tournamentName || "Auction"} has officially started!`)
      : (message || defaultLabel);
    const isBottom = compactPlacement === "bottom";
    return (
      <AnimatePresence>
        {visible && (
          <motion.div
            key="compact-banner"
            initial={{ opacity: 0, y: isBottom ? 20 : -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: isBottom ? 20 : -16 }}
            transition={{ duration: 0.3 }}
            className={`absolute inset-x-0 z-40 pointer-events-none ${isBottom ? "" : "top-0"}`}
            style={isBottom ? { bottom: compactBottomOffset } : undefined}
          >
            <div
              className={
                isBottom
                  ? `flex items-center gap-4 px-8 py-3.5 border-t-2 ${borderColor} bg-black/88 backdrop-blur-md shadow-[0_-8px_32px_rgba(0,0,0,0.45)]`
                  : `mx-4 mt-3 flex items-center gap-3 px-4 py-3 rounded-2xl border ${borderColor} bg-black/80 backdrop-blur-sm shadow-lg`
              }
            >
              <Icon className={`${isBottom ? "w-5 h-5" : "w-4 h-4"} flex-shrink-0 ${iconColor}`} />
              <span className={`flex-1 font-semibold text-white/90 truncate ${isBottom ? "text-base uppercase tracking-wider" : "text-sm"}`}>
                {isBreak && !expired ? "☕ Auction Break — " : ""}{bannerText}
              </span>
              {!expired && (
                <span className={`font-display font-black tabular-nums ${iconColor} ${isBottom ? "text-2xl tracking-wider" : "text-sm"}`}>
                  {mmss}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ── Full-screen overlay (LED display / liveviewer) ────────────────────────
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 flex flex-col items-center justify-center z-40 overflow-hidden"
        >
          {/* Background gradient — pulses red in the last 10 seconds of a break */}
          <div className={`absolute inset-0 bg-gradient-to-b ${accentColor} to-transparent pointer-events-none ${isUrgent ? "animate-pulse" : ""}`} />
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative flex flex-col items-center gap-6 px-8 text-center"
          >
            {/* Icon + label */}
            <div className={`flex items-center gap-3 px-5 py-2.5 rounded-full border ${borderColor} bg-black/40 backdrop-blur-sm`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
              <span className="text-white/80 text-sm md:text-base font-semibold uppercase tracking-widest">
                {displayLabel}
              </span>
            </div>

            {/* Countdown digits */}
            <AnimatePresence mode="wait">
              {expired ? (
                <motion.div
                  key="expired"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-3"
                >
                  <span className="text-4xl md:text-6xl font-display font-black text-white leading-tight">
                    {isBreak
                      ? "We're back!"
                      : `${tournamentName || "Auction"} has now officially started!`}
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="digits"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-end gap-3 md:gap-5"
                >
                  {showHours && (
                    <>
                      <DigitBlock value={hours} label="Hours" />
                      <Colon />
                    </>
                  )}
                  <DigitBlock value={mins} label="Minutes" />
                  <Colon />
                  <DigitBlock value={secs} label="Seconds" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tournament name (shown during countdown, not after expiry) */}
            {tournamentName && !expired && (
              <p className="text-white/40 text-sm md:text-base font-medium tracking-wider uppercase mt-2">
                {tournamentName}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
