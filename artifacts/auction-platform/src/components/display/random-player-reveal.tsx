import { memo, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Shuffle, Sparkles, User, Crosshair } from "lucide-react";
import type { LedPlayer } from "@/lib/led-view/types";
import { formatINR } from "@/lib/led-view/format-inr";
import type { AuctionUnit } from "@workspace/api-base/auction-unit";
import { hasUsablePortrait } from "@/lib/led-view/player-gender";
import { cldUrl } from "@/lib/cloudinary";

export type RevealDurations = {
  movementMs: number;
  focusLockMs: number;
  finalRevealMs: number;
  totalMs: number;
};

/**
 * Returns dynamic reveal phase durations based on eligible player pool size.
 *
 * Suggested timing policy:
 * - 1–5 players:   Movement 4.0s, Focus 1.0s, Reveal 1.0s (Total: 6.0s)
 * - 6–15 players:  Movement 3.5s, Focus 1.0s, Reveal 1.0s (Total: 5.5s)
 * - 16–40 players: Movement 3.0s, Focus 1.0s, Reveal 1.0s (Total: 5.0s)
 * - 41–100 players: Movement 3.5s, Focus 1.0s, Reveal 1.0s (Total: 5.5s)
 * - 101–250 players: Movement 4.0s, Focus 1.0s, Reveal 1.0s (Total: 6.0s)
 * - 251+ players:  Movement 4.5s, Focus 1.0s, Reveal 1.0s (Total: 6.5s)
 */
export function getRevealDurations(eligibleCount: number): RevealDurations {
  let movementMs = 3500;
  if (eligibleCount <= 5) {
    movementMs = 4000;
  } else if (eligibleCount <= 15) {
    movementMs = 3500;
  } else if (eligibleCount <= 40) {
    movementMs = 3000;
  } else if (eligibleCount <= 100) {
    movementMs = 3500;
  } else if (eligibleCount <= 250) {
    movementMs = 4000;
  } else {
    movementMs = 4500;
  }

  const focusLockMs = 1000;
  const finalRevealMs = 1000;

  return {
    movementMs,
    focusLockMs,
    finalRevealMs,
    totalMs: movementMs + focusLockMs + finalRevealMs,
  };
}

export const MAX_REVEAL_DURATION_MS = 6500;
export const MAX_REVEAL_WINDOW_MS = 7500;

// Default constants for backward compatibility (based on default ~20 candidates)
const defaultDurations = getRevealDurations(20);
export const REVEAL_PHASE_A_MS = defaultDurations.movementMs; // 3000
export const REVEAL_PHASE_B_MS = defaultDurations.focusLockMs; // 1000
export const REVEAL_PHASE_C_MS = defaultDurations.finalRevealMs; // 1000
export const REVEAL_TOTAL_DURATION_MS = defaultDurations.totalMs; // 5000

export type RevealDisplayStrip = {
  cards: LedPlayer[];
  targetIndex: number;
};

/**
 * Builds candidate stream strip:
 * - Only real eligible tournament players (status === "queue") are used.
 * - Ineligible players (sold, unsold, retained) are strictly excluded.
 * - For small pools (1-5 candidates): repeats eligible cards cyclically across the track
 *   with subtle variation so movement remains lively, full, and suspenseful.
 * - For larger pools: samples a bounded visual subset (21 cards) avoiding heavy DOM overhead.
 * - The backend-selected player is placed exactly at the center index (targetIndex) so deceleration
 *   locks squarely on the target.
 */
