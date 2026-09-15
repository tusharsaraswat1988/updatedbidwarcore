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
        <span className="led-label text-[clamp(0.9rem,1.2cqw,1.35rem)] font-bold uppercase tracking-[0.06em] text-white/75 font-['Space_Grotesk']">
          Bid Ladder — Awaiting Action
        </span>
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 px-[3%] h-full flex items-center gap-4">
      <span className="led-label text-[clamp(0.9rem,1.2cqw,1.35rem)] font-extrabold uppercase tracking-[0.06em] text-white/85 font-['Space_Grotesk'] shrink-0">
        Bid Ladder
      </span>
      <div className="flex-1 grid grid-cols-3 gap-3">
        {ladder.map((b, i) => (
          <div
            key={b.id}
            className="flex items-center justify-between px-3 py-2 bg-white/10 border-l-4"
            style={{ borderLeftColor: b.team.color, opacity: 1 - i * 0.18 }}
          >
            <div className="flex items-center gap-2">
              <span className="led-team font-['Bebas_Neue'] text-[clamp(1.15rem,1.65cqw,1.85rem)] font-bold tracking-wider text-white">
                {b.team.short}
              </span>
              <span className="led-team text-[clamp(0.95rem,1.3cqw,1.45rem)] font-bold uppercase text-white/90 hidden @md/stage:inline font-['Barlow_Condensed']">
                {b.team.name}
              </span>
            </div>
            <span
              className="led-value font-mono text-[clamp(1.1rem,1.6cqw,1.85rem)] font-black tabular-nums"
              style={{ color: "var(--accent)" }}
            >
              {b.amountLabel}
            </span>
          </div>
        ))}
        {/* Pad empty slots so layout doesn't collapse */}
        {Array.from({ length: Math.max(0, 3 - ladder.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="px-3 py-2 bg-white/[0.04] border-l-4 border-white/10 text-white/40 text-[clamp(0.9rem,1.2cqw,1.3rem)] font-mono font-bold uppercase tracking-widest flex items-center"
          >
            —
          </div>
        ))}
      </div>
    </div>
  );
});
