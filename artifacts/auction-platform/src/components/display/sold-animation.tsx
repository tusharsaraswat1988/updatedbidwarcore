import { memo } from "react";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import { formatIndianRupee } from "@/lib/format";
import { cldUrl } from "@/lib/cloudinary";
import { SoldCelebration } from "./sold-celebration";
import type { SoldRecord, UnsoldRecord } from "./types";

export const SoldStamp = memo(function SoldStamp() {
  return (
    <motion.div
      initial={{ scale: 3, opacity: 0, rotate: -15 }}
      animate={{ scale: 1, opacity: 1, rotate: -12 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ duration: 0.45, type: "spring", bounce: 0.4 }}
      className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
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
      className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
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
 * Sold result — horizontal broadcast layout so price + team always fit
 * within 16:9 venue viewports (no vertical clipping).
 *
 * Hierarchy: SOLD → Photo + (Name, PRICE, Team)
 */
export const SoldCard = memo(function SoldCard({ record }: { record: SoldRecord }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-0 z-30 flex items-center justify-center led-display-tv overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 35% 40%, ${record.teamColor}30 0%, transparent 55%), radial-gradient(ellipse at 65% 60%, ${record.teamColor}18 0%, transparent 55%), rgba(9,9,11,0.97)`,
        padding: "clamp(1rem, 2.5vh, 2rem) clamp(1.5rem, 5vw, 4rem)",
      }}
    >
      <SoldCelebration teamColor={record.teamColor} durationSec={4} />

      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.28, duration: 0.5 }}
        className="w-full max-w-[min(96vw,88rem)] flex flex-col gap-4 md:gap-6"
      >
        {/* SOLD badge */}
        <div className="flex justify-center">
          <div
            className="led-sold-badge-pop inline-flex items-center gap-3 px-8 py-2 md:px-12 md:py-3 rounded-full border-[3px] border-red-500 bg-red-500/20"
            style={{ boxShadow: "0 0 48px rgba(239,68,68,0.55)" }}
          >
            <div className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full bg-red-500 animate-pulse" />
            <span
              className="font-display font-black tracking-[0.3em] text-red-400"
              style={{ fontSize: "clamp(1.5rem, 3.5vw, 3rem)" }}
            >
              SOLD
            </span>
          </div>
        </div>

        {/* Photo + details — uses horizontal space on venue screens */}
        <div className="flex flex-col md:flex-row items-center md:items-stretch justify-center gap-5 md:gap-10 lg:gap-14 w-full">
          {/* Photo */}
          <div className="flex-shrink-0 led-sold-glow-ring">
            <div
              className="rounded-3xl border-[5px] overflow-hidden flex items-center justify-center"
              style={{
                width: "clamp(11rem, 22vw, 20rem)",
                height: "clamp(13rem, 26vw, 24rem)",
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
                  <User className="w-20 h-20 text-muted-foreground opacity-20" />
                </div>
              )}
            </div>
          </div>

          {/* Name + price + team — price is dominant */}
          <div className="flex flex-col items-center md:items-start justify-center text-center md:text-left min-w-0 flex-1 gap-3 md:gap-5">
            <h1
              className="font-display font-black tracking-tight text-white leading-none w-full"
              style={{ fontSize: "clamp(2rem, 4.5vw, 4.5rem)" }}
            >
              {record.playerName}
            </h1>

            <motion.p
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", bounce: 0.4 }}
              className="font-display font-black leading-none w-full"
              style={{
                fontSize: "clamp(3rem, 8vw, 6.5rem)",
                color: record.teamColor,
                textShadow: `0 0 80px ${record.teamColor}cc, 0 0 24px ${record.teamColor}`,
              }}
            >
              {formatIndianRupee(record.amount)}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="led-team-highlight flex items-center gap-4 md:gap-6 px-6 py-4 md:px-10 md:py-5 rounded-2xl border-[3px] w-full max-w-2xl"
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
                  className="object-contain rounded-xl flex-shrink-0"
                  style={{ width: "clamp(3rem, 6vw, 5.5rem)", height: "clamp(3rem, 6vw, 5.5rem)" }}
                  loading="eager"
                  decoding="async"
                  onError={e => (e.currentTarget.style.display = "none")}
                />
              ) : (
                <div
                  className="rounded-full animate-pulse flex-shrink-0"
                  style={{ width: "clamp(1.25rem, 2vw, 2rem)", height: "clamp(1.25rem, 2vw, 2rem)", backgroundColor: record.teamColor }}
                />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className="text-white/55 uppercase tracking-[0.25em] mb-1 font-bold"
                  style={{ fontSize: "clamp(0.7rem, 1.2vw, 1.1rem)" }}
                >
                  Sold To
                </p>
                <p
                  className="font-display font-black leading-tight"
                  style={{
                    fontSize: "clamp(1.75rem, 4vw, 3.75rem)",
                    color: record.teamColor,
                    textShadow: `0 0 32px ${record.teamColor}66`,
                  }}
                >
                  {record.teamName}
                </p>
              </div>
            </motion.div>
          </div>
        </div>
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
      className="absolute inset-0 z-30 flex items-center justify-center led-display-tv overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 50% 35%, rgba(239,68,68,0.18) 0%, transparent 60%), rgba(9,9,11,0.97)",
        padding: "clamp(1rem, 2.5vh, 2rem) clamp(1.5rem, 5vw, 4rem)",
      }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center gap-5 md:gap-7 max-w-4xl text-center w-full"
      >
        <div
          className="inline-flex items-center gap-4 px-10 py-3 rounded-full border-[3px] border-red-500 bg-red-500/15"
          style={{ boxShadow: "0 0 48px rgba(239,68,68,0.45)" }}
        >
          <span className="font-display font-black text-3xl md:text-5xl tracking-[0.25em] text-red-300">UNSOLD</span>
        </div>

        <div
          className="rounded-3xl border-[5px] border-red-500/70 overflow-hidden"
          style={{ width: "clamp(11rem, 22vw, 18rem)", height: "clamp(13rem, 26vw, 22rem)" }}
        >
          {record.photoUrl ? (
            <img src={cldUrl(record.photoUrl, "soldCard")} alt={record.playerName} className="w-full h-full object-cover grayscale" />
          ) : (
            <div className="w-full h-full bg-card flex items-center justify-center">
              <User className="w-20 h-20 text-muted-foreground opacity-20" />
            </div>
          )}
        </div>

        <h1 className="font-display font-black text-4xl md:text-6xl text-white leading-none">{record.playerName}</h1>
        <p className="font-display font-black text-3xl md:text-4xl text-red-300">Returns to Pool</p>
      </motion.div>
    </motion.div>
  );
});