export function buildRevealDisplayStrip(
  selectedPlayer: LedPlayer,
  candidatePool: LedPlayer[],
  trackHalfWidth = 10,
): RevealDisplayStrip {
  const eligibleOnly = candidatePool.filter(
    (p) => p.status === "queue" && String(p.id) !== String(selectedPlayer.id),
  );

  const totalCards = trackHalfWidth * 2 + 1;
  const targetIndex = trackHalfWidth;

  if (eligibleOnly.length === 0) {
    // Single-player pool: repeat selected player across the track
    return {
      cards: Array.from({ length: totalCards }, () => selectedPlayer),
      targetIndex,
    };
  }

  const leftCards: LedPlayer[] = [];
  for (let i = 0; i < trackHalfWidth; i++) {
    const idx = (trackHalfWidth - 1 - i) % eligibleOnly.length;
    leftCards.unshift(eligibleOnly[idx]);
  }

  const rightCards: LedPlayer[] = [];
  for (let i = 0; i < trackHalfWidth; i++) {
    const idx = i % eligibleOnly.length;
    rightCards.push(eligibleOnly[idx]);
  }

  return {
    cards: [...leftCards, selectedPlayer, ...rightCards],
    targetIndex,
  };
}

export type RandomPlayerRevealProps = {
  selectedPlayer: LedPlayer;
  candidatePool: LedPlayer[];
  roleLabel?: string;
  auctionUnit?: AuctionUnit;
  tournamentName?: string;
  startedAt?: number;
  onComplete: () => void;
  sport?: string;
};

