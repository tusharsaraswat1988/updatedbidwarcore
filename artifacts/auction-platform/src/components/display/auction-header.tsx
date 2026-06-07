import { memo } from "react";
import { Trophy } from "lucide-react";
import { SponsorCarousel } from "./sponsor-carousel";
import { useBranding } from "@/hooks/use-branding";
import { cldUrl } from "@/lib/cloudinary";
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
 * Render isolation: receives only the slices it needs (status,
 * soldCount, remainingCount, tournament, sponsorLogos). React.memo'd
 * so bid/timer pulses below the bar never reach it. The sponsor
 * carousel further isolates its 2s rotation inside its own subtree.
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
    <div className="relative flex items-center justify-between px-4 md:px-8 py-2 border-b border-border/40 bg-black/40 backdrop-blur-sm flex-shrink-0 gap-3 min-w-0">
      {/* Left: tournament identity */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {tournament?.logoUrl ? (
          <img
            src={cldUrl(tournament.logoUrl, "headerLogo")}
            alt={tournament.name ?? ""}
            className="h-10 w-10 md:h-14 md:w-14 object-contain rounded-lg flex-shrink-0"
            loading="eager"
            decoding="async"
          />
        ) : (
          <Trophy className="w-8 h-8 md:w-10 md:h-10 text-primary flex-shrink-0" />
        )}
        <div className="min-w-0">
          <div className="font-display font-black text-base md:text-xl tracking-tight text-white leading-none truncate">
            {tournament?.name || "BIDWAR"}
          </div>
          {auctionDateLine && (
            <div className="text-[10px] md:text-xs text-muted-foreground tracking-widest uppercase truncate hidden sm:block">
              {auctionDateLine}
            </div>
          )}
        </div>
      </div>

      {/* Center: BidWar brand — always visible */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 flex-shrink-0 pointer-events-none">
        <div
          className="flex items-center gap-2 px-4 py-1 rounded-full"
          style={{
            backgroundColor: `${accent}18`,
            border: `1px solid ${accent}40`,
          }}
        >
          <img
            src={cldUrl(logos.mini, "headerLogo") || "/bidwar-logo-transparent.webp"}
            alt={brandName}
            className="h-7 md:h-9 w-auto flex-shrink-0"
            loading="eager"
            decoding="async"
          />
          <span className="font-display font-black text-base md:text-lg tracking-widest text-white uppercase">{brandName.toUpperCase()}</span>
        </div>
      </div>

      {/* Right: status + stats + sponsor */}
      <div className="flex items-center gap-2 md:gap-5 flex-shrink-0 flex-1 justify-end">
        <div className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-4 py-1 md:py-1.5 rounded-full border ${
          isSold ? "bg-green-500/20 border-green-500/40 text-green-400" :
          isUnsold ? "bg-red-500/20 border-red-500/40 text-red-400" :
          isActive ? "bg-green-500/20 border-green-500/40 text-green-400" :
          isPaused ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400" :
          "bg-border/30 border-border text-white/70"
        }`}>
          {(isActive || isSold || isUnsold) && (
            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full animate-pulse ${isUnsold ? "bg-red-500" : "bg-green-500"}`} />
          )}
          <span className="text-xs md:text-sm font-bold uppercase tracking-widest">{statusLabel || status || "IDLE"}</span>
        </div>
        <div className="text-sm text-white/75 font-mono tabular-nums hidden sm:block">
          <span className="text-green-400 font-bold">{soldCount}</span> Sold
          {" · "}
          <span className="text-muted-foreground">{remainingCount}</span> Left
        </div>
        {sponsorLogos.length > 0 && (
          <div className="border-l border-border/40 pl-3 md:pl-5 hidden md:block">
            <SponsorCarousel logos={sponsorLogos} />
          </div>
        )}
      </div>
    </div>
  );
});
