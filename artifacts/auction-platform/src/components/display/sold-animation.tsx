import { memo } from "react";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import { formatIndianRupee } from "@/lib/format";
import { cldUrl } from "@/lib/cloudinary";
import { SoldCelebration } from "./sold-celebration";
import type { SoldRecord } from "./types";
import type { UnsoldRecord } from "./use-sold-animation";

/**
 * 1-second SOLD stamp — initial gavel-crack visual.
 * Scaled for auditorium / LED wall readability.
 */
export const SoldStamp = memo(function SoldStamp() {
  return (
    <motion.div
      initial={{ scale: 3, opacity: 0, rotate: -15 }}
      animate={{ scale: 1, opacity: 1, rotate: -12 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ duration: 0.45, type: "spring", bounce: 0.4 }}
      className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
    >
      <div
        className="font-display font-black text-red-500 border-[10px] border-red-500 px-10 py-5 rounded-2xl text-[clamp(4rem,12vw,9rem)]"
        style={{ textShadow: "0 0 40px rgba(239,68,68,0.8)", boxShadow: "0 0 60px rgba(239,68,68,0.6)", transform: "rotate(-12deg)" }}
      >
        SOLD!
      </div>
    </motion.div>
  );
});

export const UnsoldStamp = memo(function UnsoldStamp() {
  return (
    <motion.div
      initial={{ scale: 3, opacity: 0, rotate: -15 }}
      animate={{ scale: 1, opacity: 1, rotate: -12 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ duration: 0.45, type: "spring", bounce: 0.35 }}
      className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
    >
      <div
        className="font-display font-black text-red-400 border-[10px] border-red-400 px-10 py-5 rounded-2xl text-[clamp(3.5rem,10vw,8rem)]"
        style={{ textShadow: "0 0 40px rgba(248,113,113,0.75)", boxShadow: "0 0 60px rgba(248,113,113,0.5)", transform: "rotate(-12deg)" }}
      >
        UNSOLD
      </div>
    </motion.div>
  );
});

/**
 * Full-screen sold card — hierarchy optimized for venue viewing:
 * SOLD → Photo → Name → ₹ PRICE (dominant) → SOLD TO TEAM
 */
