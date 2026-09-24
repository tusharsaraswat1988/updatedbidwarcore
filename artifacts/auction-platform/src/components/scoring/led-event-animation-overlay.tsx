import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Trophy,
  Zap,
  AlertTriangle,
  Flame,
  ShieldAlert,
  Award,
  Sparkles,
  Swords,
} from "lucide-react";

export type LedMatchEvent =
  | { type: "FOUR"; runs?: number; batsmanName?: string }
  | { type: "SIX"; runs?: number; batsmanName?: string }
  | { type: "WICKET"; dismissal?: string; batsmanName?: string; bowlerName?: string }
  | { type: "WIDE"; runs?: number }
  | { type: "NO_BALL" }
  | { type: "FREE_HIT" }
  | {
      type: "SUPER_BALL";
      battingTeam?: string;
      runsOffBat?: number;
      totalRuns?: number;
      batsmanName?: string;
    }
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
  /** Auto dismiss duration in milliseconds (default: 4200ms) */
  autoDismissMs?: number;
};

/**
 * Real-time 60fps Canvas Particle & Shockwave Engine.
 * Emits stadium sparks, glowing shockwaves, and golden embers for LED displays.
 */
function StadiumParticleCanvas({ eventType }: { eventType: LedMatchEvent["type"] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    // Particle pool
    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      life: number;
      maxLife: number;
      decay: number;
    };

    const particles: Particle[] = [];
    const cx = width / 2;
    const cy = height / 2;

    const colorsMap: Record<string, string[]> = {
      FOUR: ["#10b981", "#34d399", "#6ee7b7", "#fbbf24", "#ffffff"],
      SIX: ["#fbbf24", "#f59e0b", "#d97706", "#fef08a", "#ffffff"],
      WICKET: ["#ef4444", "#dc2626", "#b91c1c", "#f87171", "#ffffff"],
      SUPER_BALL: ["#06b6d4", "#3b82f6", "#a855f7", "#f59e0b", "#ffffff"],
      MATCH_RESULT: ["#f59e0b", "#fbbf24", "#10b981", "#3b82f6", "#ffffff"],
      SUPER_OVER: ["#ef4444", "#f59e0b", "#fbbf24", "#ffffff"],
    };

    const palette = colorsMap[eventType] || ["#fbbf24", "#ffffff", "#06b6d4"];

    // Spawn high-velocity stadium burst particles
    const count = eventType === "SIX" || eventType === "SUPER_BALL" ? 140 : 80;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 12 + 3;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 5 + 2,
        color: palette[Math.floor(Math.random() * palette.length)],
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 45 + 30,
        decay: Math.random() * 0.02 + 0.015,
      });
    }

    // Shockwave expansion rings
    type Shockwave = { r: number; maxR: number; alpha: number; color: string };
    const shockwaves: Shockwave[] = [
      { r: 10, maxR: Math.max(width, height) * 0.6, alpha: 0.9, color: palette[0] },
      { r: 5, maxR: Math.max(width, height) * 0.45, alpha: 0.7, color: palette[1] || "#fff" },
    ];

    let start = performance.now();

    function render(now: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Shockwaves
      shockwaves.forEach((sw) => {
        if (sw.alpha <= 0) return;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, sw.r, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = sw.alpha;
        ctx.lineWidth = 4;
        ctx.shadowColor = sw.color;
        ctx.shadowBlur = 18;
        ctx.stroke();
        ctx.restore();

        sw.r += 12;
        sw.alpha -= 0.022;
      });

      // 2. Draw & Update Sparks
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravity
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
      }

      if (particles.length > 0 || shockwaves.some((s) => s.alpha > 0)) {
        animId = requestAnimationFrame(render);
      }
    }

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(animId);
    };
  }, [eventType]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10 w-full h-full"
    />
  );
}

