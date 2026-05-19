import { memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Users as UsersIcon } from "lucide-react";
import { formatShortIndianRupee } from "@/lib/format";
import { useBranding } from "@/hooks/use-branding";
import type { CategoryLite, DisplayPlayerFilter, PlayerLite, PurseRow } from "./types";

/**
 * Overlay 2 — Player-wise live registry table.
 * Heavy filter/sort/count math is wrapped in useMemo, keyed on the
 * exact slices that influence it, so timer ticks or unrelated state
 * changes don't recompute. React.memo'd so the parent's per-tick
 * rerenders never propagate here.
 */
export const PlayerOverlay = memo(function PlayerOverlay({ players, purses, categories, tournamentName, filter }: {
  players: PlayerLite[];
  purses: PurseRow[];
  categories: CategoryLite[];
  tournamentName?: string;
  filter?: DisplayPlayerFilter;
}) {
  const { logos, brandName, miniBrandText, poweredByText, visibility } = useBranding();
  const teamMap = useMemo(() => new Map(purses.map(t => [t.teamId, t])), [purses]);
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);

  const f = {
    status: filter?.status ?? "all",
    categoryId: filter?.categoryId ?? null,
    teamId: filter?.teamId ?? null,
  };

  const sorted = useMemo(() => {
    const filtered = players.filter(p => {
      if (f.status !== "all" && p.status !== f.status) return false;
      if (f.categoryId && p.categoryId !== f.categoryId) return false;
      if (f.teamId && p.teamId !== f.teamId) return false;
      return true;
    });
    return [...filtered].sort((a, b) => a.id - b.id);
  }, [players, f.status, f.categoryId, f.teamId]);

  const counts = useMemo(() => ({
    sold: players.filter(p => p.status === "sold").length,
    unsold: players.filter(p => p.status === "unsold").length,
    available: players.filter(p => p.status === "available").length,
    retained: players.filter(p => p.status === "retained").length,
  }), [players]);

  const activeFilterLabels: string[] = [];
  if (f.status !== "all") activeFilterLabels.push(f.status.toUpperCase());
  if (f.categoryId) {
    const cn = catMap.get(f.categoryId);
    if (cn) activeFilterLabels.push(cn.toUpperCase());
  }
  if (f.teamId) {
    const tn = teamMap.get(f.teamId)?.teamName;
    if (tn) activeFilterLabels.push(tn.toUpperCase());
  }

  const statusStyle = (s: string) => {
    switch (s) {
      case "sold": return { bg: "bg-emerald-500/20", border: "border-emerald-400", text: "text-emerald-300", label: "SOLD" };
      case "unsold": return { bg: "bg-red-500/20", border: "border-red-400", text: "text-red-300", label: "UNSOLD" };
      case "retained": return { bg: "bg-purple-500/20", border: "border-purple-400", text: "text-purple-300", label: "RETAINED" };
      default: return { bg: "bg-white/10", border: "border-white/30", text: "text-white/70", label: "AVAILABLE" };
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col select-none overflow-hidden"
      style={{ background: "radial-gradient(ellipse at top, #082f49 0%, #020617 60%, #000 100%)" }}>
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative flex flex-col md:flex-row items-center justify-between gap-3 px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <UsersIcon className="w-8 h-8 md:w-10 md:h-10 text-blue-400" />
          <div>
            <h1 className="font-display font-black text-3xl md:text-5xl tracking-tight text-blue-300"
              style={{ textShadow: "0 0 40px rgba(59,130,246,0.5)" }}>
              PLAYER REGISTRY
            </h1>
            {tournamentName && (
              <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] text-white/60 mt-0.5">{tournamentName}</p>
            )}
            {/* Brand watermark below title */}
            <div className="flex items-center gap-1.5 mt-1">
              {logos.mini ? (
                <img src={logos.mini} alt={brandName} className="h-4 w-auto opacity-50" />
              ) : (
                <span className="text-[9px] font-black tracking-widest uppercase text-blue-300/40">{miniBrandText}</span>
              )}
              {visibility.showPoweredByViewer && (
                <span className="text-[9px] font-semibold uppercase tracking-widest text-white/30">{poweredByText}</span>
              )}
            </div>
            {activeFilterLabels.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-blue-400/70">Filter:</span>
                {activeFilterLabels.map((lbl, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-400/40 text-[10px] md:text-xs font-bold text-blue-200">
                    {lbl}
                  </span>
                ))}
                <span className="text-[10px] md:text-xs text-white/50 ml-1">({sorted.length})</span>
              </div>
            )}
          </div>
        </div>
        {/* Stat chips */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-xs md:text-sm font-bold text-emerald-300">
            SOLD <span className="tabular-nums ml-1">{counts.sold}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-400/40 text-xs md:text-sm font-bold text-red-300">
            UNSOLD <span className="tabular-nums ml-1">{counts.unsold}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-xs md:text-sm font-bold text-white/70">
            REMAINING <span className="tabular-nums ml-1">{counts.available}</span>
          </div>
          {counts.retained > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-400/40 text-xs md:text-sm font-bold text-purple-300">
              RETAINED <span className="tabular-nums ml-1">{counts.retained}</span>
            </div>
          )}
        </div>
      </div>

      <div className="relative flex-1 px-4 md:px-6 pb-6 overflow-hidden">
        <div className="h-full rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm flex flex-col">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/15 text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/60">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-4 md:col-span-3">Player</div>
            <div className="col-span-2 hidden md:block">Category</div>
            <div className="col-span-1 hidden md:block">Role</div>
            <div className="col-span-2 text-right">Base</div>
            <div className="col-span-2 text-right">Sold</div>
            <div className="col-span-3 md:col-span-1">Team</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence initial={false}>
              {sorted.map((p, i) => {
                const team = p.teamId ? teamMap.get(p.teamId) : null;
                const color = team?.color || "#64748b";
                const cat = p.categoryId ? catMap.get(p.categoryId) : null;
                const status = statusStyle(p.status);
                return (
                  <motion.div
                    key={p.id}
                    initial={false}
                    className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center border-b border-white/5"
                    style={{
                      backgroundColor: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent",
                    }}
                  >
                    <div className="col-span-1 text-center text-xs md:text-sm font-display font-black tabular-nums text-white/40">
                      {String(i + 1).padStart(3, "0")}
                    </div>
                    <div className="col-span-4 md:col-span-3 flex items-center gap-2 md:gap-3 min-w-0">
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt={p.name} className="w-8 h-8 md:w-11 md:h-11 rounded-full object-cover flex-shrink-0 border-2 border-white/20" />
                      ) : (
                        <div className="w-8 h-8 md:w-11 md:h-11 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 md:w-5 md:h-5 text-white/40" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-display font-bold text-sm md:text-base leading-tight truncate text-white">{p.name}</p>
                        {p.city && <p className="text-[10px] md:text-xs text-white/50 truncate">{p.city}</p>}
                      </div>
                    </div>
                    <div className="col-span-2 hidden md:block min-w-0">
                      <span className="text-xs md:text-sm font-semibold text-white/70 truncate">{cat || "—"}</span>
                    </div>
                    <div className="col-span-1 hidden md:block min-w-0">
                      <span className="text-xs text-white/60 truncate">{p.role || "—"}</span>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="text-xs md:text-sm font-display font-bold tabular-nums text-white/70">{formatShortIndianRupee(p.basePrice)}</p>
                    </div>
                    <div className="col-span-2 text-right">
                      {p.soldPrice ? (
                        <p className="text-sm md:text-lg font-display font-black tabular-nums text-emerald-300">{formatShortIndianRupee(p.soldPrice)}</p>
                      ) : (
                        <span className="text-xs text-white/30">—</span>
                      )}
                    </div>
                    <div className="col-span-3 md:col-span-1 flex items-center gap-1.5 min-w-0">
                      {team ? (
                        <>
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-xs md:text-sm font-bold truncate" style={{ color }}>{team.shortCode}</span>
                        </>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-[10px] md:text-xs font-black tracking-wider border ${status.bg} ${status.border} ${status.text}`}>
                          {status.label}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
});
