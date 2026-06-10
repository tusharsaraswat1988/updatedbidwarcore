import { memo } from "react";
import type { LedView } from "@/lib/led-view/types";

/**
 * BID CENTER — dominant mega bid amount + leading team card + unique-bidder dots.
 * Pure presentation. Re-flashes via key on currentBid change.
 */
export const BidCenter = memo(function BidCenter({ view }: { view: LedView }) {
  const { state, leadingTeam, currentBidLabel, uniqueBidders, derivedState } = view;
  const showLeading = state.isBidding || derivedState === "sold";

  return (
    <div
      key={state.currentBid}
      className="relative flex flex-col items-center justify-center text-center px-4"
      style={{ animation: "auction-bid-flash 1.2s ease-out" }}
    >
      <span
        className="text-[10px] font-mono uppercase tracking-[0.5em] mb-2"
        style={{ color: "var(--accent)" }}
      >
        {state.currentBid > 0 ? "Current Bid" : "Opening Bid"}
      </span>

      <div
        className="font-['Bebas_Neue'] text-[clamp(4rem,11vw,12rem)] leading-[0.85] tracking-tighter tabular-nums"
        style={{
          color: "var(--stage-text)",
          animation: state.isBidding
            ? "auction-mega-glow 3s ease-in-out infinite"
            : undefined,
        }}
      >
        {currentBidLabel}
      </div>

      {/* Leading team card */}
      {showLeading && leadingTeam ? (
        <div
          className="mt-4 flex items-center gap-4 px-5 py-2 border-l-4 bg-white/95 text-black"
          style={{ borderLeftColor: leadingTeam.color }}
        >
          <span className="font-['Bebas_Neue'] text-2xl tracking-widest">
            {leadingTeam.short}
          </span>
          <div className="h-5 w-px bg-black/20" />
          <span className="text-xs font-bold uppercase tracking-wider">
            {leadingTeam.name}
          </span>
        </div>
      ) : (
        <div className="mt-4 text-white/40 text-xs font-mono uppercase tracking-[0.3em]">
          {state.isBidding ? "Waiting for first bid…" : "Awaiting auctioneer"}
        </div>
      )}

      {/* Unique bidder dots */}
      {uniqueBidders > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex -space-x-2">
            {Array.from({ length: Math.min(uniqueBidders, 5) }).map((_, i) => (
              <div
                key={i}
                className="size-6 rounded-full ring-2"
                style={{
                  background: state.teams[i % state.teams.length]?.color ?? "#444",
                  ["--tw-ring-color" as string]: "var(--stage-bg)",
                  animation: `auction-bidder-pop 0.4s ease-out ${i * 0.05}s both`,
                }}
              />
            ))}
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] ml-1 text-white/55">
            {uniqueBidders} Active {uniqueBidders === 1 ? "Bidder" : "Bidders"}
          </span>
        </div>
      )}
    </div>
  );
});