export const RandomPlayerReveal = memo(function RandomPlayerReveal({
  selectedPlayer,
  candidatePool,
  roleLabel = "Player",
  auctionUnit = "points",
  tournamentName = "Auction",
  startedAt,
  onComplete,
  sport = "cricket",
}: RandomPlayerRevealProps) {
  const shouldReduceMotion = useReducedMotion();
  const baseTimeRef = useRef(startedAt ?? Date.now());
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Determine eligible candidate count and dynamic durations
  const eligibleCandidates = useMemo(() => {
    return candidatePool.filter(
      (p) => p.status === "queue" && String(p.id) !== String(selectedPlayer.id),
    );
  }, [candidatePool, selectedPlayer.id]);

  const totalEligibleCount = eligibleCandidates.length + 1;
  const durations = useMemo(() => getRevealDurations(totalEligibleCount), [totalEligibleCount]);

  // Derived phase state
  const [phase, setPhase] = useState<"A" | "B" | "C">(() => {
    const elapsed = Date.now() - baseTimeRef.current;
    if (elapsed >= durations.movementMs + durations.focusLockMs) return "C";
    if (elapsed >= durations.movementMs) return "B";
    return "A";
  });

  const [hasPhotoFailed, setHasPhotoFailed] = useState(false);

  // If already expired at mount time, complete immediately
  useEffect(() => {
    const elapsed = Date.now() - baseTimeRef.current;
    if (elapsed >= durations.totalMs) {
      onCompleteRef.current();
      return;
    }

    if (shouldReduceMotion) {
      // Gentle 800ms reveal for users who prefer reduced motion
      const timer = setTimeout(() => {
        onCompleteRef.current();
      }, 800);
      return () => clearTimeout(timer);
    }

    // Schedule phase transitions based on authoritative startedAt
    const timeToPhaseB = Math.max(0, durations.movementMs - elapsed);
    const timeToPhaseC = Math.max(0, durations.movementMs + durations.focusLockMs - elapsed);
    const timeToComplete = Math.max(0, durations.totalMs - elapsed);

    const timerB = setTimeout(() => setPhase("B"), timeToPhaseB);
    const timerC = setTimeout(() => setPhase("C"), timeToPhaseC);
    const timerEnd = setTimeout(() => onCompleteRef.current(), timeToComplete);

    return () => {
      clearTimeout(timerB);
      clearTimeout(timerC);
      clearTimeout(timerEnd);
    };
  }, [shouldReduceMotion, durations]);

  // Build the candidate stream strip: real eligible tournament players only
  const displayStrip = useMemo(() => {
    return buildRevealDisplayStrip(selectedPlayer, candidatePool, 10);
  }, [candidatePool, selectedPlayer]);

  const showHeroPhoto =
    hasUsablePortrait(selectedPlayer.portrait) && !hasPhotoFailed;

  // -------------------------------------------------------------
  // REDUCED MOTION PRESENTATION
  // -------------------------------------------------------------
  if (shouldReduceMotion) {
    return (
      <div
        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#07090E] text-white font-['Barlow_Condensed'] p-6"
        role="region"
        aria-label="Random player selected"
      >
        <div className="text-center max-w-md w-full border-2 border-yellow-400 bg-black/90 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center justify-center gap-2 text-yellow-400 text-xs font-bold uppercase tracking-widest mb-3">
            <Shuffle className="w-4 h-4" />
            <span>Random Player Selected</span>
          </div>
          <div className="text-3xl font-black uppercase text-white mb-1">
            {selectedPlayer.name}
          </div>
          <p className="text-sm font-semibold text-yellow-300 uppercase tracking-wider mb-2">
            #{selectedPlayer.serialNo} • {selectedPlayer.roleRaw || roleLabel}
            {selectedPlayer.city ? ` • ${selectedPlayer.city}` : ""}
          </p>
          <div className="text-lg font-mono font-bold text-emerald-400">
            Base Price: {formatINR(selectedPlayer.basePrice, auctionUnit)}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // FULL BROADCAST REVEAL ANIMATION
  // -------------------------------------------------------------
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3, ease: "easeOut" } }}
      className="absolute inset-0 z-50 overflow-hidden flex flex-col justify-between bg-[#06080D] text-white select-none pointer-events-none font-['Barlow_Condensed']"
      data-testid="random-player-reveal"
      role="region"
      aria-label="Random Player Selection in Progress"
    >
      {/* Stadium Ambient Lighting & Spotlight Cones */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 mix-blend-screen"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 20%, rgba(234, 179, 8, 0.25) 0%, transparent 70%), radial-gradient(circle at 50% 80%, rgba(234, 179, 8, 0.12) 0%, transparent 60%)",
        }}
      />

      {/* Top Angled Stadium Floodlights */}
      <div
        className="absolute -top-32 -left-20 w-96 h-96 pointer-events-none opacity-30 rotate-45"
        style={{
          background: "linear-gradient(135deg, rgba(250, 204, 21, 0.4) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="absolute -top-32 -right-20 w-96 h-96 pointer-events-none opacity-30 -rotate-45"
        style={{
          background: "linear-gradient(225deg, rgba(250, 204, 21, 0.4) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* ── TOP BROADCAST BANNER ── */}
      <header className="relative z-20 flex items-center justify-between px-8 py-4 border-b border-yellow-400/20 bg-black/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-yellow-400 text-black flex items-center justify-center font-black shadow-[0_0_15px_rgba(234,179,8,0.5)]">
            <Shuffle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-extrabold tracking-[0.25em] text-yellow-400 uppercase leading-none mb-1">
              BIDWAR BROADCAST • LIVE DRAW
            </div>
            <div className="text-xl sm:text-2xl font-black tracking-wider uppercase text-white leading-none">
              {tournamentName}
            </div>
          </div>
        </div>

        {/* Phase Status Pill */}
        <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-yellow-400/40 bg-yellow-500/10">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-ping" />
          <span className="text-xs sm:text-sm font-black tracking-widest text-yellow-300 uppercase">
            {phase === "A" && "SAMPLING ELIGIBLE POOL"}
            {phase === "B" && "CONVERGING & FOCUS LOCK"}
            {phase === "C" && "OFFICIAL SELECTION LOCKED"}
          </span>
        </div>
      </header>

      {/* ── CENTER STAGE ── */}
      <main className="relative flex-1 flex items-center justify-center w-full px-4 overflow-hidden">
        {/* Phase A & B: Horizontal Carousel Stream */}
        {phase !== "C" ? (
          <div className="relative w-full max-w-6xl flex items-center justify-center [perspective:1000px]">
            {/* Center Focus Reticle & Gold Scanning Beam */}
            <div className="absolute inset-y-0 w-64 border-x-2 border-yellow-400/60 bg-yellow-400/[0.04] pointer-events-none z-30 flex flex-col justify-between items-center py-2 shadow-[0_0_40px_rgba(234,179,8,0.25)]">
              <div className="flex items-center gap-1.5 text-yellow-400 text-[10px] font-bold tracking-widest uppercase">
                <Crosshair className="w-3.5 h-3.5 animate-spin" />
                <span>SELECTION TARGET</span>
              </div>
              {/* Vertical laser focus sweep */}
              <div
                className="w-full h-0.5 bg-gradient-to-r from-transparent via-yellow-300 to-transparent shadow-[0_0_12px_#FACC15]"
                style={{
                  animation: "scanline 1.2s ease-in-out infinite alternate",
                }}
              />
              <div className="text-yellow-400/80 text-[9px] font-mono tracking-wider">
                {phase === "B" ? "TARGET LOCKED" : "LOCKING TARGET"}
              </div>
            </div>

            {/* Horizontal Stream Cards */}
            <motion.div
              className="flex items-center gap-5 z-10"
              initial={{ x: 1600 }}
              animate={
                phase === "A"
                  ? {
                      x: [1600, 400],
                      transition: {
                        duration: durations.movementMs / 1000,
                        ease: "linear",
                      },
                    }
                  : {
                      x: 0,
                      transition: {
                        duration: durations.focusLockMs / 1000,
                        ease: [0.12, 0.8, 0.32, 1],
                      },
                    }
              }
            >
              {displayStrip.cards.map((player, idx) => {
                const isTarget = idx === displayStrip.targetIndex;
                const hasPhoto = hasUsablePortrait(player.portrait);
                // Subtle rotation variation across cards to prevent mechanical look
                const subtleRotate = isTarget && phase === "B" ? 0 : ((idx % 3) - 1) * 0.7;

                return (
                  <div
                    key={`${player.id}-${idx}`}
                    style={{ transform: `rotate(${subtleRotate}deg)` }}
                    className={`relative w-48 sm:w-56 h-72 sm:h-80 rounded-xl overflow-hidden border-2 transition-all flex flex-col justify-between p-3 shrink-0 ${
                      isTarget && phase === "B"
                        ? "border-yellow-400 bg-yellow-950/40 shadow-[0_0_35px_rgba(234,179,8,0.6)] scale-105 z-20"
                        : "border-white/15 bg-black/70 opacity-65 scale-95"
                    }`}
                  >
                    {/* Background photo / avatar */}
                    {hasPhoto ? (
                      <img
                        src={cldUrl(player.portrait, "playerCard")}
                        alt={player.name}
                        className="absolute inset-0 w-full h-full object-cover object-center opacity-70"
                        loading="eager"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <User className="w-16 h-16 text-white/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60" />

                    {/* Top Serial Badge */}
                    <div className="relative z-10 flex justify-between items-start">
                      <span className="px-2 py-0.5 rounded bg-yellow-400 text-black font-['Bebas_Neue'] text-sm tracking-wider">
                        #{player.serialNo}
                      </span>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/60">
                        {sport.toUpperCase()}
                      </span>
                    </div>

                    {/* Bottom Identity */}
                    <div className="relative z-10">
                      <div className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider truncate">
                        {player.roleRaw || roleLabel}
                      </div>
                      <div className="text-lg font-black text-white uppercase tracking-tight line-clamp-1">
                        {player.name}
                      </div>
                      {player.city ? (
                        <div className="text-[10px] text-white/50 tracking-wider truncate">
                          {player.city}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </div>
        ) : (
          /* Phase C: Grand Golden Hero Reveal */
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex flex-col md:flex-row items-center gap-8 max-w-4xl w-full p-6 sm:p-8 rounded-2xl border-2 border-yellow-400 bg-gradient-to-br from-black via-yellow-950/40 to-black shadow-[0_0_80px_rgba(234,179,8,0.45)] backdrop-blur-xl z-30"
          >
            {/* Impact Flash Wave */}
            <motion.div
              initial={{ opacity: 0.8, scale: 0.8 }}
              animate={{ opacity: 0, scale: 1.4 }}
              transition={{ duration: 0.65, ease: "easeOut" }}
              className="absolute inset-0 rounded-2xl border-4 border-yellow-300 pointer-events-none"
            />

            {/* Left Hero Portrait Frame */}
            <div className="relative w-44 sm:w-56 md:w-64 h-60 sm:h-72 md:h-84 shrink-0 rounded-xl overflow-hidden border-2 border-yellow-400/80 bg-black shadow-[0_0_35px_rgba(234,179,8,0.35)] flex items-center justify-center">
              {showHeroPhoto ? (
                <img
                  src={cldUrl(selectedPlayer.portrait, "playerCard")}
                  alt={selectedPlayer.name}
                  className="w-full h-full object-cover object-center"
                  loading="eager"
                  onError={() => setHasPhotoFailed(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-white/10 to-black/80">
                  <User className="w-20 h-20 text-white/30 mb-2" />
                  <span className="text-xs text-white/40 uppercase tracking-widest">No Photograph</span>
                </div>
              )}

              {/* Gold Top Edge Glow */}
              <div className="absolute top-0 inset-x-0 h-1 bg-yellow-400 shadow-[0_0_15px_#FACC15]" />

              {/* Big Serial Number Badge */}
              <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded bg-yellow-400 text-black font-['Bebas_Neue'] text-xl tracking-wider shadow-lg">
                #{selectedPlayer.serialNo}
              </div>
            </div>

            {/* Right Hero Details */}
            <div className="flex-1 flex flex-col justify-center min-w-0 text-center md:text-left">
              {/* Category & Role Tag */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-yellow-400/20 border border-yellow-400/50 text-yellow-300 text-xs font-black uppercase tracking-wider">
                  {selectedPlayer.roleRaw || roleLabel}
                </span>
                {selectedPlayer.city ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-semibold tracking-wider uppercase font-mono">
                    {selectedPlayer.city}
                  </span>
                ) : null}
                {selectedPlayer.age ? (
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-xs font-mono">
                    Age {selectedPlayer.age}
                  </span>
                ) : null}
              </div>

              {/* Player Name */}
              <h1
                className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-white leading-none mb-3"
                style={{ textShadow: "0 2px 20px rgba(0,0,0,0.9), 0 0 30px rgba(250,204,21,0.3)" }}
              >
                {selectedPlayer.name}
              </h1>

              {/* Base Price & Auction Prompt */}
              <div className="mt-2 pt-3 border-t border-yellow-400/25 flex flex-wrap items-center justify-center md:justify-start gap-4">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-white/45">
                    STARTING BASE PRICE
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-400 tabular-nums leading-none">
                    {formatINR(selectedPlayer.basePrice, auctionUnit)}
                  </div>
                </div>

                <div className="px-3.5 py-1.5 rounded-lg bg-yellow-400 text-black font-black text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(234,179,8,0.4)] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>BIDDING READY</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* ── BOTTOM TICKER ── */}
      <footer className="relative z-20 px-8 py-2.5 border-t border-white/10 bg-black/60 backdrop-blur-md flex items-center justify-between text-xs text-white/60">
        <div className="flex items-center gap-2 font-mono">
          <span className="text-yellow-400 font-bold">ELIGIBLE POOL:</span>
          <span>{totalEligibleCount} PLAYERS</span>
          <span className="text-white/20">•</span>
          <span className="text-emerald-400 font-bold">MODE:</span>
          <span>CERTIFIED RANDOM DRAW</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 font-bold tracking-widest text-white/40 uppercase text-[10px]">
          <span>BidWar Live Tournament Engine</span>
        </div>
      </footer>
    </motion.div>
  );
});
