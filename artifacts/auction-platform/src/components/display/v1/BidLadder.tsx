import { memo } from "react";
import type { LedView } from "@/lib/led-view/types";

/**
 * BID LADDER — bottom strip, derived from state.log (type === "BID"), last 3.
 */
export const BidLadder = memo(function BidLadder({ view }: { view: LedView }) {
  const { ladder, state } = view;

  if (!state.isBidding && ladder.length === 0) {
    return (
      <div className="border-t border-white/10 px-[3%] h-full flex items-center">
        <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30">
          Bid Ladder — Awaiting Action
        </span>
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 px-[3%] h-full flex items-center gap-4">
      <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/40 shrink-0">
        Bid Ladder
      </span>
      <div className="flex-1 grid grid-cols-3 gap-3">
        {ladder.map((b, i) => (
          <div
            key={b.id}
            className="flex items-center justify-between px-3 py-2 bg-white/5 border-l-2"
            style={{ borderLeftColor: b.team.color, opacity: 1 - i * 0.22 }}
          >
            <div className="flex items-center gap-2">
              <span className="font-['Bebas_Neue'] text-lg tracking-widest">
                {b.team.short}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40 hidden @md/stage:inline">
                {b.team.name}
              </span>
            </div>
            <span className="font-mono text-sm font-bold tabular-nums">
              {b.amountLabel}
            </span>
          </div>
        ))}
        {/* Pad empty slots so layout doesn't collapse */}
        {Array.from({ length: Math.max(0, 3 - ladder.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="px-3 py-2 bg-white/[0.02] border-l-2 border-white/5 text-white/20 text-[10px] font-mono uppercase tracking-widest flex items-center"
          >
            —
          </div>
        ))}
      </div>
    </div>
  );
});
