import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { User, Trophy, Crown } from "lucide-react";
import { formatShortIndianRupee } from "@/lib/format";
import type { PlayerLite, PurseRow } from "./types";

/**
 * Overlay 3 — TOP 5 BUYS broadcast graphic.
 * Sort/slice is useMemo'd so the heavy list re-render only runs when
 * the player set actually changes. React.memo'd so unrelated parent
 * rerenders (timer ticks, bid pulses) don't reach this overlay.
 */
export const Top5Overlay = memo(function Top5Overlay({ players, purses, tournamentName }: {
  players: PlayerLite[];
  purses: PurseRow[];
  tournamentName?: string;
}) {
  const teamMap = useMemo(() => new Map(purses.map(t => [t.teamId, t])), [purses]);
  const top5 = useMemo(() => players
    .filter(p => p.status === "sold" && (p.soldPrice ?? 0) > 0)
    .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0) || a.id - b.id)
    .slice(0, 5), [players]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col select-none overflow-hidden"
      style={{ background: "radial-gradient(ellipse at top, #1e1b4b 0%, #0f0a1f 50%, #000 100%)" }}>
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle, #a855f7 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      {/* Header */}
      <div className="relative flex items-center justify-center gap-4 pt-6 md:pt-8 pb-4 flex-shrink-0">
        <Crown className="w-10 h-10 md:w-14 md:h-14 text-yellow-400" style={{ filter: "drop-shadow(0 0 20px rgba(250,204,21,0.6))" }} />
        <div className="text-center">
          <h1 className="font-display font-black text-4xl md:text-7xl lg:text-8xl tracking-tight"
            style={{
              background: "linear-gradient(135deg, #fde047 0%, #f59e0b 50%, #fde047 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 60px rgba(250,204,21,0.4)",
            }}>
            TOP 5 BUYS
          </h1>
          {tournamentName && (
            <p className="text-xs md:text-sm font-bold uppercase tracking-[0.4em] text-white/60 mt-1">{tournamentName} AUCTION</p>
          )}
        </div>
        <Crown className="w-10 h-10 md:w-14 md:h-14 text-yellow-400" style={{ filter: "drop-shadow(0 0 20px rgba(250,204,21,0.6))" }} />
      </div>

      {/* List */}
      <div className="relative flex-1 flex flex-col gap-2 md:gap-3 px-4 md:px-12 py-4 overflow-hidden">
        {top5.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center text-white/40">
            <div>
              <Trophy className="w-16 h-16 mx-auto mb-3 opacity-50" />
              <p className="text-2xl font-display font-bold">No sales recorded yet</p>
              <p className="text-sm mt-1">Top buys will appear here as the auction progresses</p>
            </div>
          </div>
        ) : (
          top5.map((p, idx) => {
            const team = p.teamId ? teamMap.get(p.teamId) : null;
            const color = team?.color || "#7c3aed";
            const rank = idx + 1;
            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, x: -60 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 15, delay: idx * 0.08 }}
                className="relative flex items-center rounded-2xl overflow-hidden flex-1 min-h-0"
                style={{
                  background: `linear-gradient(90deg, ${color}ee 0%, ${color}cc 60%, ${color}66 100%)`,
                  boxShadow: `0 0 30px ${color}66, inset 0 1px 0 rgba(255,255,255,0.2)`,
                  border: `2px solid ${color}`,
                }}
              >
                {/* Rank badge */}
                <div className="flex items-center justify-center w-16 md:w-24 h-full flex-shrink-0 bg-black/40 border-r-2 border-white/20">
                  <span className="font-display font-black text-4xl md:text-6xl text-white tabular-nums"
                    style={{ textShadow: "0 0 20px rgba(0,0,0,0.6)" }}>
                    {rank}
                  </span>
                </div>

                {/* Team logo */}
                <div className="flex items-center justify-center px-3 md:px-5 flex-shrink-0">
                  {team?.logoUrl ? (
                    <img src={team.logoUrl} alt={team.shortCode} className="w-12 h-12 md:w-20 md:h-20 object-contain"
                      style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.7))" }} />
                  ) : (
                    <div className="w-12 h-12 md:w-20 md:h-20 rounded-xl bg-white/15 border-2 border-white/40 flex items-center justify-center font-display font-black text-sm md:text-2xl text-white">
                      {team?.shortCode || "—"}
                    </div>
                  )}
                </div>

                {/* Name + price */}
                <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center justify-between gap-1 md:gap-4 pr-3 md:pr-6">
                  <div className="min-w-0">
                    <p className="font-display font-black text-xl md:text-4xl lg:text-5xl text-white leading-none uppercase truncate"
                      style={{ textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
                      {p.name}
                    </p>
                    {team && (
                      <p className="text-xs md:text-sm font-bold text-white/80 uppercase tracking-widest mt-1 truncate">{team.teamName}</p>
                    )}
                  </div>
                  <p className="font-display font-black text-2xl md:text-5xl lg:text-6xl text-white tabular-nums whitespace-nowrap"
                    style={{ textShadow: "0 0 30px rgba(255,255,255,0.4), 0 4px 8px rgba(0,0,0,0.6)" }}>
                    {formatShortIndianRupee(p.soldPrice ?? 0)}
                  </p>
                </div>

                {/* Player photo */}
                <div className="hidden md:flex items-end justify-end h-full w-32 lg:w-44 flex-shrink-0 relative overflow-hidden">
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover object-top"
                      style={{ maskImage: "linear-gradient(90deg, transparent 0%, #000 40%)", WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 40%)" }} />
                  ) : (
                    <div className="h-full w-full flex items-end justify-center bg-black/20">
                      <User className="w-20 h-20 text-white/20" />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
});