export function LedEventAnimationOverlay({
  currentEvent,
  onDismiss,
  autoDismissMs = 4200,
}: LedEventAnimationOverlayProps) {
  useEffect(() => {
    if (!currentEvent) return;

    if (currentEvent.type === "INNINGS_COMPLETE" || currentEvent.type === "MATCH_RESULT") {
      return;
    }

    const duration =
      currentEvent.type === "SUPER_BALL"
        ? 5800
        : currentEvent.type === "SIX" || currentEvent.type === "WICKET"
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
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden bg-[#030508]/92 backdrop-blur-xl select-none"
      >
        {/* Real-time Particle Engine */}
        <StadiumParticleCanvas eventType={currentEvent.type} />

        {/* Stadium Background Speed Lines / Carbon Lattice */}
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />

        {/* Dynamic Stadium Anamorphic Flare Beam */}
        <motion.div
          initial={{ x: "-100%", opacity: 0 }}
          animate={{ x: "100%", opacity: [0, 0.85, 0] }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute h-[3px] w-full bg-gradient-to-r from-transparent via-white to-transparent blur-xs pointer-events-none z-20"
        />

        {/* ============================================================
            1. BOUNDARY FOUR (4) - BROADCAST STADIUM GRADE
        ============================================================ */}
        {currentEvent.type === "FOUR" && (
          <div className="relative z-20 flex flex-col items-center justify-center text-center px-4 w-full max-w-6xl">
            {/* Top Chevron Banner */}
            <motion.div
              initial={{ y: -60, scale: 0.8, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3 px-8 py-2 -skew-x-12 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 border-2 border-emerald-300 shadow-[0_0_50px_rgba(16,185,129,0.8)] mb-6"
            >
              <span className="skew-x-12 text-sm sm:text-base font-black uppercase tracking-[0.35em] text-black">
                ▶▶▶ STADIUM BOUNDARY ▶▶▶
              </span>
            </motion.div>

            {/* Giant 3D Metallic Chrome "4" */}
            <motion.div
              initial={{ scale: 3, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="absolute -inset-16 rounded-full bg-emerald-500/30 blur-3xl" />

              {/* Angled Broadcast Wings */}
              <div className="flex items-center justify-center">
                <div className="relative px-12 py-4 sm:px-20 sm:py-6 -skew-x-12 bg-gradient-to-b from-slate-900 via-emerald-950 to-black border-4 border-emerald-400 shadow-[0_0_120px_rgba(16,185,129,0.9)]">
                  <span className="skew-x-12 block text-[10rem] sm:text-[14rem] md:text-[16rem] font-black font-mono leading-none text-transparent bg-clip-text bg-gradient-to-b from-white via-emerald-200 to-emerald-500 drop-shadow-[0_15px_30px_rgba(0,0,0,0.95)]">
                    4
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Bottom Title & Striker Strip */}
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="mt-6 flex flex-col items-center gap-2"
            >
              <h2 className="text-4xl sm:text-7xl font-black uppercase tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 via-teal-100 to-emerald-400 drop-shadow-[0_4px_20px_rgba(16,185,129,0.9)]">
                FOUR RUNS
              </h2>
              {currentEvent.batsmanName && (
                <div className="px-6 py-2 -skew-x-12 bg-black/80 border border-emerald-400/50 shadow-lg">
                  <span className="skew-x-12 text-lg sm:text-2xl font-black uppercase tracking-wider text-emerald-300">
                    BATTER: {currentEvent.batsmanName}
                  </span>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* ============================================================
            2. MAXIMUM SIX (6) - SOLAR FLARE STADIUM IMPACT
        ============================================================ */}
        {currentEvent.type === "SIX" && (
          <div className="relative z-20 flex flex-col items-center justify-center text-center px-4 w-full max-w-6xl">
            {/* Top Kinetic Banner */}
            <motion.div
              initial={{ y: -60, scale: 0.8, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ duration: 0.35 }}
              className="flex items-center gap-3 px-10 py-2.5 -skew-x-12 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 border-2 border-yellow-200 shadow-[0_0_60px_rgba(245,158,11,0.9)] mb-6 animate-pulse"
            >
              <Zap className="skew-x-12 w-6 h-6 text-black" />
              <span className="skew-x-12 text-base sm:text-xl font-black uppercase tracking-[0.35em] text-black">
                ⚡ MAXIMUM IMPACT ⚡
              </span>
              <Zap className="skew-x-12 w-6 h-6 text-black" />
            </motion.div>

            {/* Giant 3D Gold Chrome "6" with Shockwave Frame */}
            <motion.div
              initial={{ scale: 3.2, y: -40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="absolute -inset-24 rounded-full bg-amber-500/35 blur-3xl" />

              <div className="relative px-14 py-4 sm:px-24 sm:py-6 -skew-x-12 bg-gradient-to-b from-slate-900 via-amber-950 to-black border-4 border-amber-400 shadow-[0_0_140px_rgba(245,158,11,1)]">
                <span className="skew-x-12 block text-[11rem] sm:text-[15rem] md:text-[18rem] font-black font-mono leading-none text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-amber-300 to-amber-600 drop-shadow-[0_20px_35px_rgba(0,0,0,0.95)]">
                  6
                </span>
              </div>
            </motion.div>

            {/* Stadium Callout & Batter Card */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="mt-6 flex flex-col items-center gap-2"
            >
              <h2 className="text-5xl sm:text-8xl font-black uppercase tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-100 to-yellow-400 drop-shadow-[0_0_35px_rgba(251,191,36,0.95)]">
                MAXIMUM SIX!
              </h2>
              <div className="px-8 py-2 -skew-x-12 bg-amber-500/20 border-2 border-amber-400/60 shadow-xl">
                <span className="skew-x-12 text-xl sm:text-2xl font-black uppercase tracking-widest text-yellow-300">
                  {currentEvent.batsmanName ? `${currentEvent.batsmanName} CLEARS THE ROPES!` : "OUT OF THE PARK!"}
                </span>
              </div>
            </motion.div>
          </div>
        )}

        {/* ============================================================
            3. WICKET (OUT) - HIGH DRAMA CRIMSON STROBE & SHATTER
        ============================================================ */}
        {currentEvent.type === "WICKET" && (
          <div className="relative z-20 flex flex-col items-center justify-center text-center px-4 w-full max-w-5xl">
            {/* Top Hazard Warning Stripes */}
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="px-10 py-2 -skew-x-12 bg-red-600 border-2 border-red-300 shadow-[0_0_50px_rgba(239,68,68,0.9)] mb-6 animate-pulse"
            >
              <span className="skew-x-12 text-sm sm:text-lg font-black uppercase tracking-[0.4em] text-white">
                ⚠ WICKET TAKEN ⚠
              </span>
            </motion.div>

            {/* Shattered Metal "OUT!" Stamp */}
            <motion.div
              initial={{ scale: 2.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="absolute -inset-20 rounded-full bg-red-600/40 blur-3xl" />

              <div className="px-12 py-6 sm:px-24 sm:py-8 -skew-x-12 bg-gradient-to-b from-red-950 via-red-900 to-black border-4 border-red-500 shadow-[0_0_120px_rgba(239,68,68,1)]">
                <h1 className="skew-x-12 text-7xl sm:text-9xl md:text-[11rem] font-black uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-b from-white via-red-100 to-red-400 drop-shadow-[0_10px_30px_rgba(0,0,0,0.95)]">
                  WICKET!
                </h1>
              </div>
            </motion.div>

            {/* Dismissal Mode & Player Card */}
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.28, duration: 0.4 }}
              className="mt-6 flex flex-col items-center gap-3"
            >
              <div className="px-8 py-2.5 -skew-x-12 bg-red-600/30 border-2 border-red-400 text-red-100 text-xl sm:text-3xl font-black uppercase tracking-widest shadow-xl">
                <span className="skew-x-12 block">{currentEvent.dismissal || "OUT!"}</span>
              </div>
              {currentEvent.batsmanName && (
                <p className="text-2xl sm:text-3xl font-extrabold uppercase tracking-wide text-white">
                  BATSMAN: <span className="text-red-400">{currentEvent.batsmanName}</span>
                </p>
              )}
              {currentEvent.bowlerName && (
                <p className="text-base sm:text-xl font-semibold uppercase tracking-wider text-muted-foreground">
                  BOWLER: {currentEvent.bowlerName}
                </p>
              )}
            </motion.div>
          </div>
        )}

        {/* ============================================================
            4. WIDE BALL - HIGH CONTRAST INDUSTRIAL HAZARD
        ============================================================ */}
        {currentEvent.type === "WIDE" && (
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="relative z-20 flex flex-col items-center text-center px-4"
          >
            <div className="px-14 py-8 -skew-x-12 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 border-4 border-yellow-200 shadow-[0_0_90px_rgba(245,158,11,0.8)]">
              <span className="skew-x-12 block text-6xl sm:text-9xl font-black uppercase tracking-[0.2em] text-black drop-shadow">
                WIDE BALL
              </span>
            </div>
            <p className="mt-5 text-2xl sm:text-4xl font-black uppercase tracking-[0.25em] text-amber-300 drop-shadow">
              +1 EXTRA RUN · RE-DELIVERY
            </p>
          </motion.div>
        )}

        {/* ============================================================
            5. NO BALL - STADIUM HAZARD SIREN & FREE HIT WARNING
        ============================================================ */}
        {currentEvent.type === "NO_BALL" && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="relative z-20 flex flex-col items-center text-center px-4"
          >
            <div className="flex items-center gap-6 px-14 py-8 -skew-x-12 bg-gradient-to-r from-red-600 via-orange-600 to-red-700 border-4 border-yellow-300 shadow-[0_0_100px_rgba(239,68,68,0.9)] animate-pulse">
              <AlertTriangle className="skew-x-12 w-16 h-16 sm:w-20 sm:h-20 text-yellow-300 shrink-0" />
              <span className="skew-x-12 text-6xl sm:text-9xl font-black uppercase tracking-[0.2em] text-white">
                NO BALL!
              </span>
            </div>
            <div className="mt-6 px-8 py-2.5 -skew-x-12 bg-yellow-500 border-2 border-yellow-100 shadow-xl">
              <span className="skew-x-12 text-2xl sm:text-4xl font-black uppercase tracking-[0.2em] text-black">
                ⚡ FREE HIT NEXT DELIVERY ⚡
              </span>
            </div>
          </motion.div>
        )}

        {/* ============================================================
            6. FREE HIT - ELECTRIC VIOLET / CYAN SPOTLIGHT
        ============================================================ */}
        {currentEvent.type === "FREE_HIT" && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [0.95, 1.05, 1], opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="relative z-20 flex flex-col items-center text-center px-4"
          >
            <div className="flex items-center gap-6 px-14 py-8 -skew-x-12 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-700 border-4 border-fuchsia-200 shadow-[0_0_120px_rgba(192,38,211,0.9)] animate-pulse">
              <Flame className="skew-x-12 w-16 h-16 sm:w-20 sm:h-20 text-yellow-300" />
              <span className="skew-x-12 text-6xl sm:text-9xl font-black uppercase tracking-[0.2em] text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)]">
                FREE HIT!
              </span>
            </div>
            <p className="mt-6 text-2xl sm:text-4xl font-black uppercase tracking-[0.2em] text-fuchsia-300 drop-shadow">
              BATTER CANNOT BE DISMISSED OUT CAUGHT / BOWLED!
            </p>
          </motion.div>
        )}

        {/* ============================================================
            7. SUPER BALL (2X RUNS) - HIGH-VOLTAGE COLLISION EQUATION
        ============================================================ */}
        {currentEvent.type === "SUPER_BALL" && (() => {
          const totalRuns = currentEvent.totalRuns ?? (currentEvent.runsOffBat != null ? currentEvent.runsOffBat * 2 : 8);
          const baseRuns = currentEvent.runsOffBat ?? Math.round(totalRuns / 2);

          return (
            <div className="relative z-20 flex flex-col items-center justify-center text-center px-4 max-w-6xl">
              {/* Outer Cosmic Laser Rays */}
              <div className="absolute -inset-24 rounded-full bg-gradient-to-r from-cyan-500/35 via-fuchsia-500/35 to-amber-500/35 blur-3xl animate-pulse pointer-events-none" />

              {/* Top Banner */}
              <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.35 }}
                className="flex items-center gap-3 px-10 py-2.5 -skew-x-12 bg-gradient-to-r from-cyan-500 via-fuchsia-600 to-amber-500 border-2 border-cyan-200 shadow-[0_0_50px_rgba(6,182,212,0.8)] mb-6"
              >
                <Zap className="skew-x-12 w-7 h-7 text-yellow-200 animate-bounce" />
                <span className="skew-x-12 text-xl sm:text-3xl font-black uppercase tracking-[0.3em] text-white">
                  ⭐ SUPER BALL · 2X RUNS ACTIVATED ⭐
                </span>
                <Zap className="skew-x-12 w-7 h-7 text-yellow-200 animate-bounce" />
              </motion.div>

              {/* Broadcast Metallic Card Frame */}
              <div className="p-8 sm:p-14 -skew-x-6 rounded-3xl bg-gradient-to-b from-[#0b1222]/95 via-[#100e26]/95 to-[#060814]/95 border-4 border-cyan-400 shadow-[0_0_120px_rgba(6,182,212,0.8)] flex flex-col items-center gap-8">
                <div className="skew-x-6 flex items-center justify-center flex-wrap gap-4 sm:gap-8">
                  {/* Step 1: Base Runs Off Bat */}
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 0.45, ease: "backOut" }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-700 border-4 border-cyan-200 flex items-center justify-center shadow-[0_0_50px_rgba(6,182,212,0.9)]">
                      <span className="text-6xl sm:text-8xl font-black font-mono text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                        {baseRuns}
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-cyan-300 mt-3">
                      RUNS SCORED
                    </span>
                  </motion.div>

                  {/* Plus Sign */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.22, duration: 0.3 }}
                    className="text-6xl sm:text-8xl font-black text-fuchsia-400 drop-shadow-[0_0_25px_rgba(232,121,249,0.9)]"
                  >
                    +
                  </motion.div>

                  {/* Step 2: Super Bonus Doubled */}
                  <motion.div
                    initial={{ scale: 0, rotate: 20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.32, duration: 0.45, ease: "backOut" }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-purple-800 border-4 border-fuchsia-200 flex items-center justify-center shadow-[0_0_50px_rgba(217,70,239,0.9)]">
                      <span className="text-6xl sm:text-8xl font-black font-mono text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                        {baseRuns}
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-fuchsia-300 mt-3">
                      SUPER BONUS
                    </span>
                  </motion.div>

                  {/* Equals Sign */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.45, duration: 0.3 }}
                    className="text-6xl sm:text-8xl font-black text-amber-300 drop-shadow-[0_0_25px_rgba(252,211,77,0.9)]"
                  >
                    =
                  </motion.div>

                  {/* Step 3: Doubled Total Slam */}
                  <motion.div
                    initial={{ scale: 2.4, opacity: 0 }}
                    animate={{ scale: [2.4, 0.9, 1], opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-3xl bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 border-4 border-yellow-100 flex items-center justify-center shadow-[0_0_100px_rgba(245,158,11,1)]">
                      <span className="text-8xl sm:text-[10rem] font-black font-mono text-black drop-shadow-[0_6px_16px_rgba(0,0,0,0.6)]">
                        {totalRuns}
                      </span>
                    </div>
                    <span className="text-sm sm:text-lg font-black uppercase tracking-[0.25em] text-yellow-300 mt-3">
                      TOTAL ADDED!
                    </span>
                  </motion.div>
                </div>

                {/* Bottom Highlight Message */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.85, duration: 0.4 }}
                  className="skew-x-6 space-y-2 text-center"
                >
                  <p className="text-4xl sm:text-6xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 drop-shadow-[0_0_30px_rgba(251,191,36,0.9)]">
                    ⚡ {baseRuns} + {baseRuns} = {totalRuns} RUNS ADDED! ⚡
                  </p>
                  {currentEvent.batsmanName && (
                    <p className="text-xl sm:text-2xl font-bold uppercase tracking-widest text-white/90">
                      STRIKER: <span className="text-cyan-300 font-black">{currentEvent.batsmanName}</span>
                    </p>
                  )}
                </motion.div>
              </div>
            </div>
          );
        })()}

        {/* ============================================================
            8. SUPER OVER - ULTIMATE STADIUM SHOWDOWN
        ============================================================ */}
        {currentEvent.type === "SUPER_OVER" && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="relative z-20 flex flex-col items-center text-center px-4"
          >
            <div className="flex items-center gap-6 px-14 py-8 -skew-x-12 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 border-4 border-amber-200 shadow-[0_0_120px_rgba(245,158,11,1)]">
              <Swords className="skew-x-12 w-16 h-16 sm:w-20 sm:h-20 text-white animate-bounce" />
              <span className="skew-x-12 text-6xl sm:text-9xl font-black uppercase tracking-[0.2em] text-white">
                SUPER OVER!
              </span>
            </div>
            <p className="mt-6 text-2xl sm:text-4xl font-black uppercase tracking-[0.25em] text-amber-300 drop-shadow">
              MATCH TIED · THE TIE-BREAKER SHOWDOWN
            </p>
          </motion.div>
        )}

        {/* ============================================================
            9. INNINGS COMPLETE - BROADCAST SUMMARY ARENA
        ============================================================ */}
        {currentEvent.type === "INNINGS_COMPLETE" && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="relative z-20 w-full max-w-4xl px-4"
          >
            <div className="rounded-3xl bg-gradient-to-b from-card via-[#0a0d16] to-black border-4 border-primary/60 p-8 sm:p-14 shadow-[0_0_120px_rgba(0,0,0,0.95)] text-center space-y-6">
              <div className="inline-block px-8 py-2.5 -skew-x-12 bg-primary/20 border-2 border-primary text-primary font-black uppercase tracking-[0.3em] text-base sm:text-xl">
                <span className="skew-x-12 block">Innings {currentEvent.innings} Summary</span>
              </div>

              <div className="space-y-3">
                {currentEvent.battingTeam && (
                  <h3 className="text-3xl sm:text-5xl font-black uppercase tracking-wider text-muted-foreground">
                    {currentEvent.battingTeam}
                  </h3>
                )}
                <div className="text-8xl sm:text-[11rem] font-black font-mono text-white tabular-nums tracking-tight drop-shadow-[0_8px_30px_rgba(0,0,0,0.9)]">
                  {currentEvent.runs}
                  <span className="text-primary/80 mx-2">/</span>
                  {currentEvent.wickets}
                </div>
                <p className="text-2xl sm:text-4xl font-mono text-muted-foreground font-bold">
                  ({currentEvent.overs} OVERS)
                </p>
              </div>

              {currentEvent.innings === 1 && currentEvent.target != null && (
                <div className="mt-8 p-6 -skew-x-6 rounded-2xl bg-gradient-to-r from-primary/20 via-primary/30 to-primary/20 border-2 border-primary/50 shadow-xl">
                  <div className="skew-x-6">
                    <p className="text-base font-black uppercase tracking-[0.25em] text-primary">
                      TARGET FOR 2ND INNINGS
                    </p>
                    <p className="text-5xl sm:text-7xl font-black font-mono text-white mt-1">
                      {currentEvent.target} RUNS
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ============================================================
            10. MATCH RESULT - CHAMPIONS VICTORY CELEBRATION
        ============================================================ */}
        {currentEvent.type === "MATCH_RESULT" && (
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="relative z-20 w-full max-w-4xl px-4 text-center space-y-6"
          >
            <div className="relative rounded-3xl bg-gradient-to-b from-[#121524] via-[#090b14] to-black border-4 border-yellow-400 p-8 sm:p-14 shadow-[0_0_140px_rgba(234,179,8,0.5)]">
              <div className="flex justify-center mb-6">
                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-gradient-to-tr from-yellow-500 via-amber-300 to-yellow-500 border-4 border-yellow-100 flex items-center justify-center shadow-[0_0_70px_rgba(234,179,8,0.9)] animate-pulse">
                  <Trophy className="w-16 h-16 sm:w-20 sm:h-20 text-black" />
                </div>
              </div>

              <div className="inline-block px-8 py-2 -skew-x-12 bg-yellow-500 text-black font-black uppercase tracking-[0.35em] text-base sm:text-xl shadow-lg">
                <span className="skew-x-12 block">MATCH RESULT</span>
              </div>

              <h2 className="text-5xl sm:text-8xl font-black uppercase tracking-wide text-white drop-shadow-[0_8px_30px_rgba(0,0,0,0.95)] mt-4">
                {currentEvent.winnerName}
              </h2>

              {currentEvent.marginText && (
                <div className="mt-4 p-4 -skew-x-6 rounded-2xl bg-amber-500/20 border-2 border-amber-400/50">
                  <p className="skew-x-6 text-2xl sm:text-4xl font-black uppercase tracking-widest text-yellow-300">
                    {currentEvent.marginText}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ============================================================
            11. TOSS WINNER - 3D METALLIC COIN PRESENTATION
        ============================================================ */}
        {currentEvent.type === "TOSS_WIN" && (
          <motion.div
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="relative z-20 flex flex-col items-center text-center px-4"
          >
            <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-yellow-400 via-amber-200 to-yellow-500 border-4 border-yellow-100 flex items-center justify-center shadow-[0_0_80px_rgba(245,158,11,0.9)] mb-6 animate-spin">
              <Award className="w-16 h-16 text-black" />
            </div>
            <div className="px-12 py-8 -skew-x-6 rounded-3xl bg-card/95 border-4 border-border shadow-2xl space-y-3">
              <div className="skew-x-6">
                <p className="text-sm font-black uppercase tracking-[0.35em] text-muted-foreground">
                  OFFICIAL TOSS UPDATE
                </p>
                <h3 className="text-4xl sm:text-7xl font-black uppercase text-white mt-2">
                  {currentEvent.teamName}
                </h3>
                <p className="text-2xl sm:text-4xl font-extrabold uppercase text-primary tracking-wider mt-2">
                  WON THE TOSS & ELECTED TO {currentEvent.electedTo.toUpperCase()}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ============================================================
            12. BOWLER CHANGE & NEW BATSMAN - LOWER-THIRD BROADCAST STRIP
        ============================================================ */}
        {(currentEvent.type === "BOWLER_CHANGE" || currentEvent.type === "NEW_BATSMAN") && (
          <motion.div
            initial={{ x: -120, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -120, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-16 left-6 sm:left-12 max-w-xl -skew-x-12 rounded-2xl bg-gradient-to-r from-slate-950 via-[#0d1222] to-black border-3 border-primary/70 p-6 shadow-[0_0_60px_rgba(0,0,0,0.9)] flex items-center gap-6 z-30"
          >
            <div className="skew-x-12 w-16 h-16 rounded-xl bg-primary/20 border-2 border-primary/50 flex items-center justify-center shrink-0 shadow-lg">
              <ShieldAlert className="w-8 h-8 text-primary" />
            </div>
            <div className="skew-x-12 min-w-0">
              <span className="inline-block text-xs font-black uppercase tracking-[0.25em] text-primary bg-primary/10 px-2.5 py-0.5 rounded border border-primary/30 mb-1">
                {currentEvent.type === "BOWLER_CHANGE" ? "BOWLING CHANGE" : "NEW BATTER AT CREASE"}
              </span>
              <h4 className="text-2xl sm:text-4xl font-black uppercase text-white truncate">
                {currentEvent.type === "BOWLER_CHANGE"
                  ? currentEvent.bowlerName
                  : currentEvent.batsmanName}
              </h4>
              <p className="text-sm sm:text-base text-primary font-bold">
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
