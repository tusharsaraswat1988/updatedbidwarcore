import React, { useState } from 'react';
import { Link } from 'wouter';
import { MapPin, Calendar, ArrowRight, Trophy, Tv, Radio, Gavel, Activity } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { TournamentSummary } from '../../../lib/api/types';

interface TournamentCardProps {
  t: TournamentSummary;
}

/**
 * Sport-Specific Fallback Icon Container
 * Displays an authentic sports glyph when a tournament has no logo or its logo fails to load.
 */
function SportFallbackIcon({ sport }: { sport: string }) {
  const s = sport.toLowerCase();
  if (s === 'badminton') {
    return (
      <div className="flex flex-col items-center justify-center text-sky-500 dark:text-sky-400">
        <Activity size={32} className="stroke-[2.2]" />
        <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Badminton
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-amber-500 dark:text-amber-400">
      <Trophy size={32} className="stroke-[2.2]" />
      <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
        Cricket
      </span>
    </div>
  );
}

export const TournamentCard: React.FC<TournamentCardProps> = ({ t }) => {
  const [logoFailed, setLogoFailed] = useState(false);

  const isLive = t.status === 'LIVE' || Boolean(t.liveState?.isLive);
  const isFeatured = t.featured;
  const isStreaming = Boolean(t.streamInfo?.enabled && t.streamInfo?.streamUrl);
  const sport = (t.sport || 'cricket').toLowerCase();

  const locationDisplay = t.city
    ? t.venue
      ? `${t.venue}, ${t.city}`
      : t.city
    : t.venue;

  const hasAuction = Boolean(t.auctionEnabled);
  const hasScoring = Boolean(t.scoringEnabled);

  return (
    <Link href={`/${t.slug}`}>
      <div
        className={cn(
          "group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-amber-500/50 hover:shadow-xl dark:border-white/[0.08] dark:bg-[#131B2E]",
          isFeatured && "border-amber-500/40 ring-1 ring-amber-500/20 shadow-amber-500/5",
          isLive && "border-emerald-500/40"
        )}
      >
        {/* ── Top Identity Section: Focused Square Logo Presentation ── */}
        <div className="relative flex h-36 w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-[#0D1524] to-slate-950 p-4 border-b border-slate-100 dark:border-white/5">
          {/* Subtle Ambient Stadium Texture */}
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-amber-500/10 blur-xl" />
          <div className="pointer-events-none absolute -left-8 -bottom-8 h-28 w-28 rounded-full bg-sky-500/10 blur-xl" />

          {/* Top-Left Status Badge */}
          <div className="absolute top-2.5 left-3 z-10 flex items-center gap-1.5">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/30">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                Live Now
              </span>
            ) : (
              <span className="rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 backdrop-blur-md border border-white/10">
                {t.status}
              </span>
            )}

            {isStreaming && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md shadow-xs shadow-emerald-500/20">
                <Tv size={10} /> Stream
              </span>
            )}
          </div>

          {/* Top-Right Badges */}
          <div className="absolute top-2.5 right-3 z-10 flex items-center gap-1">
            {isFeatured && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-xs backdrop-blur-sm">
                Featured
              </span>
            )}
          </div>

          {/* ── Centered Square Tournament Logo ── */}
          <div className="relative z-10 flex h-20 w-20 sm:h-22 sm:w-22 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2 shadow-lg transition-transform duration-300 group-hover:scale-105 dark:border-amber-400/25 dark:bg-slate-900/95 ring-2 ring-black/5 dark:ring-amber-400/10">
            {t.logoUrl && !logoFailed ? (
              <img
                src={t.logoUrl}
                alt={t.name}
                className="h-full w-full object-contain filter drop-shadow-xs"
                loading="lazy"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <SportFallbackIcon sport={sport} />
            )}
          </div>
        </div>

        {/* ── Card Body ── */}
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          {/* Category & Enabled Modules */}
          <div className="mb-2 flex items-center justify-between gap-1.5">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:bg-white/[0.08] dark:text-slate-300">
              {t.sport || 'Sports'}
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {hasAuction && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  Auction
                </span>
              )}
              {hasScoring && (
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

          {/* Live Dynamic Context Snippet (Real data only) */}
          {isLive && (
            <div className="mt-2.5">
              {t.liveMatchSummary ? (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-2 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="truncate flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="truncate">{t.liveMatchSummary.scoreSummary || 'Match in Progress'}</span>
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider shrink-0 text-emerald-600 dark:text-emerald-400 ml-1">
                      Score
                    </span>
                  </div>
                </div>
              ) : t.liveAuctionSummary ? (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-2 dark:border-amber-500/20 dark:bg-amber-500/10">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                    <span className="truncate flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      <span className="truncate">{t.liveAuctionSummary.currentPlayerName ? `Bidding: ${t.liveAuctionSummary.currentPlayerName}` : 'Auction in progress'}</span>
                    </span>
                    <span className="text-[10px] font-mono uppercase shrink-0 text-amber-600 dark:text-amber-400 ml-1">
                      {t.liveAuctionSummary.currentBid ? `₹${(t.liveAuctionSummary.currentBid / 100000).toFixed(2)}L` : 'Live'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span>Active Now</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Meta Details */}
          <div className="mt-auto pt-3.5 space-y-1.5 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-white/5">
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
