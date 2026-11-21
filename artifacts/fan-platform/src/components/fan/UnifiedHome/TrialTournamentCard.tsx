import React, { useState } from 'react';
import { Link } from 'wouter';
import { MapPin, Calendar, ArrowRight, Trophy, Activity, Users, Shield, Award } from 'lucide-react';
import { OrganizerTrialTournament } from '../../../lib/api/types';

interface TrialTournamentCardProps {
  trial: OrganizerTrialTournament;
}

/**
 * High-End Sport Placeholder
 * Displayed when a tournament has no logo or its image fails to load.
 */
function SportPlaceholderIcon({ sport }: { sport: string }) {
  const s = (sport || '').toLowerCase();

  if (s === 'badminton') {
    return (
      <div className="flex flex-col items-center justify-center text-sky-500 dark:text-sky-400">
        <Activity size={26} className="stroke-[2.2]" />
        <span className="mt-1 text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Badminton
        </span>
      </div>
    );
  }

  if (s === 'football' || s === 'soccer') {
    return (
      <div className="flex flex-col items-center justify-center text-emerald-500 dark:text-emerald-400">
        <Award size={26} className="stroke-[2.2]" />
        <span className="mt-1 text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Football
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-amber-500 dark:text-amber-400">
      <Trophy size={26} className="stroke-[2.2]" />
      <span className="mt-1 text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
        Cricket
      </span>
    </div>
  );
}

/** Format auction or match date for clean, polished display */
function formatTournamentDate(auctionDate?: string | null, matchDates?: string | null): string | null {
  const rawDate = auctionDate || (matchDates ? matchDates.split(',')[0]?.trim() : null);
  if (!rawDate) return null;
  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  } catch {
    // ignore
  }
  return rawDate;
}

export const TrialTournamentCard: React.FC<TrialTournamentCardProps> = ({ trial }) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const formattedDate = formatTournamentDate(trial.auctionDate, trial.matchDates);
  const locationDisplay = trial.city
    ? trial.venue
      ? `${trial.venue}, ${trial.city}`
      : trial.city
    : trial.venue;

  const sportName = trial.sport || 'Cricket';

  return (
    <Link href={`/${trial.slug}`}>
      <div className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 dark:border-white/[0.08] dark:bg-[#131B2E]">
        {/* ── Top Stadium Banner & Glamour Logo Presentation ── */}
        <div className="relative flex h-32 w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-[#0D1524] to-slate-950 p-3 border-b border-slate-100 dark:border-white/5">
          {/* Subtle Ambient Stadium Texture */}
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-500/15 blur-xl transition-all duration-500 group-hover:bg-amber-500/25" />
          <div className="pointer-events-none absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-sky-500/15 blur-xl transition-all duration-500 group-hover:bg-sky-500/25" />

          {/* Top-Left: Sport Badge */}
          <div className="absolute top-2.5 left-3 z-10 flex items-center gap-1.5">
            <span className="rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-200 backdrop-blur-md border border-white/10 shadow-xs">
              {sportName}
            </span>
          </div>

          {/* Top-Right: Feature Modules */}
          <div className="absolute top-2.5 right-3 z-10 flex items-center gap-1">
            {trial.auctionEnabled && (
              <span className="rounded-full border border-amber-400/30 bg-amber-500/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-950 shadow-xs backdrop-blur-sm">
                Auction
              </span>
            )}
            {trial.scoringEnabled && (
              <span className="rounded-full border border-sky-400/30 bg-sky-500/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-xs backdrop-blur-sm">
                Scoring
              </span>
            )}
          </div>

          {/* Centered Tournament Logo / High-End Placeholder */}
          <div className="relative z-10 flex h-18 w-18 sm:h-20 sm:w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white p-2 shadow-lg transition-transform duration-300 group-hover:scale-105 dark:border-amber-400/25 dark:bg-slate-900 ring-2 ring-black/10 dark:ring-amber-400/10">
            {trial.logoUrl && !logoFailed ? (
              <img
                src={trial.logoUrl}
                alt={trial.name}
                className="h-full w-full object-contain filter drop-shadow-xs"
                loading="lazy"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <SportPlaceholderIcon sport={trial.sport} />
            )}
          </div>
        </div>

        {/* ── Card Content Body ── */}
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          {/* Tournament Name */}
          <h4 className="font-display text-base font-bold text-slate-900 transition-colors group-hover:text-amber-600 dark:text-white dark:group-hover:text-amber-400 line-clamp-1">
            {trial.name}
          </h4>

          {/* Meta Details: Location & Dates */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {locationDisplay ? (
              <span className="flex items-center gap-1.5 font-medium truncate">
                <MapPin size={13} className="shrink-0 text-amber-500" />
                <span className="truncate">{locationDisplay}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-medium text-slate-400">
                <MapPin size={13} className="shrink-0 opacity-60" />
                <span>Venue TBA</span>
              </span>
            )}
            {formattedDate && (
              <span className="flex items-center gap-1.5 font-medium">
                <Calendar size={13} className="shrink-0 text-sky-500" />
                <span>{formattedDate}</span>
              </span>
            )}
          </div>

          {/* Stats: Number of Teams and Number of Players */}
          <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-white/5 pt-3">
            <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] px-2.5 py-1.5 border border-slate-100 dark:border-white/[0.04]">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Shield size={14} className="stroke-[2.2]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                  {trial.teamsCount ?? 0}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                  {(trial.teamsCount ?? 0) === 1 ? 'Team' : 'Teams'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] px-2.5 py-1.5 border border-slate-100 dark:border-white/[0.04]">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Users size={14} className="stroke-[2.2]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                  {trial.playersCount ?? 0}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                  {(trial.playersCount ?? 0) === 1 ? 'Player' : 'Players'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-white/5 text-xs font-bold text-amber-600 group-hover:text-amber-500 dark:text-amber-400">
            <span>View Tournament</span>
            <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </Link>
  );
};
