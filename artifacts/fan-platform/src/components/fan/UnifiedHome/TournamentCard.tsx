import React from 'react';
import { Link } from 'wouter';
import { MapPin, Calendar, ArrowRight, Trophy, Tv, Radio, Gavel } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { TournamentSummary } from '../../../lib/api/types';

export const TournamentCard = ({ t }: { t: TournamentSummary }) => {
  const isLive = t.status === 'LIVE' || Boolean(t.liveState?.isLive);
  const isFeatured = t.featured;
  const isStreaming = Boolean(t.streamInfo?.enabled && t.streamInfo?.streamUrl);
  const sport = (t.sport || 'cricket').toLowerCase();

  const locationDisplay = t.city
    ? t.venue
      ? `${t.venue}, ${t.city}`
      : t.city
    : t.venue;

  const sportFallbackBg =
    sport === 'badminton'
      ? 'from-indigo-950 via-slate-900 to-slate-950'
      : 'from-emerald-950/80 via-slate-900 to-slate-950';

  return (
    <Link href={`/${t.slug}`}>
      <div
        className={cn(
          "group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-1 hover:border-amber-500/50 hover:shadow-xl dark:border-white/[0.08] dark:bg-[#131B2E]",
          isFeatured && "border-amber-500/40 ring-1 ring-amber-500/20",
          isLive && "border-red-500/30"
        )}
      >
        {/* Card header / Artwork Container */}
        <div className="relative flex h-36 items-center justify-center overflow-hidden bg-slate-950">
          {/* Background Layer: Banner or Sport-Specific Fallback */}
          {t.mainBannerUrl ? (
            <img
              src={t.mainBannerUrl}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover opacity-50 transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className={cn("h-full w-full bg-gradient-to-br opacity-90", sportFallbackBg)} />
          )}

          {/* Contrast Scrim Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />

          {/* Foreground Tournament Logo Badge */}
          <div className="absolute bottom-2.5 left-3.5 z-10 flex items-center gap-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-slate-900/90 p-1 shadow-lg backdrop-blur-md">
              {t.logoUrl ? (
                <img
                  src={t.logoUrl}
                  alt={t.name}
                  className="h-full w-full object-contain filter drop-shadow-sm"
                  loading="lazy"
                />
              ) : (
                <Trophy size={18} className="text-amber-400" />
              )}
            </div>
          </div>

          {/* Top Badges */}
          <div className="absolute top-2.5 left-3 flex flex-wrap gap-1.5 z-10">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                Live
              </span>
            ) : (
              <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 backdrop-blur-md border border-white/10">
                {t.status}
              </span>
            )}

            {isStreaming && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md shadow-sm">
                <Tv size={10} /> Stream
              </span>
            )}
          </div>

          {isFeatured && (
            <div className="absolute top-2.5 right-3 z-10">
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/95 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-sm backdrop-blur-sm">
                Featured
              </span>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          {/* Category & Modules */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
              {t.sport || 'Sports'}
            </span>
            <div className="flex gap-1">
              {t.auctionEnabled && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  Auction
                </span>
              )}
              {t.scoringEnabled && (
                <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[9px] font-bold uppercase text-sky-700 dark:text-sky-300 border border-sky-500/20">
                  Scoring
                </span>
              )}
            </div>
          </div>

          {/* Tournament Name */}
          <h3 className="line-clamp-2 font-display text-base font-bold text-slate-900 transition-colors group-hover:text-amber-600 dark:text-white dark:group-hover:text-amber-400">
            {t.name}
          </h3>

          {/* Live Dynamic Context Snippet */}
          {isLive && (
            <div>
              {t.liveMatchSummary ? (
                <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="truncate flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      {t.liveMatchSummary.scoreSummary || 'Match in Progress'}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider shrink-0 text-emerald-600 dark:text-emerald-400">
                      Live Score
                    </span>
                  </div>
                </div>
              ) : t.liveAuctionSummary ? (
                <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-2.5 dark:border-amber-500/20 dark:bg-amber-500/10">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                    <span className="truncate flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      Lot #{t.liveAuctionSummary.currentPlayerName || 'Bidding'}
                    </span>
                    <span className="text-[10px] font-mono uppercase shrink-0 text-amber-600 dark:text-amber-400">
                      {t.liveAuctionSummary.currentBid ? `₹${(t.liveAuctionSummary.currentBid / 100000).toFixed(2)}L` : 'Auction'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 dark:border-amber-500/20 dark:bg-amber-500/10">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    <span>Tournament active now</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Meta Details */}
          <div className="mt-auto pt-4 space-y-1.5 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-white/5">
            {locationDisplay && (
              <div className="flex items-center gap-1.5 truncate">
                <MapPin size={13} className="shrink-0 text-slate-400" />
                <span className="truncate">{locationDisplay}</span>
              </div>
            )}
            {t.auctionDate && (
              <div className="flex items-center gap-1.5">
                <Calendar size={13} className="shrink-0 text-slate-400" />
                <span>
                  {new Date(t.auctionDate).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="mt-3 flex items-center justify-between pt-2 text-xs font-bold text-amber-600 group-hover:text-amber-500 dark:text-amber-400">
            <span>{isLive ? 'Follow Live' : 'View Tournament'}</span>
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </Link>
  );
};
