import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { apiClient } from '../lib/api/client';
import { TournamentSummary, FanDiscoveryResponse } from '../lib/api/types';
import { ActivityTicker } from '../components/ActivityTicker';
import { Header } from '../components/Header';
import { FeaturedTournamentHero } from '../components/fan/UnifiedHome/FeaturedTournamentHero';
import { TournamentSection } from '../components/fan/UnifiedHome/TournamentSection';
import { BrandLogoImage } from '../components/brand-logo-image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Search,
  Loader2,
  Trophy,
  Radio,
  Calendar,
  Filter,
  X,
  RefreshCw,
  Sparkles,
  MapPin,
  Shield,
  SlidersHorizontal,
  Check,
  RotateCcw,
} from 'lucide-react';

const SPORTS = [
  { label: 'All Sports', value: 'All' },
  { label: 'Cricket', value: 'Cricket' },
  { label: 'Badminton', value: 'Badminton' },
] as const;

const STATUS_TABS = ['All', 'Live', 'Upcoming', 'Completed'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const MODULE_OPTIONS = [
  { label: 'All Modules', value: 'All' },
  { label: 'Auction', value: 'Auction' },
  { label: 'Scoring', value: 'Scoring' },
  { label: 'Both', value: 'Both' },
] as const;
type ModuleOption = (typeof MODULE_OPTIONS)[number]['value'];

/** Parses URL query parameters into validated filter states */
function parseInitialFilters() {
  if (typeof window === 'undefined') {
    return {
      search: '',
      city: '',
      status: 'All' as StatusTab,
      sport: 'All',
      module: 'All' as ModuleOption,
    };
  }

  const sp = new URLSearchParams(window.location.search);
  const qSearch = sp.get('search') || '';
  const qCity = sp.get('city') || '';

  const qStatusRaw = (sp.get('status') || '').toLowerCase();
  const qStatus: StatusTab =
    qStatusRaw === 'live'
      ? 'Live'
      : qStatusRaw === 'upcoming'
      ? 'Upcoming'
      : qStatusRaw === 'completed'
      ? 'Completed'
      : 'All';

  const qSportRaw = (sp.get('sport') || '').toLowerCase();
  const qSport =
    qSportRaw === 'cricket'
      ? 'Cricket'
      : qSportRaw === 'badminton'
      ? 'Badminton'
      : 'All';

  const qModuleRaw = (sp.get('module') || '').toLowerCase();
  const qModule: ModuleOption =
    qModuleRaw === 'auction'
      ? 'Auction'
      : qModuleRaw === 'scoring'
      ? 'Scoring'
      : qModuleRaw === 'both'
      ? 'Both'
      : 'All';

  return {
    search: qSearch,
    city: qCity,
    status: qStatus,
    sport: qSport,
    module: qModule,
  };
}

export const HomePage = ({
  toggleTheme,
  theme,
}: {
  toggleTheme: () => void;
  theme: 'dark' | 'light';
}) => {
  const initial = useMemo(() => parseInitialFilters(), []);

  const [data, setData] = useState<FanDiscoveryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states initialized from URL query params
  const [search, setSearch] = useState(initial.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initial.search);
  const [city, setCity] = useState(initial.city);
  const [debouncedCity, setDebouncedCity] = useState(initial.city);
  const [statusTab, setStatusTab] = useState<StatusTab>(initial.status);
  const [sportFilter, setSportFilter] = useState(initial.sport);
  const [moduleFilter, setModuleFilter] = useState<ModuleOption>(initial.module);
  const [page, setPage] = useState(1);

  // Mobile Filter Drawer modal state
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Synchronize filter state into browser URL query parameters
  const updateUrl = useCallback(
    (
      newSearch: string,
      newCity: string,
      newStatus: StatusTab,
      newSport: string,
      newModule: ModuleOption,
      mode: 'push' | 'replace' = 'replace',
    ) => {
      if (typeof window === 'undefined') return;

      const sp = new URLSearchParams();
      if (newSearch.trim()) sp.set('search', newSearch.trim());
      if (newCity.trim()) sp.set('city', newCity.trim());
      if (newStatus !== 'All') sp.set('status', newStatus.toLowerCase());
      if (newSport !== 'All') sp.set('sport', newSport.toLowerCase());
      if (newModule !== 'All') sp.set('module', newModule.toLowerCase());

      const qs = sp.toString();
      const currentQuery = window.location.search.replace(/^\?/, '');
      const newPath = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;

      if (qs !== currentQuery) {
        if (mode === 'push') {
          window.history.pushState({}, '', newPath);
        } else {
          window.history.replaceState({}, '', newPath);
        }
      }
    },
    [],
  );

  // Listen to browser Back / Forward (popstate) to restore previous filter state
  useEffect(() => {
    const handlePopState = () => {
      const current = parseInitialFilters();
      setSearch(current.search);
      setDebouncedSearch(current.search);
      setCity(current.city);
      setDebouncedCity(current.city);
      setStatusTab(current.status);
      setSportFilter(current.sport);
      setModuleFilter(current.module);
      setPage(1);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Debounce search input (300ms) with replaceState to prevent history clutter
  const isSearchFirst = useRef(true);
  useEffect(() => {
    if (isSearchFirst.current) {
      isSearchFirst.current = false;
      return;
    }
    const t = setTimeout(() => {
      const trimmed = search.trim();
      setDebouncedSearch(trimmed);
      setPage(1);
      updateUrl(trimmed, debouncedCity, statusTab, sportFilter, moduleFilter, 'replace');
    }, 300);
    return () => clearTimeout(t);
  }, [search, debouncedCity, statusTab, sportFilter, moduleFilter, updateUrl]);

  // Debounce city input (300ms) with replaceState
  const isCityFirst = useRef(true);
  useEffect(() => {
    if (isCityFirst.current) {
      isCityFirst.current = false;
      return;
    }
    const t = setTimeout(() => {
      const trimmed = city.trim();
      setDebouncedCity(trimmed);
      setPage(1);
      updateUrl(debouncedSearch, trimmed, statusTab, sportFilter, moduleFilter, 'replace');
    }, 300);
    return () => clearTimeout(t);
  }, [city, debouncedSearch, statusTab, sportFilter, moduleFilter, updateUrl]);

  // Discrete filter changes (pushState creates navigable history entries)
  const handleStatusChange = (tab: StatusTab) => {
    setStatusTab(tab);
    setPage(1);
    updateUrl(debouncedSearch, debouncedCity, tab, sportFilter, moduleFilter, 'push');
  };

  const handleSportChange = (sport: string) => {
    setSportFilter(sport);
    setPage(1);
    updateUrl(debouncedSearch, debouncedCity, statusTab, sport, moduleFilter, 'push');
  };

  const handleModuleChange = (mod: ModuleOption) => {
    setModuleFilter(mod);
    setPage(1);
    updateUrl(debouncedSearch, debouncedCity, statusTab, sportFilter, mod, 'push');
  };

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setCity('');
    setDebouncedCity('');
    setStatusTab('All');
    setSportFilter('All');
    setModuleFilter('All');
    setPage(1);
    updateUrl('', '', 'All', 'All', 'All', 'push');
  };

  // Fetch tournaments using active unified filters
  useEffect(() => {
    setLoading(true);
    setError(null);

    apiClient
      .getTournaments({
        search: debouncedSearch || undefined,
        city: debouncedCity || undefined,
        sport: sportFilter !== 'All' ? sportFilter.toLowerCase() : undefined,
        status: statusTab !== 'All' ? statusTab.toLowerCase() : undefined,
        module: moduleFilter !== 'All' ? moduleFilter.toLowerCase() : undefined,
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
  }, [debouncedSearch, debouncedCity, statusTab, sportFilter, moduleFilter]);

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
        module: moduleFilter !== 'All' ? moduleFilter.toLowerCase() : undefined,
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

  const items = data?.items ?? [];
  const summary = data?.summary ?? {
    live: 0,
    upcoming: 0,
    today: 0,
    completed: 0,
    total: 0,
    modules: { all: 0, auction: 0, scoring: 0, both: 0 },
  };
  const organizerTrials = data?.organizerTrials ?? [];

  // Active filter computation
  const activeFilterCount =
    (statusTab !== 'All' ? 1 : 0) +
    (sportFilter !== 'All' ? 1 : 0) +
    (moduleFilter !== 'All' ? 1 : 0) +
    (debouncedSearch ? 1 : 0) +
    (debouncedCity ? 1 : 0);

  const isFiltered = activeFilterCount > 0;

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

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-slate-900 transition-colors duration-300 dark:bg-[#0B101B] dark:text-slate-100 flex flex-col justify-between">
      <div>
        {/* 1. Compact BidWar Header */}
        <Header toggleTheme={toggleTheme} theme={theme} />

        {/* 2. Live Activity Ticker (Snug transition beneath header) */}
        <div className="mx-auto max-w-7xl px-4 pt-2 sm:pt-2.5 sm:px-6">
          <ActivityTicker tournaments={items} />
        </div>

        <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          {/* 3. Compact Fan Arena Hero & Integrated Search */}
          <section className="relative mb-6 overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-br from-slate-950 via-[#0E1626] to-[#0A0F1D] p-5 sm:p-7 text-white shadow-xl shadow-black/20">
            {/* Ambient Background Accents */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />

            <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Headline & Identity */}
              <div className="max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-0.5 text-[11px] font-black uppercase tracking-[0.2em] text-amber-400 shadow-xs">
                    <Sparkles size={12} className="text-amber-400" />
                    Fan Arena
                  </span>

                  {summary.live > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-400 shadow-xs">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      {summary.live} Live Now
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-bold text-slate-300">
                      Live Sports & Auctions
                    </span>
                  )}
                </div>

                <h1 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl text-white">
                  Live Auctions & Match Center
                </h1>
                <p className="mt-1 text-xs text-slate-300 sm:text-sm font-medium">
                  Experience live bidding wars, ball-by-ball cricket scoring, and court-side badminton action across India's premier community tournaments.
                </p>
              </div>

              {/* Compact Metrics Strip */}
              <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end lg:gap-1.5 shrink-0">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
                    <Radio size={13} className={summary.live > 0 ? 'text-emerald-400 animate-pulse' : 'text-slate-400'} />
                    <span className="text-white font-black">{summary.live}</span> Live
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
                    <Calendar size={13} className="text-amber-400" />
                    <span className="text-white font-black">{summary.upcoming + summary.today}</span> Soon
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
                    <Trophy size={13} className="text-sky-400" />
                    <span className="text-white font-black">{summary.total}</span> Total
                  </span>
                </div>
              </div>
            </div>

            {/* Integrated Streamlined Search Bar */}
            <div className="relative z-10 mt-4 pt-3.5 border-t border-white/10 grid gap-2.5 sm:grid-cols-[1fr_200px]">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="hero-search-input"
                  className="w-full rounded-xl border border-white/15 bg-white/10 py-2.5 pl-10 pr-9 text-xs sm:text-sm text-white placeholder:text-slate-400 shadow-inner backdrop-blur-sm transition focus:border-amber-400 focus:bg-white/15 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  placeholder="Search tournament name, venue, or team..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-white"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  className="w-full rounded-xl border border-white/15 bg-white/10 py-2.5 pl-3.5 pr-8 text-xs sm:text-sm text-white placeholder:text-slate-400 shadow-inner backdrop-blur-sm transition focus:border-amber-400 focus:bg-white/15 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  placeholder="Filter by city..."
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                {city && (
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-white"
                    onClick={() => setCity('')}
                    aria-label="Clear city"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Loading Spinner */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={36} className="animate-spin text-amber-500" />
            </div>
          )}

          {/* Error Notice */}
          {error && !loading && (
            <div className="my-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center text-red-600 dark:text-red-400">
              <p className="font-bold">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-600 cursor-pointer"
              >
                <RefreshCw size={14} /> Refresh Page
              </button>
            </div>
          )}

          {/* Main Content Sections */}
          {!loading && !error && (
            <>
              {/* 4. Featured Tournament Spotlight */}
              {!isFiltered && featured && <FeaturedTournamentHero t={featured} />}

              {/* 5. Live Now (High priority live tournament action) */}
              {!isFiltered && live.length > 0 && (
                <TournamentSection
                  title="Live Now"
                  icon={Radio}
                  tournaments={live}
                  emptyMessage="No tournaments currently live."
                />
              )}

              {/* 6. Discover Tournaments Section with Unified Filter Toolbar */}
              <div id="discover-section" className="mb-6 pt-3 border-t border-slate-200/80 dark:border-white/[0.08]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3.5">
                  <div>
                    <h2 className="font-display text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                      Discover Tournaments
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Browse verified community sports tournaments across all formats and modules
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Mobile Filter Drawer Trigger Button */}
                    <button
                      type="button"
                      onClick={() => setMobileFilterOpen(true)}
                      className="md:hidden inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 shadow-xs hover:border-amber-500 dark:border-white/10 dark:bg-[#131B2E] dark:text-slate-200 cursor-pointer"
                    >
                      <SlidersHorizontal size={14} className="text-amber-500" />
                      <span>Filters</span>
                      {activeFilterCount > 0 && (
                        <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-black text-slate-950">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>

                    {isFiltered && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-500 dark:text-amber-400 cursor-pointer"
                      >
                        <RotateCcw size={13} />
                        <span>Reset filters</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Desktop Unified Discovery Filter Toolbar */}
                <div className="hidden md:flex flex-col gap-2.5 rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-xs dark:border-white/[0.07] dark:bg-[#131B2E]/80 backdrop-blur-md">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Status Filter Pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">
                        Status:
                      </span>
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
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                              statusTab === tab
                                ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
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
                    </div>

                    {/* Sport Discovery Pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">
                        Sport:
                      </span>
                      {SPORTS.map((sport) => (
                        <button
                          key={sport.value}
                          type="button"
                          onClick={() => handleSportChange(sport.value)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                            sportFilter === sport.value
                              ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold'
                              : 'border-slate-200 bg-white/60 text-slate-600 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
                          }`}
                        >
                          {sport.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Module Entitlement Filter Row */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">
                      Module:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {MODULE_OPTIONS.map((mod) => {
                        const count =
                          mod.value === 'Auction'
                            ? summary.modules?.auction ?? 0
                            : mod.value === 'Scoring'
                            ? summary.modules?.scoring ?? 0
                            : mod.value === 'Both'
                            ? summary.modules?.both ?? 0
                            : summary.modules?.all ?? summary.total;

                        return (
                          <button
                            key={mod.value}
                            type="button"
                            onClick={() => handleModuleChange(mod.value)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                              moduleFilter === mod.value
                                ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                            }`}
                          >
                            <span>{mod.label}</span>
                            <span
                              className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                                moduleFilter === mod.value
                                  ? 'bg-slate-950 text-amber-400'
                                  : 'bg-white text-slate-600 dark:bg-white/10 dark:text-slate-400'
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {isFiltered && (
                      <span className="ml-auto text-xs font-medium text-slate-500 dark:text-slate-400">
                        {items.length} {items.length === 1 ? 'tournament' : 'tournaments'} found
                      </span>
                    )}
                  </div>
                </div>

                {/* Mobile Quick Status Scroller */}
                <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none">
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
                        className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                          statusTab === tab
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'bg-white text-slate-600 border border-slate-200/80 dark:bg-white/5 dark:text-slate-300 dark:border-white/10'
                        }`}
                      >
                        <span>{tab}</span>
                        <span className="text-[10px] font-black opacity-80">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filtered View Results */}
              {isFiltered && (
                <TournamentSection
                  title="Search & Filter Results"
                  icon={Filter}
                  tournaments={items}
                  emptyMessage="No tournaments matched your criteria. Try adjusting your search, sport, or module filters."
                />
              )}

              {/* 7. Upcoming & Recently Completed Sections (Unfiltered) */}
              {!isFiltered && (
                <>
                  <TournamentSection
                    title="Upcoming Tournaments"
                    icon={Calendar}
                    tournaments={upcoming}
                    emptyMessage="No upcoming tournaments scheduled."
                  />
                  <TournamentSection
                    title="Recent Results & Archive"
                    icon={Trophy}
                    tournaments={completed}
                    emptyMessage="No completed tournaments yet."
                  />
                </>
              )}

              {/* 8. Organizer Trial Area (Strictly authenticated and authorized) */}
              {organizerTrials.length > 0 && !isFiltered && (
                <section className="mt-12 rounded-3xl border border-amber-500/25 bg-amber-500/[0.04] p-5 sm:p-6 dark:border-amber-400/20 dark:bg-amber-400/[0.03]">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 mb-4">
                    <div className="flex items-center gap-2">
                      <Shield size={18} className="text-amber-500 shrink-0" />
                      <h3 className="font-display text-base sm:text-lg font-black text-slate-900 dark:text-white">
                        My Trial Tournaments
                      </h3>
                      <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">
                        Organizer Preview
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Private organizer preview · Not visible in public fan discovery
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {organizerTrials.map((trial) => (
                      <div
                        key={trial.id}
                        className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#131B2E]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-white/10 dark:text-slate-300">
                            {trial.sport}
                          </span>
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            Trial Mode
                          </span>
                        </div>
                        <h4 className="mt-2 font-display text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                          {trial.name}
                        </h4>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          {trial.city && (
                            <span className="flex items-center gap-1">
                              <MapPin size={12} className="text-slate-400" />
                              {trial.city}
                            </span>
                          )}
                          {trial.auctionDate && (
                            <span className="flex items-center gap-1">
                              <Calendar size={12} className="text-slate-400" />
                              {new Date(trial.auctionDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-white/5 text-[11px]">
                          <span className="text-slate-400 font-medium">Status: {trial.status}</span>
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            Activate License to Publish &rarr;
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Zero Tournaments Global State */}
              {items.length === 0 && !isFiltered && (
                <div className="rounded-3xl border border-dashed border-slate-200 dark:border-white/10 py-20 text-center">
                  <Trophy size={44} className="mx-auto text-slate-400 opacity-40 mb-3" />
                  <h3 className="font-display text-lg font-bold text-slate-700 dark:text-slate-300">
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
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-8 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:border-amber-500 hover:text-amber-600 dark:border-white/10 dark:bg-[#131B2E] dark:text-slate-200 dark:hover:border-amber-500 dark:hover:text-amber-400 cursor-pointer"
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

      {/* ── Mobile Filter Bottom Sheet / Drawer ── */}
      <Dialog open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-[#131B2E] text-slate-900 dark:text-white border-slate-200 dark:border-white/10 rounded-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <DialogTitle className="flex items-center gap-2 font-display text-lg font-black">
                <SlidersHorizontal size={18} className="text-amber-500" />
                <span>Filter Tournaments</span>
              </DialogTitle>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-slate-950">
                  {activeFilterCount} active
                </span>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Status Filter */}
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                Status
              </label>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleStatusChange(tab)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                      statusTab === tab
                        ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 shadow-xs'
                        : 'bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300'
                    }`}
                  >
                    <span>{tab}</span>
                    {statusTab === tab && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Sport Filter */}
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                Sport
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SPORTS.map((sport) => (
                  <button
                    key={sport.value}
                    type="button"
                    onClick={() => handleSportChange(sport.value)}
                    className={`flex items-center justify-center rounded-xl px-2.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                      sportFilter === sport.value
                        ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 shadow-xs'
                        : 'bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300'
                    }`}
                  >
                    <span>{sport.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Module Filter */}
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                Module Capability
              </label>
              <div className="grid grid-cols-2 gap-2">
                {MODULE_OPTIONS.map((mod) => (
                  <button
                    key={mod.value}
                    type="button"
                    onClick={() => handleModuleChange(mod.value)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                      moduleFilter === mod.value
                        ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 shadow-xs'
                        : 'bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300'
                    }`}
                  >
                    <span>{mod.label}</span>
                    {moduleFilter === mod.value && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>

            {/* City Filter */}
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                Location / City
              </label>
              <div className="relative">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-8 pr-8 text-xs text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  placeholder="Filter by city..."
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                {city && (
                  <button
                    type="button"
                    onClick={() => setCity('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5 mt-2">
            <button
              type="button"
              onClick={() => {
                clearFilters();
                setMobileFilterOpen(false);
              }}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 cursor-pointer"
            >
              Reset All
            </button>
            <button
              type="button"
              onClick={() => setMobileFilterOpen(false)}
              className="flex-1 rounded-xl bg-amber-500 py-2.5 text-xs font-black text-slate-950 shadow-xs hover:bg-amber-400 cursor-pointer"
            >
              Apply Filters
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 9. Sleek Fan Arena Footer */}
      <footer className="mt-16 border-t border-slate-200/80 bg-white/70 py-8 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#0B101B]/80 text-xs text-slate-500 dark:text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <BrandLogoImage theme={theme} className="h-6 w-auto object-contain" />
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="font-bold tracking-tight text-slate-700 dark:text-slate-300">
              Fan Arena
            </span>
          </div>
          <p className="text-center sm:text-right text-[11px] text-slate-400">
            Real-time community sports auctions and scoring powered by{' '}
            <span className="font-bold text-amber-500">BidWar</span>.
          </p>
        </div>
      </footer>
    </div>
  );
};
