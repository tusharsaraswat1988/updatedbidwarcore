import React, { useEffect, useState } from 'react';
import { TournamentSummary, ActivityEvent } from '../lib/api/types';
import { apiClient } from '../lib/api/client';
import { Activity, Trophy, Gavel, Calendar } from 'lucide-react';

interface ActivityTickerProps {
  tournaments: TournamentSummary[];
}

export const ActivityTicker: React.FC<ActivityTickerProps> = ({ tournaments }) => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    let active = true;

    const loadTicker = () => {
      apiClient.getLiveTicker().then((evs) => {
        if (!active) return;
        if (evs && evs.length > 0) {
          setEvents(evs);
        } else {
          // If no genuine events exist, only show verified upcoming announcements
          const verifiedUpcoming = tournaments
            .filter((t) => t.status === 'UPCOMING' || t.status === 'TODAY')
            .map((t) => ({
              id: `tourney-${t.id}`,
              tournamentId: t.id,
              tournamentName: t.name,
              sport: t.sport,
              timestamp: new Date().toISOString(),
              message: `${t.name} · ${t.sport.toUpperCase()}${t.city ? ` (${t.city})` : ''}`,
              type: (t.sport.toLowerCase() === 'badminton' ? 'BADMINTON' : 'CRICKET') as any,
              badge: 'UPCOMING',
            }));
          setEvents(verifiedUpcoming);
        }
      }).catch(() => {
        // ignore
      });
    };

    loadTicker();
    const interval = setInterval(loadTicker, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [tournaments]);

  // If no genuine updates exist, hide the ticker (Rule: If no genuine updates exist, show a neutral empty state or hide the ticker)
  if (events.length === 0) return null;

  // Duplicate events for seamless continuous loop
  const marqueeItems = [...events, ...events];

  const hasLiveEvent = events.some(
    (e) => e.badge === 'LIVE SCORE' || e.badge === 'LIVE AUCTION' || e.badge === 'LIVE',
  );

  return (
    <div
      className="group relative mb-6 flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-2.5 shadow-sm backdrop-blur-md transition-colors dark:border-white/[0.08] dark:bg-[#131B2E]/90"
      aria-label="Tournament activity ticker"
      role="region"
    >
      {/* Static Left Badge */}
      <div className="relative z-10 flex shrink-0 items-center gap-1.5 border-r border-slate-200 bg-white/95 px-3 py-1 font-bold text-xs dark:border-white/10 dark:bg-[#131B2E]">
        {hasLiveEvent ? (
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="uppercase tracking-wider font-extrabold text-[11px]">Live Updates</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <Activity size={14} />
            <span className="uppercase tracking-wider font-extrabold text-[11px]">Arena Ticker</span>
          </span>
        )}
      </div>

      {/* Marquee Scroller with Hover Pause & Reduced Motion Support */}
      <div className="relative flex-1 overflow-hidden px-3">
        <div className="animate-marquee group-hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] motion-reduce:animate-none flex items-center gap-8 text-xs text-slate-700 dark:text-slate-300">
          {marqueeItems.map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="flex items-center gap-2 whitespace-nowrap">
              {item.badge && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                    item.badge.includes('LIVE')
                      ? 'bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-500/30'
                      : item.badge === 'PLAYER SOLD'
                      ? 'bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                      : 'bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
              <span className="font-bold text-slate-900 dark:text-white">
                {item.tournamentName}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {item.message}
              </span>
              <span className="text-slate-300 dark:text-slate-600 font-black">•</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
