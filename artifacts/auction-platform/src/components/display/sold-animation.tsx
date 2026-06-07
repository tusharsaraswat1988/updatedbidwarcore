import { memo } from "react";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import { formatIndianRupee } from "@/lib/format";
import { cldUrl } from "@/lib/cloudinary";
import type { SoldRecord } from "./types";
import type { UnsoldRecord } from "./use-sold-animation";

/**
 * 1-second SOLD stamp — initial gavel-crack visual.
 * Pure presentational; isolated under React.memo so the stamp animation
 * does not retrigger on unrelated parent rerenders.
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
      <div className="text-8xl font-display font-black text-red-500 border-[8px] border-red-500 px-8 py-4 rounded-2xl"
        style={{ textShadow: "0 0 40px rgba(239,68,68,0.8)", boxShadow: "0 0 60px rgba(239,68,68,0.6)", transform: "rotate(-12deg)" }}>
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
        className="text-8xl font-display font-black text-red-400 border-[8px] border-red-400 px-8 py-4 rounded-2xl"
        style={{ textShadow: "0 0 40px rgba(248,113,113,0.75)", boxShadow: "0 0 60px rgba(248,113,113,0.5)", transform: "rotate(-12deg)" }}
      >
        UNSOLD
      </div>
    </motion.div>
  );
});

/**
 * Full-screen sold card shown after the stamp, until the next player
 * starts. Receives a frozen SoldRecord (captured at sell time) so it
 * doesn't depend on the live auction state — once mounted with a
 * record, its contents never change.
 */
export const SoldCard = memo(function SoldCard({ record }: { record: SoldRecord }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      style={{ background: `radial-gradient(ellipse at 40% 30%, ${record.teamColor}22 0%, transparent 60%), radial-gradient(ellipse at 60% 70%, ${record.teamColor}15 0%, transparent 60%), #09090b` }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.35, duration: 0.6 }}
        className="flex flex-col items-center gap-6 max-w-2xl text-center px-8"
      >
        {/* Sold badge */}
        <div className="inline-flex items-center gap-3 px-8 py-3 rounded-full border-2 border-red-500 bg-red-500/15"
          style={{ boxShadow: "0 0 40px rgba(239,68,68,0.5)" }}>
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="font-display font-black text-2xl tracking-widest text-red-400">SOLD</span>
        </div>

        {/* Player photo */}
        <div className="relative">
          <div
            className="w-52 h-60 rounded-3xl border-4 overflow-hidden flex items-center justify-center"
            style={{
              borderColor: record.teamColor,
              boxShadow: `0 0 80px ${record.teamColor}66, 0 0 160px ${record.teamColor}22`,
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
                <User className="w-24 h-24 text-muted-foreground opacity-20" />
              </div>
            )}
          </div>
        </div>

        {/* Player name */}
        <div>
          <h1 className="font-display font-black text-6xl md:text-7xl tracking-tight text-white leading-none mb-2"
            style={{ textShadow: "0 0 40px rgba(255,255,255,0.15)" }}>
            {record.playerName}
          </h1>
        </div>

        {/* Amount */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: "spring", bounce: 0.5 }}
        >
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Sold For</p>
          <p className="font-display font-black text-7xl leading-none" style={{ color: record.teamColor, textShadow: `0 0 60px ${record.teamColor}99` }}>
            {formatIndianRupee(record.amount)}
          </p>
        </motion.div>

        {/* Sold to team */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-4 px-10 py-5 rounded-2xl border-2"
          style={{ borderColor: record.teamColor, backgroundColor: `${record.teamColor}18`, boxShadow: `0 0 40px ${record.teamColor}44` }}
        >
          <div className="w-4 h-4 rounded-full animate-pulse" style={{ backgroundColor: record.teamColor }} />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Sold To</p>
            <p className="font-display font-black text-3xl leading-none" style={{ color: record.teamColor }}>
              {record.teamName}
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Waiting hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-24 text-xs text-muted-foreground/50 uppercase tracking-widest animate-pulse"
      >
        Waiting for next player...
      </motion.p>
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
      className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      style={{ background: "radial-gradient(ellipse at 50% 35%, rgba(239,68,68,0.18) 0%, transparent 60%), #09090b" }}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 36 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.3, duration: 0.55 }}
        className="flex flex-col items-center gap-6 max-w-2xl text-center px-8"
      >
        <div
          className="inline-flex items-center gap-3 px-8 py-3 rounded-full border-2 border-red-500 bg-red-500/15"
          style={{ boxShadow: "0 0 40px rgba(239,68,68,0.45)" }}
        >
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="font-display font-black text-2xl tracking-widest text-red-300">UNSOLD</span>
        </div>

        <div
          className="w-52 h-60 rounded-3xl border-4 border-red-500/70 overflow-hidden flex items-center justify-center"
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
              <User className="w-24 h-24 text-muted-foreground opacity-20" />
            </div>
          )}
        </div>

        <h1
          className="font-display font-black text-6xl md:text-7xl tracking-tight text-white leading-none"
          style={{ textShadow: "0 0 40px rgba(255,255,255,0.12)" }}
        >
          {record.playerName}
        </h1>

        <div className="px-10 py-5 rounded-2xl border-2 border-red-500/45 bg-red-500/10">
          <p className="text-xs text-red-200/70 uppercase tracking-widest mb-1">Auction Result</p>
          <p className="font-display font-black text-4xl leading-none text-red-300">
            Returns to Pool
          </p>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-24 text-xs text-muted-foreground/50 uppercase tracking-widest animate-pulse"
      >
        Waiting for next player...
      </motion.p>
    </motion.div>
  );
});
