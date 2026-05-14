import { memo } from "react";
import { motion } from "framer-motion";
import { Wallet } from "lucide-react";
import { formatShortIndianRupee } from "@/lib/format";
import type { PurseRow } from "./types";

/**
 * Overlay 1 — IPL-style TEAM PURSE STATUS table.
 * Render isolation: receives only the slices it needs (`purses`,
 * `currentBidTeamId`, `tournamentName`). React.memo'd so bid/timer
 * updates that don't change the leading team don't rerender it.
 */
export const TeamOverlay = memo(function TeamOverlay({ purses, currentBidTeamId, tournamentName }: {
  purses: PurseRow[];
  currentBidTeamId?: number | null;
  tournamentName?: string;
}) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col select-none overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at top, #1e1b4b 0%, #020617 60%, #000 100%)",
      }}>
      {/* subtle pattern */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative flex items-center justify-center gap-4 pt-6 pb-4 flex-shrink-0">
        <Wallet className="w-8 h-8 md:w-10 md:h-10 text-primary" />
        <div className="text-center">
          <h1 className="font-display font-black text-3xl md:text-5xl lg:text-6xl tracking-tight text-primary"
            style={{ textShadow: "0 0 40px rgba(234,179,8,0.5)" }}>
            TEAM PURSE STATUS
          </h1>
          {tournamentName && (
            <p className="text-xs md:text-sm font-bold uppercase tracking-[0.3em] text-white/60 mt-1">{tournamentName}</p>
          )}
        </div>
        <Wallet className="w-8 h-8 md:w-10 md:h-10 text-primary" />
      </div>

      <div className="relative flex-1 px-4 md:px-8 pb-6 overflow-hidden">
        <div className="h-full rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm flex flex-col">
          {/* Table head */}
          <div className="grid grid-cols-12 gap-2 px-4 md:px-6 py-3 border-b border-white/15 text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/60">
            <div className="col-span-4 md:col-span-3">Team</div>
            <div className="col-span-3 md:col-span-2 hidden md:block">Owner</div>
            <div className="col-span-2 text-right">Total</div>
            <div className="col-span-3 md:col-span-2 text-right">Spendable</div>
            <div className="col-span-2 md:col-span-1 text-center">Squad</div>
            <div className="col-span-1 md:col-span-2 text-right hidden md:block">Used</div>
          </div>
          {/* Rows */}
          <div className="flex-1 overflow-y-auto">
            {purses.map((team, i) => {
              const pctUsed = Math.min(100, team.purse > 0 ? (team.purseUsed / team.purse) * 100 : 0);
              const isLeading = currentBidTeamId === team.teamId;
              const color = team.color || "#F59E0B";
              return (
                <motion.div
                  key={team.teamId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className="grid grid-cols-12 gap-2 px-4 md:px-6 py-3 md:py-4 items-center border-b border-white/5 relative"
                  style={{
                    backgroundColor: isLeading ? `${color}22` : i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent",
                    boxShadow: isLeading ? `inset 4px 0 0 ${color}, inset 0 0 30px ${color}22` : undefined,
                  }}
                >
                  {/* Team */}
                  <div className="col-span-4 md:col-span-3 flex items-center gap-2 md:gap-3 min-w-0">
                    {team.logoUrl ? (
                      <img src={team.logoUrl} alt={team.teamName} className="w-9 h-9 md:w-12 md:h-12 rounded-lg object-contain flex-shrink-0"
                        style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.7))" }} />
                    ) : (
                      <div className="w-9 h-9 md:w-12 md:h-12 rounded-lg flex items-center justify-center font-display font-black text-xs md:text-base flex-shrink-0"
                        style={{ backgroundColor: `${color}30`, color, border: `2px solid ${color}66` }}>
                        {team.shortCode}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-display font-black text-sm md:text-lg leading-tight truncate text-white">
                        {team.teamName}
                      </p>
                      <p className="text-[10px] md:text-xs font-bold tabular-nums" style={{ color: `${color}cc` }}>{team.shortCode}</p>
                    </div>
                    {isLeading && (
                      <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} />
                    )}
                  </div>
                  {/* Owner */}
                  <div className="col-span-3 md:col-span-2 hidden md:block min-w-0">
                    <p className="text-sm font-semibold text-white/80 truncate">{team.ownerName || "—"}</p>
                  </div>
                  {/* Total */}
                  <div className="col-span-2 text-right">
                    <p className="text-sm md:text-lg font-display font-black tabular-nums text-white/70">{formatShortIndianRupee(team.purse)}</p>
                  </div>
                  {/* Spendable */}
                  <div className="col-span-3 md:col-span-2 text-right">
                    <p className="text-base md:text-2xl font-display font-black tabular-nums" style={{ color, textShadow: `0 0 20px ${color}77` }}>
                      {formatShortIndianRupee(team.spendablePurse ?? team.purseRemaining)}
                    </p>
                    {(team.reservePurse ?? 0) > 0 && (
                      <p className="text-[9px] md:text-[10px] text-amber-400/70 font-bold leading-none mt-0.5">
                        +{formatShortIndianRupee(team.reservePurse)} rsv
                      </p>
                    )}
                  </div>
                  {/* Squad */}
                  {(() => {
                    const maxSquad = team.maximumSquadSize ?? 0;
                    const slotsNeeded = team.slotsRequired ?? 0;
                    const maxReached = maxSquad > 0 && team.playersBought >= maxSquad;
                    return (
                      <div className="col-span-2 md:col-span-1 text-center">
                        <p className={`text-base md:text-xl font-display font-black tabular-nums leading-tight ${
                          maxReached ? "text-red-400" : slotsNeeded > 0 ? "text-amber-400" : "text-white"
                        }`}>
                          {team.playersBought}
                          {maxSquad > 0 && <span className="text-[10px] md:text-xs opacity-60">/{maxSquad}</span>}
                        </p>
                        {slotsNeeded > 0 && (
                          <p className="text-[8px] md:text-[9px] text-amber-400/80 leading-none mt-0.5">need {slotsNeeded}</p>
                        )}
                        {maxReached && (
                          <p className="text-[8px] md:text-[9px] text-red-400 font-bold leading-none mt-0.5">FULL</p>
                        )}
                      </div>
                    );
                  })()}
                  {/* Used % bar */}
                  <div className="col-span-1 md:col-span-2 hidden md:block">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${color}22` }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pctUsed}%` }}
                          transition={{ duration: 0.8, delay: 0.2 + i * 0.04 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums w-10 text-right" style={{ color }}>{Math.round(pctUsed)}%</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
