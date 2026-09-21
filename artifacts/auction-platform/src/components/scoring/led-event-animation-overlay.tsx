import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trophy, Zap, AlertTriangle, Flame, ShieldAlert, Award } from "lucide-react";

export type LedMatchEvent =
  | { type: "FOUR"; runs?: number; batsmanName?: string }
  | { type: "SIX"; runs?: number; batsmanName?: string }
  | { type: "WICKET"; dismissal?: string; batsmanName?: string; bowlerName?: string }
  | { type: "WIDE"; runs?: number }
  | { type: "NO_BALL" }
  | { type: "FREE_HIT" }
  | { type: "SUPER_BALL"; battingTeam?: string }
  | { type: "SUPER_OVER" }
  | {
      type: "INNINGS_COMPLETE";
      innings: number;
      runs: number;
      wickets: number;
      overs: string;
      target?: number | null;
      battingTeam?: string;
    }
  | { type: "MATCH_RESULT"; winnerName: string; marginText?: string }
  | { type: "TOSS_WIN"; teamName: string; electedTo: "bat" | "bowl" }
  | { type: "BOWLER_CHANGE"; bowlerName: string; figures?: string }
  | { type: "NEW_BATSMAN"; batsmanName: string; role?: string };

type LedEventAnimationOverlayProps = {
  currentEvent: LedMatchEvent | null;
  onDismiss?: () => void;
  /** Auto dismiss duration in milliseconds (default: 4000ms, 0 to keep persistent like innings break) */
  autoDismissMs?: number;
};

