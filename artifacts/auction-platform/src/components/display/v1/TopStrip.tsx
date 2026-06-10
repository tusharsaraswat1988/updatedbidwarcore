import { memo } from "react";
import type { LedView } from "@/lib/led-view/types";

/**
 * TOP STRIP — BIDWAR LIVE brand, tournament line, LIVE pill, remaining counter.
 * Pure presentation. Sourced from TOURNAMENT + state.isBidding + queue.length.
 */
export const TopStrip = memo(function TopStrip({ view }: { view: LedView }) {
  const { tournament, state, remaining, totalPlayers } = view;
  const paused = view.derivedState === "paused";
  const live = state.isBidding && !paused;

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-6 px-[3%] h-full border-b border-white/10 bg-black/40">
      {/* Left: brand mark + tournament */}
      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{ backgroundColor: "var(--accent)" }}
        >
          <span
            className="font-['Bebas_Neue'] text-xl tracking-[0.2em] italic"
            style={{ color: "var(--accent-on)" }}
          >
            BIDWAR
          </span>
          <span
            className="font-['Bebas_Neue'] text-xl tracking-[0.2em] italic"
            style={{ color: "var(--accent-on)" }}
          >
            LIVE
          </span>
        </div>
        <div className="hidden md:flex flex-col leading-none border-l border-white/15 pl-4">
          <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/45">
            Tournament
          </span>
          <span className="font-['Bebas_Neue'] text-base tracking-widest uppercase text-white/95 mt-1">
            {tournament.name}
          </span>
        </div>
      </div>

      {/* Center: LIVE pill */}
      <div className="flex items-center justify-center">
        <div
          className={`flex items-center gap-2 px-4 py-1.5 border ${
            live
              ? "border-red-500/50 bg-red-500/10"
              : paused
                ? "border-amber-400/50 bg-amber-400/10"
                : "border-white/15 bg-white/5"
          }`}
        >
          <span
            className={`size-2 rounded-full ${
              live
                ? "bg-red-500 animate-pulse shadow-[0_0_12px_#ef4444]"
                : paused
                  ? "bg-amber-400 shadow-[0_0_10px_#fbbf24]"
                  : "bg-white/40"
            }`}
          />
          <span
            className={`text-[10px] font-mono uppercase tracking-[0.4em] ${
              live ? "text-red-300" : paused ? "text-amber-300" : "text-white/55"
            }`}
          >
            {live ? "Live · Bidding Open" : paused ? "Paused" : "Awaiting"}
          </span>
        </div>
      </div>

      {/* Right: remaining players */}
      <div className="flex flex-col items-end leading-none">
        <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/45">
          Players Remaining
        </span>
        <span className="font-['Bebas_Neue'] text-2xl tabular-nums mt-1 text-white/95">
          <span style={{ color: "var(--accent)" }}>{remaining}</span>
          <span className="text-white/40"> / {totalPlayers}</span>
        </span>
      </div>
    </div>
  );
});
