import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'wouter';
import {
  Trophy,
  Calendar,
  MapPin,
  ArrowRight,
  Radio,
  Gavel,
  Tv,
  ExternalLink,
  Shield,
  Activity,
  Crown,
  Clock,
  Sparkles,
} from 'lucide-react';
import { TournamentSummary } from '../../../lib/api/types';
import { WatchLiveModal } from '../watch-live-modal';
import { isTestStreamUrl } from '../../../lib/stream-utils';
import {
  parseSponsorLogos,
  getSponsorsByPriority,
  SponsorPriorityType,
  type PrioritizedSponsor,
} from '@workspace/api-base/sponsor-priority';
import { cldUrl } from '../../../lib/cloudinary';
import { cn } from '../../../lib/utils';

interface FeaturedHeroProps {
  t: TournamentSummary;
}

export const FeaturedTournamentHero: React.FC<FeaturedHeroProps> = ({ t }) => {
  // Local live score state updated via SSE when a live match is active
  const [liveScore, setLiveScore] = useState<string | null>(
    t.liveMatchSummary?.scoreSummary ?? null,
  );
  const [liveTarget, setLiveTarget] = useState<string | null>(
    t.liveMatchSummary?.targetSummary ?? null,
  );
  const [watchLiveOpen, setWatchLiveOpen] = useState(false);

  const sport = (t.sport || 'cricket').toLowerCase();
  const isBadminton = sport === 'badminton';

  // Determine current active mode
  const isMatchLive = Boolean(
    t.liveState?.isLive && (t.liveState?.primaryLiveType === 'match' || t.liveMatchSummary),
  );
  const isAuctionLive = Boolean(
    t.liveState?.isLive && (t.liveState?.primaryLiveType === 'auction' || t.liveAuctionSummary),
  );
  const hasValidStream = Boolean(
    t.streamInfo?.enabled &&
      t.streamInfo?.streamUrl &&
      !isTestStreamUrl(t.streamInfo.streamUrl),
  );
  const isCompleted = t.status === 'COMPLETED';
  const isUpcoming = t.status === 'UPCOMING' || t.status === 'TODAY';

  // Extract all featured tournament sponsors prioritized
  const allSponsors = useMemo(() => {
    if (!t.sponsorLogos) return [];
    try {
      const parsed = parseSponsorLogos(t.sponsorLogos);
      return getSponsorsByPriority(parsed);
    } catch {
      return [];
    }
  }, [t.sponsorLogos]);

  // Group sponsors into batches of 4 each
  const sponsorBatches = useMemo(() => {
    if (allSponsors.length === 0) return [];
    const batches: PrioritizedSponsor[][] = [];
    const batchSize = 4;
    for (let i = 0; i < allSponsors.length; i += batchSize) {
      batches.push(allSponsors.slice(i, i + batchSize));
    }
    return batches;
  }, [allSponsors]);

  // Dynamic 3-second sponsor rotation when > 4 sponsors exist
  const [activeBatchIndex, setActiveBatchIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (sponsorBatches.length <= 1) return;

    const interval = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setActiveBatchIndex((prev) => (prev + 1) % sponsorBatches.length);
        setIsFading(false);
      }, 250);
    }, 3000);

    return () => clearInterval(interval);
  }, [sponsorBatches.length]);

  const currentBatchSponsors = sponsorBatches[activeBatchIndex] || [];

  // Score display helper: parse main score (e.g. "0/0") and overs (e.g. "(0 ov)") to prevent awkward 2-row breaks
  const fullScoreStr = liveScore || t.liveMatchSummary?.scoreSummary || (isBadminton ? 'Game On' : '0/0 (0 ov)');
  const parsedScore = useMemo(() => {
    const s = (fullScoreStr || '').trim();
    const m = s.match(/^([^\(]+)(\(.*?\))?$/);
    if (m) {
      return {
        main: m[1].trim(),
        overs: m[2] ? m[2].trim() : '',
      };
    }
    return { main: s, overs: '' };
  }, [fullScoreStr]);

  // Real-time SSE listener scoped strictly to the featured live match
  useEffect(() => {
    const matchId = t.liveMatchSummary?.matchId;
    if (!isMatchLive || !matchId || !t.id) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/tournaments/${t.id}/scoring/events`);
      const handleState = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          const innings =
            payload?.state?.innings?.[0] || payload?.innings?.[0] || payload?.summary?.innings;
          if (innings && typeof innings.runs === 'number') {
            setLiveScore(`${innings.runs}/${innings.wickets ?? 0} (${innings.overs ?? 0} ov)`);
          } else if (payload?.summary?.currentScore) {
            setLiveScore(payload.summary.currentScore);
          }
        } catch {
          // ignore parse errors
        }
      };
      es.addEventListener('scoring_state', handleState);
      es.onmessage = handleState;
    } catch {
      // EventSource not supported
    }

    return () => {
      if (es) {
        es.close();
      }
    };
  }, [t.id, t.liveMatchSummary?.matchId, isMatchLive]);

  // Sport-specific fallback background
  const sportFallbackBg = isBadminton
    ? 'from-indigo-950 via-slate-900 to-slate-950'
    : 'from-slate-900 via-slate-950 to-slate-950';

  return (
    <section className="relative mb-6 sm:mb-8 overflow-hidden rounded-2xl sm:rounded-3xl border border-amber-500/35 bg-gradient-to-br from-[#080E1C] via-[#0E172E] to-[#0A1224] text-white shadow-2xl transition-all dark:border-amber-400/30">
      {/* ── Top subtle gold highlight ── */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/80 to-transparent z-10" />

      {/* ── Traveling Star Sparkle Orbiting Along Border (Authentic 4-Point Concave Needle Diamond Sparkle Star) ── */}
      <div className="animate-border-sparkle -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="relative flex items-center justify-center animate-spin [animation-duration:6s]">
          {/* Primary Sharp 4-Point Star with Curved Needle Points */}
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 text-amber-200 fill-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.95)]"
          >
            <path d="M12 0C12 7.2 14.8 12 24 12C14.8 12 12 16.8 12 24C12 16.8 9.2 12 0 12C9.2 12 12 7.2 12 0Z" />
          </svg>
          {/* Secondary 4-Point Star Rotated at 45° for Brilliant 8-Point Diamond Twinkle */}
          <svg
            viewBox="0 0 24 24"
            className="absolute h-4 w-4 rotate-45 text-yellow-100 fill-white drop-shadow-[0_0_6px_rgba(255,255,255,1)] opacity-95"
          >
            <path d="M12 0C12 7.2 14.8 12 24 12C14.8 12 12 16.8 12 24C12 16.8 9.2 12 0 12C9.2 12 12 7.2 12 0Z" />
          </svg>
          {/* Brilliant Pinpoint Center Core */}
          <div className="absolute h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_6px_#fff]" />
        </div>
      </div>

      {/* ── Background Layer: Clean Dark Stadium Backdrop (No Beams or Radial Glows) ── */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {t.mainBannerUrl ? (
          <img
            src={t.mainBannerUrl}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover opacity-25"
          />
        ) : (
          <div className="h-full w-full bg-[#080E1C]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080E1C] via-[#080E1C]/85 to-[#080E1C]/90" />
      </div>

      <div className="relative z-10 grid grid-cols-1 gap-5 sm:gap-6 p-4 sm:p-5 md:p-6 lg:p-7 lg:grid-cols-12 lg:items-center">
        {/* ── Left Column: Headline Tournament Identity ── */}
        <div className="lg:col-span-7 flex flex-col justify-between min-w-0">
          {/* Header pill / badge */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-gradient-to-r from-amber-500/25 via-yellow-400/20 to-amber-500/25 px-3 py-0.5 text-[11px] font-black uppercase tracking-widest text-amber-300 shadow-sm">
              <Sparkles size={12} className="text-amber-300 animate-pulse" />
              <span>Featured Spotlight</span>
            </span>

            {isMatchLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-300 shadow-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                </span>
                ● Live Match
              </span>
            ) : isAuctionLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/25 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-amber-300 shadow-sm">
                <Gavel size={13} className="animate-bounce" />
                ● Live Auction
              </span>
            ) : hasValidStream ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest text-emerald-300">
                <Tv size={13} />
                Featured · Broadcast Stream
              </span>
            ) : isCompleted ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest text-emerald-400">
                <Trophy size={13} />
                Featured · Tournament Results
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                {t.status || 'Active'}
              </span>
            )}

            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white border border-white/20">
              {t.sport || 'Sports'}
            </span>
          </div>

          {/* Foreground Tournament Logo & Name */}
          <div className="mb-3.5 flex items-center gap-3.5 sm:gap-4">
            <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-amber-400/70 bg-slate-900/90 p-1.5 sm:p-2 shadow-xl backdrop-blur-xl ring-2 ring-amber-400/15 transition-transform hover:scale-105 duration-200">
              {t.logoUrl ? (
                <img
                  src={t.logoUrl}
                  alt={t.name}
                  className="h-full w-full object-contain filter drop-shadow-md"
                />
              ) : (
                <Trophy size={32} className="text-amber-400" />
              )}
            </div>

            <div className="min-w-0">
              <h1 className="font-display text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black leading-tight tracking-tight text-white uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] line-clamp-2">
                {t.name}
              </h1>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-slate-300">
                {t.venue && (
                  <div className="flex items-center gap-1">
                    <MapPin size={13} className="text-amber-400 shrink-0" />
                    <span className="font-medium text-slate-200">
                      {t.venue}
                      {t.city ? `, ${t.city}` : ''}
                    </span>
                  </div>
                )}
                {t.auctionDate && (
                  <div className="flex items-center gap-1">
                    <Calendar size={13} className="text-amber-400 shrink-0" />
                    <span className="text-slate-300 font-medium">
                      {new Date(t.auctionDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modules enabled */}
          <div className="mb-3.5 flex flex-wrap gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
            {t.auctionEnabled && (
              <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-amber-300 border border-amber-500/30">
                Auction
              </span>
            )}
            {t.scoringEnabled && (
              <span className="rounded-full bg-sky-500/20 px-2.5 py-0.5 text-sky-300 border border-sky-500/30">
                Sports Scoring
              </span>
            )}
            {hasValidStream && (
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Radio size={11} className="animate-pulse" /> Live Stream
              </span>
            )}
          </div>

          {/* ── Dynamic 3-Second Rotating Featured Sponsor Bar (No Mobile Overflow) ── */}
          {allSponsors.length > 0 && (
            <div className="mb-4 flex items-center gap-2 sm:gap-3 py-1.5 px-3 rounded-xl bg-slate-900/80 border border-white/10 max-w-full overflow-hidden backdrop-blur-xl shadow-md">
              <div className="flex items-center gap-1 text-slate-400 shrink-0">
                <Shield size={12} className="text-amber-400 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                  Partners:
                </span>
              </div>

              {/* Rotating Logo Carousel (Fades every 3s if > 4 logos) */}
              <div
                className={cn(
                  'flex items-center gap-1.5 sm:gap-2 transition-all duration-300 min-w-0 overflow-hidden',
                  isFading ? 'opacity-0 scale-95' : 'opacity-100 scale-100',
                )}
              >
                {currentBatchSponsors.map((sp, idx) => {
                  const isTitle =
                    sp.priorityType === SponsorPriorityType.TITLE ||
                    (sp.type || '').toLowerCase().includes('title');
                  const isCo =
                    sp.priorityType === SponsorPriorityType.CO_SPONSOR ||
                    (sp.type || '').toLowerCase().includes('co');
                  return (
                    <div
                      key={`${sp.url}-${idx}`}
                      className="flex items-center group/sp cursor-pointer shrink-0"
                      title={`${sp.name || 'Sponsor'} (${sp.type || 'Partner'})`}
                    >
                      <div
                        className={cn(
                          'h-6 w-10 sm:h-7 sm:w-11 rounded-lg bg-white p-0.5 flex items-center justify-center shadow-sm transition-transform duration-200 group-hover/sp:scale-105',
                          isTitle
                            ? 'ring-2 ring-amber-400 shadow-amber-500/20'
                            : isCo
                            ? 'ring-1.5 ring-sky-400 shadow-sky-500/20'
                            : 'border border-slate-200',
                        )}
                      >
                        <img
                          src={cldUrl(sp.url, 'headerLogo') || sp.url}
                          alt={sp.name || 'Sponsor'}
                          className="max-h-full max-w-full object-contain filter drop-shadow-xs"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Dots if > 1 batch */}
              {sponsorBatches.length > 1 && (
                <div className="flex items-center gap-1 pl-1.5 border-l border-white/15 shrink-0">
                  {sponsorBatches.map((_, bIdx) => (
                    <span
                      key={bIdx}
                      className={cn(
                        'h-1.5 rounded-full transition-all duration-300',
                        bIdx === activeBatchIndex ? 'w-3 bg-amber-400' : 'w-1.5 bg-white/20',
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`/${t.slug}`}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-5 sm:px-6 py-2.5 sm:py-3 font-black text-slate-950 uppercase tracking-wider text-xs sm:text-sm shadow-xl shadow-amber-500/25 transition-all hover:shadow-amber-500/40 hover:scale-[1.02] cursor-pointer duration-200"
            >
              <span>
                {isMatchLive
                  ? isBadminton
                    ? 'Open Live Matches'
                    : 'Open Live Scorecard'
                  : isAuctionLive
                  ? 'Open Live Auction'
                  : 'Enter Fan Arena'}
              </span>
              <ArrowRight size={16} />
            </Link>

            {hasValidStream && t.streamInfo?.streamUrl && (
              <>
                <button
                  type="button"
                  onClick={() => setWatchLiveOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/50 bg-emerald-600/20 px-4 py-2.5 font-semibold text-xs sm:text-sm text-emerald-300 backdrop-blur-sm transition-all hover:bg-emerald-600/30 hover:text-white cursor-pointer shadow-md shadow-emerald-500/10"
                  aria-label="Watch live stream broadcast"
                >
                  <Tv size={15} />
                  <span>Watch Live</span>
                  <ExternalLink size={13} className="opacity-70" />
                </button>
                <WatchLiveModal
                  isOpen={watchLiveOpen}
                  onClose={() => setWatchLiveOpen(false)}
                  tournamentName={t.name}
                  streamUrl={t.streamInfo.streamUrl}
                  isLive={isMatchLive || isAuctionLive}
                />
              </>
            )}
          </div>
        </div>

        {/* ── Right Column: Dynamic Adaptive Primetime Arena Card ── */}
        <div className="lg:col-span-5 min-w-0">
          {/* 1. Live Match Head-to-Head Arena Card (Cricket / Badminton) */}
          {isMatchLive && t.liveMatchSummary && (
            <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/90 via-slate-900/95 to-slate-950/95 p-3.5 sm:p-4.5 md:p-5 shadow-2xl shadow-black/60 backdrop-blur-xl">
              {/* Top ambient highlight line */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500/60 via-yellow-400/80 to-amber-500/60" />

              {/* Arena Header */}
              <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2.5">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Activity size={14} className="animate-pulse" />
                  <span>
                    {t.liveMatchSummary.matchLabel || (isBadminton ? 'Court 1 Live' : 'Match Arena')}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  </span>
                  Scoring Live
                </span>
              </div>

              {/* VS Battle Arena: Team 1 vs Team 2 */}
              <div className="my-3 flex items-center justify-between gap-1.5 sm:gap-2.5">
                {/* Team 1 (Home) */}
                <div className="flex flex-col items-center text-center shrink-0 w-16 sm:w-20">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white p-1 shadow-md border border-slate-200 flex items-center justify-center overflow-hidden mb-1">
                    {t.liveMatchSummary.homeTeam.logoUrl ? (
                      <img
                        src={t.liveMatchSummary.homeTeam.logoUrl}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="font-display font-black text-slate-900 text-sm sm:text-base">
                        {t.liveMatchSummary.homeTeam.shortName || 'HOM'}
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-[11px] sm:text-xs text-white line-clamp-1 max-w-full">
                    {t.liveMatchSummary.homeTeam.name}
                  </span>
                </div>

                {/* Scoreboard Centerpiece (Flexible width, single row, ample space) */}
                <div className="flex-1 min-w-0 flex flex-col items-center text-center px-1">
                  <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                    LIVE SCORE
                  </span>
                  <div className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-950/90 border border-amber-400/50 shadow-inner shadow-black/80 w-full flex flex-col items-center justify-center">
                    <div className="flex items-baseline justify-center gap-1 sm:gap-1.5 whitespace-nowrap">
                      <span className="font-display text-xl sm:text-2xl font-black text-amber-400 tracking-tight drop-shadow-[0_0_10px_rgba(245,158,11,0.5)] leading-none">
                        {parsedScore.main}
                      </span>
                      {parsedScore.overs && (
                        <span className="font-display font-bold text-xs sm:text-sm text-amber-300/85 leading-none">
                          {parsedScore.overs}
                        </span>
                      )}
                    </div>
                    {liveTarget ? (
                      <p className="text-[9px] sm:text-[10px] font-bold text-emerald-400 mt-0.5 truncate max-w-full">{liveTarget}</p>
                    ) : (
                      <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 mt-0.5 uppercase tracking-widest">
                        Innings 1
                      </span>
                    )}
                  </div>
                </div>

                {/* Team 2 (Away) */}
                <div className="flex flex-col items-center text-center shrink-0 w-16 sm:w-20">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white p-1 shadow-md border border-slate-200 flex items-center justify-center overflow-hidden mb-1">
                    {t.liveMatchSummary.awayTeam.logoUrl ? (
                      <img
                        src={t.liveMatchSummary.awayTeam.logoUrl}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="font-display font-black text-slate-900 text-sm sm:text-base">
                        {t.liveMatchSummary.awayTeam.shortName || 'AWY'}
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-[11px] sm:text-xs text-white line-clamp-1 max-w-full">
                    {t.liveMatchSummary.awayTeam.name}
                  </span>
                </div>
              </div>

              {/* Action Link */}
              <Link
                href={`/${t.slug}`}
                className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs font-black uppercase tracking-wider text-amber-400 hover:text-amber-300 transition-colors py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10"
              >
                <span>
                  {isBadminton
                    ? 'Open Live Matches & Courts'
                    : 'Open Live Scorecard & Ball-by-Ball'}
                </span>
                <ArrowRight size={13} />
              </Link>
            </div>
          )}

          {/* 2. Live Auction Hammer Card */}
          {isAuctionLive && t.liveAuctionSummary && !isMatchLive && (
            <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-amber-500/40 bg-gradient-to-b from-slate-900/90 via-slate-900/95 to-slate-950/95 p-3.5 sm:p-4.5 md:p-5 shadow-[0_0_35px_rgba(245,158,11,0.18)] backdrop-blur-xl">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />

              <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Gavel size={14} /> On The Hammer
                </span>
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  {t.liveAuctionSummary.soldCount} Sold · {t.liveAuctionSummary.unsoldCount} Unsold
                </span>
              </div>

              <div className="my-3 flex items-center gap-3 sm:gap-4">
                {t.liveAuctionSummary.currentPlayerPhotoUrl ? (
                  <img
                    src={t.liveAuctionSummary.currentPlayerPhotoUrl}
                    alt={t.liveAuctionSummary.currentPlayerName || 'Player'}
                    className="h-16 w-16 sm:h-18 sm:w-18 rounded-xl object-cover border-2 border-amber-400/50 shadow-md ring-2 ring-amber-400/20 shrink-0"
                  />
                ) : (
                  <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-xl bg-amber-500/10 border-2 border-amber-400/50 flex items-center justify-center text-amber-400 font-display font-black text-xl shrink-0">
                    {t.liveAuctionSummary.currentPlayerName?.slice(0, 1) || 'P'}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-display text-base sm:text-lg font-black text-white truncate uppercase">
                    {t.liveAuctionSummary.currentPlayerName || 'Player on Deck'}
                  </p>
                  <p className="text-xs text-slate-400 font-medium truncate">
                    {t.liveAuctionSummary.currentPlayerRole ||
                      t.liveAuctionSummary.currentPlayerCategory ||
                      'Auction Pool'}
                  </p>

                  <div className="mt-1.5">
                    <span className="text-[9px] uppercase font-bold text-slate-400">
                      Current Hammer Bid
                    </span>
                    <p className="font-display text-xl sm:text-2xl font-black text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)] leading-tight">
                      {t.liveAuctionSummary.currentBid
                        ? `₹${(t.liveAuctionSummary.currentBid / 100000).toFixed(2)} Lakhs`
                        : 'Awaiting opening bid'}
                    </p>
                    {t.liveAuctionSummary.currentBidTeamName && (
                      <p className="text-xs text-slate-300 font-semibold truncate">
                        by {t.liveAuctionSummary.currentBidTeamName}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Link
                href={`/${t.slug}`}
                className="mt-3 block text-center text-xs font-black uppercase tracking-wider text-amber-400 hover:text-amber-300 transition-colors py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10"
              >
                Open Live Auction Room →
              </Link>
            </div>
          )}

          {/* 3. Upcoming Tournament Schedule Card */}
          {!isMatchLive && !isAuctionLive && isUpcoming && (
            <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-900/70 p-4 sm:p-5 shadow-xl backdrop-blur-md">
              <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
                <Calendar size={15} />
                <span>Upcoming Tournament Schedule</span>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl bg-white/[0.03] p-3 border border-white/[0.06]">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Location &amp; Ground
                  </p>
                  <p className="font-bold text-slate-100 text-xs sm:text-sm mt-0.5">
                    {t.venue || 'Venue confirmed soon'}
                  </p>
                  {t.city && <p className="text-xs text-slate-400">{t.city}</p>}
                </div>

                {t.auctionDate && (
                  <div className="rounded-xl bg-white/[0.03] p-3 border border-white/[0.06]">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Scheduled Date
                    </p>
                    <p className="font-bold text-slate-100 text-xs sm:text-sm mt-0.5">
                      {new Date(t.auctionDate).toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    {t.auctionTime && <p className="text-xs text-slate-400">{t.auctionTime} hrs</p>}
                  </div>
                )}
              </div>

              <Link
                href={`/${t.slug}`}
                className="mt-4 block text-center text-xs font-black uppercase tracking-wider text-amber-400 hover:text-amber-300 transition-colors py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10"
              >
                View Tournament Info &amp; Teams →
              </Link>
            </div>
          )}

          {/* 4. Concluded Tournament Card */}
          {!isMatchLive && !isAuctionLive && isCompleted && (
            <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-900/70 p-4 sm:p-5 shadow-xl backdrop-blur-md">
              <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-400">
                <Trophy size={15} />
                <span>Tournament Concluded</span>
              </div>

              <div className="rounded-xl bg-white/[0.03] p-3.5 border border-white/[0.06]">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Status
                </p>
                <p className="font-bold text-slate-100 text-xs sm:text-sm mt-0.5">Tournament Completed</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Full auction lots and match scorecards archived.
                </p>
              </div>

              <Link
                href={`/${t.slug}`}
                className="mt-4 block text-center text-xs font-black uppercase tracking-wider text-amber-400 hover:text-amber-300 transition-colors py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10"
              >
                View Concluded Results &amp; Archive →
              </Link>
            </div>
          )}

          {/* 5. Fallback Showcase Card */}
          {!isMatchLive && !isAuctionLive && !isUpcoming && !isCompleted && (
            <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-900/70 p-4 sm:p-5 shadow-xl backdrop-blur-md">
              <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
                <Shield size={15} className="text-amber-500" />
                <span>Tournament Showcase</span>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl bg-white/[0.03] p-3 border border-white/[0.06]">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Location &amp; Ground
                  </p>
                  <p className="font-bold text-slate-100 text-xs sm:text-sm mt-0.5">
                    {t.venue || 'Venue confirmed soon'}
                  </p>
                  {t.city && <p className="text-xs text-slate-400">{t.city}</p>}
                </div>
              </div>

              <div className="mt-4 border-t border-white/10 pt-3 flex items-center justify-between text-xs text-slate-400">
                <span>Verified Public Tournament</span>
                <span className="font-bold text-amber-400">BidWar Arena</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
