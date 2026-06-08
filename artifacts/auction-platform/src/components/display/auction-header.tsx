import { memo } from "react";
import { Trophy } from "lucide-react";
import { FullscreenButton } from "@/components/fullscreen-button";
import { SponsorCarousel } from "./sponsor-carousel";
import { cldUrl } from "@/lib/cloudinary";
import { BROADCAST_SAFE_X } from "@/lib/display-broadcast-layout";
import type { SponsorLogo } from "@/lib/sponsor-logo";

type TournamentLite = {
  name?: string | null;
  logoUrl?: string | null;
  auctionDate?: string | null;
  auctionTime?: string | null;
};

function formatAuctionDateLine(date?: string | null, time?: string | null): string | null {
  if (!date) return null;
  const formatted = new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return time ? `${formatted} · ${time}` : formatted;
}

/**
 * Top bar — 3-column grid, no overlapping center brand.
 * Tournament identity | live stats | sponsor carousel.
 */
export const AuctionHeader = memo(function AuctionHeader({
  tournament,
  status,
  statusLabel,
  soldCount,
  remainingCount,
  sponsorLogos,
  compact = false,
}: {
  tournament: TournamentLite | undefined;
  status: string | null | undefined;
  statusLabel?: string | null;
  soldCount: number;
  remainingCount: number;
  sponsorLogos: SponsorLogo[];
  themeAccent?: string;
  /** Hide status pill during full-screen sold/unsold overlay */
  compact?: boolean;
}) {
  const isActive = status === "active" || status === "live";
  const isPaused = status === "paused";
  const isSold = status === "sold";
  const isUnsold = status === "unsold";
  const auctionDateLine = formatAuctionDateLine(tournament?.auctionDate, tournament?.auctionTime);

  return (
    <div
      className={`${BROADCAST_SAFE_X} py-3 md:py-4 border-b border-border/40 bg-black/55 backdrop-blur-md flex-shrink-0 led-display-tv`}
      style={{ minHeight: compact ? "clamp(3.5rem, 6vh, 5rem)" : "clamp(4.5rem, 8vh, 6.5rem)" }}
    >
      <div className="grid grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1fr)] items-center gap-3 md:gap-6 w-full">
        {/* Left: tournament identity — wraps to 2 lines, never overlaps center */}
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          {tournament?.logoUrl ? (
            <img
              src={cldUrl(tournament.logoUrl, "headerLogo")}
              alt={tournament.name ?? ""}
              className="h-11 w-11 md:h-16 md:w-16 lg:h-[4.5rem] lg:w-[4.5rem] object-contain rounded-lg flex-shrink-0"
              loading="eager"
              decoding="async"
            />
          ) : (
            <Trophy className="w-10 h-10 md:w-14 md:h-14 text-primary flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div
              className="led-tournament-name font-display font-black tracking-tight text-white leading-[1.1] line-clamp-2"
              style={{ fontSize: "clamp(1.15rem, 2.2vw, 2.75rem)" }}
            >
              {tournament?.name || "BIDWAR"}
            </div>
            {auctionDateLine && (
              <div
                className="text-white/70 font-semibold mt-0.5 md:mt-1 line-clamp-1"
                style={{ fontSize: "clamp(0.8rem, 1.1vw, 1.35rem)" }}
              >
                {auctionDateLine}
              </div>
            )}
          </div>
        </div>

        {/* Center: status + counters — fixed column, no overlap */}
        <div className="flex flex-col items-center justify-center gap-1.5 md:gap-2 flex-shrink-0 px-2">
          {!compact && (
            <div
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full border whitespace-nowrap ${
                isSold ? "bg-green-500/20 border-green-500/40 text-green-400" :
                isUnsold ? "bg-red-500/20 border-red-500/40 text-red-400" :
                isActive ? "bg-green-500/20 border-green-500/40 text-green-400" :
                isPaused ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400" :
                "bg-border/30 border-border text-white/70"
              }`}
            >
              {(isActive || isSold || isUnsold) && (
                <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${isUnsold ? "bg-red-500" : "bg-green-500"}`} />
              )}
              <span
                className="font-bold uppercase tracking-widest"
                style={{ fontSize: "clamp(0.85rem, 1.4vw, 1.5rem)" }}
              >
                {statusLabel || status || "IDLE"}
              </span>
            </div>
          )}
          <div
            className="led-auction-stats text-white/90 font-mono tabular-nums whitespace-nowrap"
            style={{ fontSize: "clamp(1.1rem, 2vw, 2.25rem)" }}
          >
            <span className="text-green-400 font-black">{soldCount}</span>
            <span className="text-white/50 font-semibold mx-1">Sold</span>
            <span className="text-white/35 mx-1">·</span>
            <span className="text-white font-black">{remainingCount}</span>
            <span className="text-white/50 font-semibold ml-1">Left</span>
          </div>
        </div>

        {/* Right: sponsor + fullscreen */}
        <div className="flex items-center justify-end gap-3 md:gap-5 min-w-0">
          {sponsorLogos.length > 0 && (
            <SponsorCarousel logos={sponsorLogos} />
          )}
          <FullscreenButton
            size="sm"
            className="p-2 rounded-lg border border-white/15 text-white/55 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 hidden lg:flex"
          />
        </div>
      </div>
    </div>
  );
});