export const SoldCard = memo(function SoldCard({ record }: { record: SoldRecord }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center led-display-tv"
      style={{
        background: `radial-gradient(ellipse at 40% 30%, ${record.teamColor}28 0%, transparent 60%), radial-gradient(ellipse at 60% 70%, ${record.teamColor}18 0%, transparent 60%), #09090b`,
        padding: "var(--led-safe-y, 2rem) var(--led-safe-x, 3rem)",
      }}
    >
      <SoldCelebration teamColor={record.teamColor} durationSec={4} />

      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 32 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.32, duration: 0.55 }}
        className="flex flex-col items-center gap-4 md:gap-6 w-full max-w-5xl text-center"
      >
        {/* 1 — SOLD badge */}
        <div
          className="led-sold-badge-pop inline-flex items-center gap-4 px-10 py-3 md:px-14 md:py-4 rounded-full border-[3px] border-red-500 bg-red-500/20"
          style={{ boxShadow: "0 0 48px rgba(239,68,68,0.55)" }}
        >
          <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-red-500 animate-pulse" />
          <span className="font-display font-black text-3xl md:text-4xl lg:text-5xl tracking-[0.25em] text-red-400">
            SOLD
          </span>
        </div>

        {/* 2 — Player photo (~40% larger than prior w-52 h-60) */}
        <div className="relative led-sold-glow-ring">
          <div
            className="w-64 h-[19rem] sm:w-72 sm:h-[21rem] md:w-80 md:h-[23rem] lg:w-[22rem] lg:h-[26rem] rounded-3xl border-[5px] overflow-hidden flex items-center justify-center"
            style={{
              borderColor: record.teamColor,
              boxShadow: `0 0 80px ${record.teamColor}77, 0 0 160px ${record.teamColor}33`,
            }}
          >
            {record.photoUrl ? (
              <img
                src={cldUrl(record.photoUrl, "soldCard")}
                alt={record.playerName}
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
            ) : (
              <div className="w-full h-full bg-card flex items-center justify-center">
                <User className="w-28 h-28 text-muted-foreground opacity-20" />
              </div>
            )}
          </div>
        </div>

        {/* 3 — Player name */}
        <h1
          className="font-display font-black text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight text-white leading-none"
          style={{ textShadow: "0 0 40px rgba(255,255,255,0.12)" }}
        >
          {record.playerName}
        </h1>

        {/* 4 — Price (most visually dominant) */}
        <motion.div
          initial={{ scale: 0.75, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.25, type: "spring", bounce: 0.45, duration: 0.65 }}
          className="w-full"
        >
          <p
            className="font-display font-black leading-none text-[clamp(3.5rem,10vw,7.5rem)]"
            style={{
              color: record.teamColor,
              textShadow: `0 0 80px ${record.teamColor}cc, 0 0 24px ${record.teamColor}`,
              filter: `drop-shadow(0 4px 32px ${record.teamColor}99)`,
            }}
          >
            {formatIndianRupee(record.amount)}
          </p>
        </motion.div>

        {/* 5 — Sold to team (2–3× prior size, glow accent) */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="led-team-highlight flex items-center justify-center gap-5 md:gap-8 px-10 py-5 md:px-14 md:py-7 rounded-2xl md:rounded-3xl border-[3px] w-full max-w-3xl"
          style={{
            borderColor: record.teamColor,
            backgroundColor: `${record.teamColor}22`,
            ["--team-glow" as string]: `${record.teamColor}88`,
            ["--team-glow-soft" as string]: `${record.teamColor}44`,
          }}
        >
          {record.teamLogoUrl ? (
            <img
              src={cldUrl(record.teamLogoUrl, "teamLogo")}
              alt=""
              className="w-16 h-16 md:w-24 md:h-24 lg:w-28 lg:h-28 object-contain rounded-xl flex-shrink-0"
              style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.5))" }}
              loading="eager"
              decoding="async"
              onError={e => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div
              className="w-6 h-6 md:w-8 md:h-8 rounded-full animate-pulse flex-shrink-0"
              style={{ backgroundColor: record.teamColor }}
            />
          )}
          <div className="text-left min-w-0 flex-1">
            <p className="text-sm md:text-base lg:text-lg text-white/55 uppercase tracking-[0.3em] mb-1 md:mb-2 font-bold">
              Sold To
            </p>
            <p
              className="font-display font-black leading-tight text-3xl sm:text-4xl md:text-5xl lg:text-6xl truncate"
              style={{ color: record.teamColor, textShadow: `0 0 32px ${record.teamColor}66` }}
            >
              {record.teamName}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
});

export const UnsoldCard = memo(function UnsoldCard({ record }: { record: UnsoldRecord }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center led-display-tv"
      style={{
        background: "radial-gradient(ellipse at 50% 35%, rgba(239,68,68,0.18) 0%, transparent 60%), #09090b",
        padding: "var(--led-safe-y, 2rem) var(--led-safe-x, 3rem)",
      }}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 36 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.3, duration: 0.55 }}
        className="flex flex-col items-center gap-5 md:gap-7 max-w-4xl text-center w-full"
      >
        <div
          className="inline-flex items-center gap-4 px-10 py-3 md:px-14 md:py-4 rounded-full border-[3px] border-red-500 bg-red-500/15"
          style={{ boxShadow: "0 0 48px rgba(239,68,68,0.45)" }}
        >
          <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
          <span className="font-display font-black text-3xl md:text-4xl lg:text-5xl tracking-[0.25em] text-red-300">
            UNSOLD
          </span>
        </div>

        <div
          className="w-64 h-[19rem] sm:w-72 sm:h-[21rem] md:w-80 md:h-[23rem] rounded-3xl border-[5px] border-red-500/70 overflow-hidden flex items-center justify-center"
          style={{ boxShadow: "0 0 80px rgba(239,68,68,0.35)" }}
        >
          {record.photoUrl ? (
            <img
              src={cldUrl(record.photoUrl, "soldCard")}
              alt={record.playerName}
              className="w-full h-full object-cover grayscale"
              loading="eager"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full bg-card flex items-center justify-center">
              <User className="w-28 h-28 text-muted-foreground opacity-20" />
            </div>
          )}
        </div>

        <h1
          className="font-display font-black text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight text-white leading-none"
          style={{ textShadow: "0 0 40px rgba(255,255,255,0.12)" }}
        >
          {record.playerName}
        </h1>

        <div className="px-10 py-5 md:px-14 md:py-7 rounded-2xl border-[3px] border-red-500/45 bg-red-500/10">
          <p className="font-display font-black text-3xl md:text-4xl lg:text-5xl leading-none text-red-300">
            Returns to Pool
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
});
