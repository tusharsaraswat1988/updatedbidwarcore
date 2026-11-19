import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '../lib/api/client';
import { TournamentSummary, FanDiscoveryResponse } from '../lib/api/types';
import { ActivityTicker } from '../components/ActivityTicker';
import { Header } from '../components/Header';
import { FeaturedTournamentHero } from '../components/fan/UnifiedHome/FeaturedTournamentHero';
import { TournamentSection } from '../components/fan/UnifiedHome/TournamentSection';
import { Search, Loader2, Trophy, Radio, Calendar, Filter, X, RefreshCw } from 'lucide-react';

const SPORTS = [
  { label: 'All', value: 'All' },
  { label: 'Cricket', value: 'Cricket' },
  { label: 'Badminton', value: 'Badminton' },
];

const STATUS_TABS = ['All', 'Live', 'Upcoming', 'Completed'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export const HomePage = ({
  toggleTheme,
  theme,
}: {
  toggleTheme: () => void;
  theme: 'dark' | 'light';
}) => {
  const [data, setData] = useState<FanDiscoveryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [city, setCity] = useState('');
  const [debouncedCity, setDebouncedCity] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('All');
  const [sportFilter, setSportFilter] = useState('All');
  const [page, setPage] = useState(1);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Debounce city input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedCity(city.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [city]);

  // Reset page when tab/sport changes
  const handleStatusChange = (tab: StatusTab) => {
    setStatusTab(tab);
    setPage(1);
  };

  const handleSportChange = (sport: string) => {
    setSportFilter(sport);
    setPage(1);
  };

  // Fetch tournaments
  useEffect(() => {
    setLoading(true);
    setError(null);

    apiClient
      .getTournaments({
        search: debouncedSearch || undefined,
        city: debouncedCity || undefined,
        sport: sportFilter !== 'All' ? sportFilter.toLowerCase() : undefined,
        status: statusTab !== 'All' ? statusTab.toLowerCase() : undefined,
        page: 1,
        limit: 50,
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError('Unable to load tournaments right now. Please refresh.');
        setLoading(false);
      });
  }, [debouncedSearch, debouncedCity, statusTab, sportFilter]);

  // Load more pagination handler
  const handleLoadMore = () => {
    if (!data || loadingMore || data.pagination.page >= data.pagination.pages) return;
    setLoadingMore(true);
    const nextPage = data.pagination.page + 1;

    apiClient
      .getTournaments({
        search: debouncedSearch || undefined,
        city: debouncedCity || undefined,
        sport: sportFilter !== 'All' ? sportFilter.toLowerCase() : undefined,
        status: statusTab !== 'All' ? statusTab.toLowerCase() : undefined,
        page: nextPage,
        limit: 50,
      })
      .then((res) => {
        setData((prev) =>
          prev
            ? {
                ...res,
                items: [...prev.items, ...res.items],
              }
            : res,
        );
        setPage(nextPage);
        setLoadingMore(false);
      })
      .catch(() => {
        setLoadingMore(false);
      });
  };

  const clearFilters = () => {
    setSearch('');
    setCity('');
    setStatusTab('All');
    setSportFilter('All');
    setPage(1);
  };

  const items = data?.items ?? [];
  const summary = data?.summary ?? { live: 0, upcoming: 0, today: 0, completed: 0, total: 0 };

  // Prioritize admin-featured tournament; fallback to first live tournament
  const featured = useMemo(() => {
    return items.find((t) => t.featured) || items.find((t) => t.liveState?.isLive);
  }, [items]);

  // True state classifications
  const live = useMemo(
    () => items.filter((t) => t.status === 'LIVE' || t.liveState?.isLive),
    [items],
  );
  const upcoming = useMemo(
    () => items.filter((t) => (t.status === 'UPCOMING' || t.status === 'TODAY') && !t.liveState?.isLive),
    [items],
  );
  const completed = useMemo(
    () => items.filter((t) => t.status === 'COMPLETED' && !t.liveState?.isLive),
    [items],
  );

  const isFiltered = Boolean(debouncedSearch || debouncedCity || statusTab !== 'All' || sportFilter !== 'All');

  const stats = [
    { value: summary.live, label: 'Live now', active: summary.live > 0 },
    { value: summary.upcoming + summary.today, label: 'Starting soon', active: false },
    { value: summary.completed, label: 'Completed', active: false },
    { value: summary.total, label: 'Tournaments', active: false },
  ];

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-slate-900 transition-colors duration-300 dark:bg-[#0B101B] dark:text-slate-100">
      <Header toggleTheme={toggleTheme} theme={theme} />

      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
        <ActivityTicker tournaments={items} />
      </div>

      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        {/* Title & Introduction */}
        <section className="mb-6 mt-4">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-600 dark:text-amber-400">
            Fan Arena
          </p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Pick a tournament. Follow it live.
          </h1>
        </section>

        {/* Search & City Filter Bar */}
        <div id="search-section" className="mb-4 grid scroll-mt-24 gap-3 sm:grid-cols-[1fr_200px]">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-10 text-sm shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-white/[0.08] dark:bg-[#131B2E] dark:placeholder:text-slate-500"
              placeholder="Search tournament name or venue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="relative">
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-4 pr-9 text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-white/[0.08] dark:bg-[#131B2E] dark:placeholder:text-slate-500"
              placeholder="Filter by city..."
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            {city && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                onClick={() => setCity('')}
                aria-label="Clear city"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {STATUS_TABS.map((tab) => {
            const count =
              tab === 'Live'
                ? summary.live
                : tab === 'Upcoming'
                ? summary.upcoming + summary.today
                : tab === 'Completed'
                ? summary.completed
                : summary.total;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => handleStatusChange(tab)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  statusTab === tab
                    ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                    : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                    statusTab === tab
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {isFiltered && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto text-xs font-bold text-amber-600 hover:text-amber-500 dark:text-amber-400"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* Sport Discovery Pills */}
        <div className="mb-8 flex flex-wrap gap-2">
          {SPORTS.map((sport) => (
            <button
              key={sport.value}
              type="button"
              onClick={() => handleSportChange(sport.value)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                sportFilter === sport.value
                  ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'border-slate-200 bg-white/50 text-slate-600 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
              }`}
            >
              {sport.label}
            </button>
          ))}
        </div>

        {/* Summary Counter Grid (Visible when unfiltered) */}
        {!isFiltered && (
          <div className="mb-10 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-white/10 dark:bg-[#131B2E]"
              >
                <div className="flex items-center justify-between">
                  <p className="font-display text-3xl font-black text-slate-900 dark:text-white">
                    {stat.value}
                  </p>
                  {stat.active && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={36} className="animate-spin text-amber-500" />
          </div>
        )}

        {/* Error Notice */}
        {error && !loading && (
          <div className="my-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center text-red-600 dark:text-red-400">
            <p className="font-bold">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-600"
            >
              <RefreshCw size={14} /> Refresh Page
            </button>
          </div>
        )}

        {/* Main Content Sections */}
        {!loading && !error && (
          <>
            {/* Adaptive Featured Tournament Hero */}
            {!isFiltered && featured && <FeaturedTournamentHero t={featured} />}

            {/* Structured Tournament Sections (Unfiltered) */}
            {!isFiltered && (
              <>
                <TournamentSection
                  title="Live Now"
                  icon={Radio}
                  tournaments={live}
                  emptyMessage="No tournaments currently live. Check upcoming schedules below."
                />
                <TournamentSection
                  title="Upcoming Tournaments"
                  icon={Calendar}
                  tournaments={upcoming}
                />
                <TournamentSection
                  title="Recent Results & Archive"
                  icon={Trophy}
                  tournaments={completed}
                />
              </>
            )}

            {/* Filtered View Results */}
            {isFiltered && (
              <TournamentSection
                title="Search & Filter Results"
                icon={Filter}
                tournaments={items}
                emptyMessage="No tournaments matched your criteria. Try adjusting your search or filters."
              />
            )}

            {/* Zero Tournaments Global State */}
            {items.length === 0 && !isFiltered && (
              <div className="rounded-3xl border border-dashed border-slate-200 dark:border-white/10 py-24 text-center">
                <Trophy size={48} className="mx-auto text-slate-400 opacity-40 mb-3" />
                <h3 className="font-display text-xl font-bold text-slate-700 dark:text-slate-300">
                  No public tournaments found
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tournaments will appear here once published by organizers.
                </p>
              </div>
            )}

            {/* Pagination / Load More Button */}
            {data && data.pagination.page < data.pagination.pages && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-8 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:border-amber-500 hover:text-amber-600 dark:border-white/10 dark:bg-[#131B2E] dark:text-slate-200 dark:hover:border-amber-500 dark:hover:text-amber-400"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Loading more...
                    </>
                  ) : (
                    <>
                      Load More Tournaments ({items.length} of {data.pagination.total})
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
