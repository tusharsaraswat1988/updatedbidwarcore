import { memo } from "react";
import type { LedView } from "@/lib/led-view/types";

/**
 * BID CENTER — dominant mega bid amount + leading team card + unique-bidder dots.
 * Pure presentation. Re-flashes via key on currentBid change.
 */
export const BidCenter = memo(function BidCenter({ view }: { view: LedView }) {
  const { state, leadingTeam, currentBidLabel, uniqueBidders, derivedState, hasTeamBid } = view;
  const showLeading = state.isBidding || derivedState === "sold";
  const bidAmountLabel = hasTeamBid ? "Current Bid" : "Bid Starts At";

  return (
    <div
      key={state.currentBid}
      className="relative flex flex-col items-center justify-center text-center px-4"
      style={{ animation: "auction-bid-flash 1.2s ease-out" }}
    >
      <span
        className="led-label text-[clamp(0.95rem,1.3cqw,1.55rem)] font-extrabold uppercase tracking-[0.08em] mb-1 font-['Space_Grotesk']"
        style={{ color: "var(--accent)" }}
      >
        {bidAmountLabel}
      </span>

      <div
        className="led-hero font-['Bebas_Neue'] text-[clamp(4rem,11cqw,12rem)] leading-[0.85] tracking-tighter tabular-nums"
        style={{
          color: "var(--stage-text)",
          animation: state.isBidding
            ? "auction-mega-glow 3s ease-in-out infinite"
            : undefined,
        }}
      >
        {currentBidLabel}
      </div>

      {/* Leading team card — logo + name; label confirms highest bidder */}
      {showLeading && hasTeamBid && leadingTeam && state.currentBid > 0 ? (
        <div className="mt-5 flex flex-col items-center gap-2">
          <div
            className="flex items-center gap-[1.7cqw] px-[2.5cqw] py-[1.1cqh] border-l-[0.3cqw] bg-white/95 text-black min-h-[6.7cqh] max-w-full"
            style={{ borderLeftColor: leadingTeam.color }}
          >
            {leadingTeam.logoUrl ? (
              <img
                src={leadingTeam.logoUrl}
                alt={leadingTeam.name}
                className="h-[7.4cqh] w-[7.4cqh] shrink-0 object-contain"
              />
            ) : (
              <span className="led-team font-['Bebas_Neue'] text-[clamp(1.8rem,3.2cqw,3rem)] tracking-wider leading-none">
                {leadingTeam.short}
              </span>
            )}
            <div className="h-8 w-px bg-black/20" />
            <span className="led-team text-[clamp(1.2rem,2.1cqw,2.4rem)] font-extrabold uppercase tracking-wide leading-tight">
              {leadingTeam.name}
            </span>
          </div>
          <div
            className="led-status px-4 py-1 rounded font-['Space_Grotesk'] text-[clamp(0.95rem,1.35cqw,1.5rem)] font-black uppercase tracking-[0.08em] shadow-md flex items-center gap-2"
            style={{
              backgroundColor: leadingTeam.color || "#dc2626",
              color: "#ffffff",
            }}
          >
            <span className="size-2 rounded-full bg-white animate-pulse shrink-0" />
            Highest Bidder
          </div>
        </div>
      ) : showLeading && state.isBidding ? (
        <div className="mt-4 led-status text-[clamp(0.95rem,1.3cqw,1.45rem)] font-bold uppercase tracking-[0.06em] text-white/80">
          Waiting for first bid…
        </div>
      ) : (
        <div className="mt-4 led-status text-[clamp(0.95rem,1.3cqw,1.45rem)] font-bold uppercase tracking-[0.06em] text-white/80">
          Awaiting auctioneer
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
          <span className="led-label text-[clamp(0.85rem,1.1cqw,1.25rem)] font-bold uppercase tracking-[0.06em] ml-1 text-white/85 font-['Space_Grotesk']">
            {uniqueBidders} Active {uniqueBidders === 1 ? "Bidder" : "Bidders"}
          </span>
        </div>
      )}
    </div>
  );
});