export function LedEventAnimationOverlay({
  currentEvent,
  onDismiss,
  autoDismissMs = 4200,
}: LedEventAnimationOverlayProps) {
  useEffect(() => {
    if (!currentEvent) return;

    // Persistent screens that require manual dismiss or match state shift
    if (currentEvent.type === "INNINGS_COMPLETE" || currentEvent.type === "MATCH_RESULT") {
      return;
    }

    const duration =
      currentEvent.type === "SIX" || currentEvent.type === "WICKET"
        ? 4500
        : currentEvent.type === "TOSS_WIN"
        ? 5000
        : autoDismissMs;

    const timer = setTimeout(() => {
      onDismiss?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [currentEvent, onDismiss, autoDismissMs]);

  if (!currentEvent) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentEvent.type + JSON.stringify(currentEvent)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.28 }}
        className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden bg-black/85 backdrop-blur-md select-none"
      >
        {/* Background dynamic ambient glow */}
        <div className="absolute inset-0 bg-radial from-transparent to-black/90 pointer-events-none" />

        {/* 1. FOUR ANIMATION */}
        {currentEvent.type === "FOUR" && (
          <div className="relative flex flex-col items-center justify-center text-center px-6">
            <motion.div
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: [0, 1.18, 1], rotate: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="absolute -inset-10 rounded-full bg-emerald-500/25 blur-3xl animate-pulse" />
              <div className="flex items-center justify-center w-48 h-48 sm:w-60 sm:h-60 rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-800 border-4 border-emerald-300 shadow-[0_0_80px_rgba(16,185,129,0.7)]">
                <span className="text-9xl sm:text-[11rem] font-black font-mono text-white tracking-tighter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
                  4
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="mt-8 space-y-2"
            >
              <h2 className="text-4xl sm:text-6xl font-black uppercase tracking-[0.25em] text-emerald-300 drop-shadow-[0_4px_12px_rgba(16,185,129,0.8)]">
                BOUNDARY FOUR!
              </h2>
              {currentEvent.batsmanName && (
                <p className="text-xl sm:text-2xl font-bold uppercase tracking-widest text-white/90">
                  {currentEvent.batsmanName} finds the rope!
                </p>
              )}
            </motion.div>
          </div>
        )}

        {/* 2. SIX ANIMATION */}
        {currentEvent.type === "SIX" && (
          <div className="relative flex flex-col items-center justify-center text-center px-6">
            <motion.div
              initial={{ scale: 0, y: 60 }}
              animate={{ scale: [0, 1.25, 1], y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="absolute -inset-16 rounded-full bg-amber-500/35 blur-3xl animate-pulse" />
              <div className="flex items-center justify-center w-52 h-52 sm:w-68 sm:h-68 rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 border-4 border-yellow-200 shadow-[0_0_100px_rgba(245,158,11,0.85)]">
                <span className="text-9xl sm:text-[12rem] font-black font-mono text-black tracking-tighter drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)]">
                  6
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="mt-8 space-y-2"
            >
              <h2 className="text-5xl sm:text-7xl font-black uppercase tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 drop-shadow-[0_0_30px_rgba(251,191,36,0.9)]">
                MAXIMUM SIX!
              </h2>
              <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-amber-500/20 border border-amber-400/40 backdrop-blur-md">
                <Zap className="w-5 h-5 text-yellow-300 animate-bounce" />
                <span className="text-lg sm:text-2xl font-black uppercase tracking-wider text-yellow-200">
                  OUT OF THE STADIUM!
                </span>
              </div>
              {currentEvent.batsmanName && (
                <p className="text-xl sm:text-2xl font-bold uppercase tracking-widest text-white/90">
                  {currentEvent.batsmanName}
                </p>
              )}
            </motion.div>
          </div>
        )}

        {/* 3. WICKET ANIMATION */}
        {currentEvent.type === "WICKET" && (
          <div className="relative flex flex-col items-center justify-center text-center px-6">
            <motion.div
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="relative"
            >
              <div className="absolute -inset-14 rounded-full bg-red-600/40 blur-3xl animate-pulse" />
              <div className="px-10 py-6 sm:px-16 sm:py-8 rounded-3xl bg-gradient-to-b from-red-600 to-red-950 border-4 border-red-500 shadow-[0_0_90px_rgba(239,68,68,0.9)]">
                <span className="text-6xl sm:text-8xl md:text-9xl font-black uppercase tracking-widest text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.9)]">
                  WICKET!
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="mt-6 space-y-3"
            >
              <div className="inline-block px-6 py-2 rounded-xl bg-red-950/80 border border-red-700/60 text-red-200 text-xl sm:text-2xl font-black uppercase tracking-widest">
                {currentEvent.dismissal || "OUT!"}
              </div>
              {currentEvent.batsmanName && (
                <p className="text-2xl sm:text-3xl font-extrabold uppercase tracking-wide text-white">
                  Batsman: <span className="text-red-400">{currentEvent.batsmanName}</span>
                </p>
              )}
              {currentEvent.bowlerName && (
                <p className="text-lg sm:text-xl font-semibold uppercase tracking-wider text-muted-foreground">
                  Bowler: {currentEvent.bowlerName}
                </p>
              )}
            </motion.div>
          </div>
        )}

        {/* 4. WIDE ANIMATION */}
        {currentEvent.type === "WIDE" && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center text-center px-6"
          >
            <div className="px-12 py-8 rounded-3xl bg-gradient-to-r from-amber-600 to-yellow-600 border-4 border-amber-300 shadow-[0_0_70px_rgba(245,158,11,0.6)]">
              <span className="text-6xl sm:text-8xl font-black uppercase tracking-widest text-black">
                WIDE BALL
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold uppercase tracking-widest text-amber-300">
              +1 EXTRA RUN · RE-BALL
            </p>
          </motion.div>
        )}

        {/* 5. NO BALL ANIMATION */}
        {currentEvent.type === "NO_BALL" && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center text-center px-6"
          >
            <div className="flex items-center gap-4 px-10 py-7 rounded-3xl bg-gradient-to-r from-red-600 via-amber-600 to-red-700 border-4 border-yellow-400 shadow-[0_0_80px_rgba(239,68,68,0.7)] animate-pulse">
              <AlertTriangle className="w-16 h-16 text-yellow-300 shrink-0" />
              <span className="text-6xl sm:text-8xl font-black uppercase tracking-widest text-white">
                NO BALL!
              </span>
            </div>
            <p className="mt-5 text-2xl sm:text-3xl font-black uppercase tracking-[0.2em] text-yellow-300">
              ⚡ FREE HIT COMING UP ⚡
            </p>
          </motion.div>
        )}

        {/* 6. FREE HIT ANIMATION */}
        {currentEvent.type === "FREE_HIT" && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [0.95, 1.05, 1], opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center text-center px-6"
          >
            <div className="flex items-center gap-4 px-12 py-8 rounded-3xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-700 border-4 border-fuchsia-300 shadow-[0_0_85px_rgba(192,38,211,0.8)]">
              <Flame className="w-16 h-16 text-yellow-300 animate-pulse" />
              <span className="text-6xl sm:text-8xl font-black uppercase tracking-widest text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
                FREE HIT!
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold uppercase tracking-wider text-fuchsia-200">
              CANNOT BE OUT CAUGHT OR BOWLED!
            </p>
          </motion.div>
        )}

        {/* 7. SUPER BALL ANIMATION */}
        {currentEvent.type === "SUPER_BALL" && (
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center text-center px-6"
          >
            <div className="px-12 py-8 rounded-3xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 border-4 border-cyan-300 shadow-[0_0_90px_rgba(6,182,212,0.8)]">
              <span className="text-6xl sm:text-8xl font-black uppercase tracking-widest text-white">
                SUPER BALL!
              </span>
            </div>
            <p className="mt-4 text-2xl sm:text-3xl font-black uppercase tracking-widest text-cyan-300">
              ⭐ DOUBLE RUNS ACTIVATED ⭐
            </p>
            {currentEvent.battingTeam && (
              <p className="mt-2 text-xl font-bold uppercase text-white/90">
                Team: {currentEvent.battingTeam}
              </p>
            )}
          </motion.div>
        )}

        {/* 8. SUPER OVER ANIMATION */}
        {currentEvent.type === "SUPER_OVER" && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="flex flex-col items-center text-center px-6"
          >
            <div className="flex items-center gap-4 px-12 py-8 rounded-3xl bg-gradient-to-r from-red-600 via-amber-500 to-red-600 border-4 border-amber-300 shadow-[0_0_100px_rgba(245,158,11,0.9)]">
              <Zap className="w-16 h-16 text-yellow-200 animate-bounce" />
              <span className="text-6xl sm:text-8xl font-black uppercase tracking-widest text-white">
                SUPER OVER!
              </span>
            </div>
            <p className="mt-5 text-2xl sm:text-3xl font-black uppercase tracking-widest text-amber-300">
              MATCH TIED · THE ULTIMATE SHOWDOWN
            </p>
          </motion.div>
        )}

        {/* 9. INNINGS COMPLETE ANIMATION & SUMMARY CARD */}
        {currentEvent.type === "INNINGS_COMPLETE" && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="w-full max-w-4xl px-6"
          >
            <div className="rounded-3xl bg-card/95 border-2 border-primary/40 p-8 sm:p-12 shadow-[0_0_80px_rgba(0,0,0,0.85)] text-center space-y-6">
              <div className="inline-block px-5 py-2 rounded-full bg-primary/20 border border-primary/40 text-primary font-black uppercase tracking-[0.25em] text-sm sm:text-base">
                Innings {currentEvent.innings} Complete
              </div>

              <div className="space-y-2">
                {currentEvent.battingTeam && (
                  <h3 className="text-2xl sm:text-3xl font-bold uppercase tracking-wider text-muted-foreground">
                    {currentEvent.battingTeam}
                  </h3>
                )}
                <div className="text-7xl sm:text-9xl font-black font-mono text-white tabular-nums tracking-tight">
                  {currentEvent.runs}
                  <span className="text-muted-foreground">/</span>
                  {currentEvent.wickets}
                </div>
                <p className="text-2xl font-mono text-muted-foreground">
                  ({currentEvent.overs} Overs)
                </p>
              </div>

              {currentEvent.target != null && (
                <div className="mt-8 p-5 rounded-2xl bg-primary/15 border border-primary/30">
                  <p className="text-sm font-bold uppercase tracking-widest text-primary/90">
                    Target For 2nd Innings
                  </p>
                  <p className="text-4xl sm:text-5xl font-black font-mono text-primary mt-1">
                    {currentEvent.target} Runs
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* 10. MATCH RESULT ANIMATION */}
        {currentEvent.type === "MATCH_RESULT" && (
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-4xl px-6 text-center space-y-6"
          >
            <div className="relative rounded-3xl bg-gradient-to-b from-card to-background border-4 border-yellow-500/50 p-8 sm:p-14 shadow-[0_0_100px_rgba(234,179,8,0.4)]">
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-yellow-500 to-amber-300 flex items-center justify-center shadow-[0_0_50px_rgba(234,179,8,0.8)]">
                  <Trophy className="w-14 h-14 text-black" />
                </div>
              </div>

              <p className="text-lg sm:text-xl font-black uppercase tracking-[0.3em] text-yellow-400">
                Match Result
              </p>
              <h2 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-wide text-white drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)]">
                {currentEvent.winnerName}
              </h2>
              {currentEvent.marginText && (
                <p className="text-2xl sm:text-3xl font-extrabold uppercase tracking-widest text-yellow-300/90 mt-2">
                  {currentEvent.marginText}
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* 11. TOSS WINNING ANIMATION */}
        {currentEvent.type === "TOSS_WIN" && (
          <motion.div
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center text-center px-6"
          >
            <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-yellow-400 via-amber-200 to-yellow-500 border-4 border-yellow-100 flex items-center justify-center shadow-[0_0_60px_rgba(245,158,11,0.8)] mb-6 animate-spin">
              <Award className="w-14 h-14 text-black" />
            </div>
            <div className="px-10 py-6 rounded-2xl bg-card/90 border border-border shadow-2xl space-y-2">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-muted-foreground">
                Toss Update
              </p>
              <h3 className="text-3xl sm:text-5xl font-black uppercase text-white">
                {currentEvent.teamName}
              </h3>
              <p className="text-xl sm:text-2xl font-bold uppercase text-primary tracking-wider">
                Won the toss & elected to {currentEvent.electedTo.toUpperCase()}
              </p>
            </div>
          </motion.div>
        )}

        {/* 12. BOWLER CHANGE / NEW BATSMAN BANNER */}
        {(currentEvent.type === "BOWLER_CHANGE" || currentEvent.type === "NEW_BATSMAN") && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute bottom-16 left-8 sm:left-14 max-w-lg rounded-2xl bg-card/95 border-2 border-primary/50 p-6 shadow-2xl flex items-center gap-5"
          >
            <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {currentEvent.type === "BOWLER_CHANGE" ? "Bowling Change" : "New Batter In"}
              </p>
              <h4 className="text-2xl font-black uppercase text-white">
                {currentEvent.type === "BOWLER_CHANGE"
                  ? currentEvent.bowlerName
                  : currentEvent.batsmanName}
              </h4>
              <p className="text-sm text-primary font-semibold">
                {currentEvent.type === "BOWLER_CHANGE"
                  ? currentEvent.figures || "Right Arm Fast"
                  : currentEvent.role || "Right Handed Batter"}
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
