import React from "react";
import { MapPin, Calendar, Trophy, Radio, Gavel } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TournamentHeaderBannerProps {
  tournament: {
    id: number;
    name: string;
    sport?: string | null;
    city?: string | null;
    venue?: string | null;
    auctionVenue?: string | null;
    tournamentVenue?: string | null;
    auctionCode?: string | null;
    auctionDate?: string | null;
    auctionTime?: string | null;
    mainBannerUrl?: string | null;
    logoUrl?: string | null;
    status?: string;
  };
  isAuctionLive?: boolean;
  isScoringLive?: boolean;
  className?: string;
}

export function TournamentHeaderBanner({
  tournament,
  isAuctionLive = false,
  isScoringLive = false,
  className,
}: TournamentHeaderBannerProps) {
  const sport = (tournament.sport || "cricket").toLowerCase();
  const isLive = isAuctionLive || isScoringLive;

  // Sport-specific fallback gradients when mainBannerUrl is missing
  const sportFallbackGradient =
    sport === "badminton"
      ? "from-indigo-950 via-slate-900 to-sky-950"
      : "from-slate-950 via-slate-900 to-slate-950";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-950 text-white shadow-xl mb-3 sm:mb-4 transition-all dark:border-white/[0.08]",
        className
      )}
      data-testid="tournament-header-banner"
    >
      {/* ── Background Layer: Banner Image or Sport Gradient ── */}
      {tournament.mainBannerUrl ? (
        <div className="absolute inset-0 z-0">
          <img
            src={tournament.mainBannerUrl}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover opacity-40 filter saturate-110"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/30" />
        </div>
      ) : (
        <div className={cn("absolute inset-0 z-0 bg-gradient-to-r opacity-90", sportFallbackGradient)}>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
        </div>
      )}

      {/* ── Foreground Content ── */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-6">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          {/* Foreground Tournament Logo Badge */}
          <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-2xl border border-white/15 bg-slate-900/90 p-1.5 shadow-xl backdrop-blur-md flex items-center justify-center overflow-hidden">
            {tournament.logoUrl ? (
              <img
                src={tournament.logoUrl}
                alt={tournament.name}
                className="h-full w-full object-contain filter drop-shadow-sm"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-amber-400 bg-amber-500/10 rounded-xl">
                <Trophy className="h-7 w-7" />
              </div>
            )}
          </div>

          {/* Title & Metadata */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/10 text-slate-200 border border-white/10">
                {tournament.sport || "Sport"}
              </span>

              {isLive ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-sm shadow-emerald-500/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                  ● LIVE NOW
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {tournament.status || "Active"}
                </span>
              )}
            </div>

            <h1 className="font-display font-black text-lg sm:text-2xl text-white truncate drop-shadow-sm">
              {tournament.name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 mt-1">
              {tournament.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {tournament.tournamentVenue || tournament.venue
                      ? `${tournament.tournamentVenue || tournament.venue}, `
                      : ""}
                    {tournament.city}
                    {tournament.auctionVenue &&
                    tournament.auctionVenue !== (tournament.tournamentVenue || tournament.venue)
                      ? ` · Auction: ${tournament.auctionVenue}`
                      : ""}
                  </span>
                </span>
              )}
              {tournament.auctionDate && (
                <span className="flex items-center gap-1 text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    {new Date(tournament.auctionDate).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TournamentHeaderBanner;
