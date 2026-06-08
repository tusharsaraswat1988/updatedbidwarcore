import { memo } from "react";
import { Trophy } from "lucide-react";
import { FullscreenButton } from "@/components/fullscreen-button";
import { SponsorCarousel } from "./sponsor-carousel";
import { useBranding } from "@/hooks/use-branding";
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
 * Top bar — tournament identity, BidWar brand, live status pill,
 * sold/left counters, sponsor carousel.
 *
 * Sized for auditorium / LED wall readability (10–50 ft).
 */
export const AuctionHeader = memo(function AuctionHeader({
  tournament,
  status,
  statusLabel,
  soldCount,
  remainingCount,
  sponsorLogos,
  themeAccent,
}: {
  tournament: TournamentLite | undefined;
  status: string | null | undefined;
  statusLabel?: string | null;
  soldCount: number;
  remainingCount: number;
  sponsorLogos: SponsorLogo[];
  themeAccent?: string;
}) {
  const isActive = status === "active" || status === "live";
  const isPaused = status === "paused";
  const isSold = status === "sold";
  const isUnsold = status === "unsold";
  const { logos, brandName } = useBranding();
  const accent = themeAccent ?? "#a78bfa";
  const auctionDateLine = formatAuctionDateLine(tournament?.auctionDate, tournament?.auctionTime);

  return (
    <div
      className={`relative flex items-center justify-between ${BROADCAST_SAFE_X} py-3 md:py-4 lg:py-5 border-b border-border/40 bg-black/50 backdrop-blur-md flex-shrink-0 gap-4 min-w-0 led-display-tv`}
      style={{ minHeight: "clamp(4.5rem, 8vh, 6.5rem)" }}
    >
      {/* Left: tournament identity */}
      <div className="flex items-center gap-3 md:gap-5 min-w-0 flex-[1.2]">
        {tournament?.logoUrl ? (
          <img
            src={cldUrl(tournament.logoUrl, "headerLogo")}
            alt={tournament.name ?? ""}
            className="h-12 w-12 md:h-16 md:w-16 lg:h-20 lg:w-20 object-contain rounded-lg flex-shrink-0"
            loading="eager"
            decoding="async"
          />
        ) : (
          <Trophy className="w-10 h-10 md:w-14 md:h-14 text-primary flex-shrink-0" />
        )}
        <div className="min-w-0">
          <div className="led-tournament-name font-display font-black text-2xl md:text-3xl lg:text-4xl xl:text-5xl tracking-tight text-white leading-tight truncate">
            {tournament?.name || "BIDWAR"}
          </div>
          {auctionDateLine && (
            <div className="text-sm md:text-base lg:text-lg xl:text-xl text-white/65 tracking-wide font-semibold truncate mt-0.5 md:mt-1">
              {auctionDateLine}
            </div>
          )}
        </div>
      </div>

      {/* Center: BidWar brand — always visible */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 flex-shrink-0 pointer-events-none hidden md:flex">
        <div
          className="flex items-center gap-2 md:gap-3 px-4 md:px-6 py-1.5 md:py-2 rounded-full"
          style={{
            backgroundColor: `${accent}22`,
            border: `2px solid ${accent}50`,
            boxShadow: `0 0 28px ${accent}25`,
          }}
        >
          <img
            src={cldUrl(logos.mini, "headerLogo") || "/bidwar-logo-transparent.webp"}
            alt={brandName}
            className="h-8 md:h-10 lg:h-12 w-auto flex-shrink-0"
            loading="eager"
            decoding="async"
          />
          <span className="font-display font-black text-lg md:text-xl lg:text-2xl tracking-widest text-white uppercase">
            {brandName.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Right: status + stats + sponsor */}
      <div className="flex items-center gap-3 md:gap-6 flex-shrink-0 flex-1 justify-end min-w-0">
        <FullscreenButton
          size="sm"
          className="p-2 md:p-2.5 rounded-lg border border-white/15 text-white/55 hover:text-white hover:bg-white/10 transition-colors hidden lg:flex"
        />
        <div
          className={`flex items-center gap-2 md:gap-3 px-3 md:px-5 py-1.5 md:py-2 rounded-full border ${
            isSold ? "bg-green-500/20 border-green-500/40 text-green-400" :
            isUnsold ? "bg-red-500/20 border-red-500/40 text-red-400" :
            isActive ? "bg-green-500/20 border-green-500/40 text-green-400" :
            isPaused ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400" :
            "bg-border/30 border-border text-white/70"
          }`}
        >
          {(isActive || isSold || isUnsold) && (
            <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full animate-pulse ${isUnsold ? "bg-red-500" : "bg-green-500"}`} />
          )}
          <span className="text-base md:text-xl lg:text-2xl font-bold uppercase tracking-widest whitespace-nowrap">
            {statusLabel || status || "IDLE"}
          </span>
        </div>
        <div className="led-auction-stats text-xl md:text-2xl lg:text-3xl text-white/90 font-mono tabular-nums whitespace-nowrap">
          <span className="text-green-400 font-black">{soldCount}</span>
          <span className="text-white/50 font-semibold mx-1">Sold</span>
          <span className="text-white/35 mx-1">·</span>
          <span className="text-white font-black">{remainingCount}</span>
          <span className="text-white/50 font-semibold ml-1">Left</span>
        </div>
        {sponsorLogos.length > 0 && (
          <div className="border-l border-white/15 pl-4 md:pl-6 hidden sm:block">
            <SponsorCarousel logos={sponsorLogos} />
          </div>
        )}
      </div>
    </div>
  );
});
