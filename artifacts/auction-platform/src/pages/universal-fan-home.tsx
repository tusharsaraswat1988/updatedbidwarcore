import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Trophy,
  Radio,
  Flame,
  Calendar,
  MapPin,
  ChevronRight,
  Star,
  Layers,
  Filter,
  X,
  RefreshCw,
  Sparkles,
  Users,
  ExternalLink,
  Clock,
  Home,
} from "lucide-react";
import { useFanFavorites } from "@/hooks/use-fan-favorites";
import { cldUrl } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import { useBranding } from "@/hooks/use-branding";
import { getBrandLogoSrc, isBrandLogoPlaceholderSrc } from "@/lib/brand-assets";
import { formatFanDate, formatFanDateTime, formatFanStatus } from "@/lib/fan-date-utils";

interface PublicBroadcast {
  auction?: {
    url: string;
    platform?: string;
    status: "live" | "upcoming" | "ended";
    title?: string;
  };
  scoring?: {
    url: string;
    platform?: string;
    status: "live" | "upcoming" | "ended";
    title?: string;
  };
}

interface FanDiscoveryCard {
  id: number;
  name: string;
  season?: string | null;
  code: string | null;
  sport: string;
  city: string | null;
  venue: string | null;
  organizerName: string | null;
  logoUrl: string | null;
  status: string;
  auctionDate: string | null;
  auctionTime: string | null;
  matchDates: string | null;
  auctionEnabled: boolean;
  scoringEnabled: boolean;
  productMode: "auction_only" | "scoring_only" | "both";
  isLive: boolean;
  liveType?: "auction" | "scoring" | null;
  liveSnippet?: string | null;
  teamsCount?: number;
  featured?: boolean;
  broadcast?: PublicBroadcast | null;
}

interface FanDiscoveryResponse {
  items: FanDiscoveryCard[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  summary: {
    liveCount: number;
    upcomingTodayCount: number;
    totalCount: number;
  };
}

export default function UniversalFanHome() {
  // Initialise city from URL query string on mount
  const [selectedCity, setSelectedCity] = useState<string>(() => {
    if (typeof window === "undefined") return "all";
    try {
      return new URLSearchParams(window.location.search).get("city") || "all";
    } catch {
      return "all";
    }
  });
  const [search, setSearch] = useState("");
  const [selectedSport, setSelectedSport] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedModule, setSelectedModule] = useState("all");
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [page, setPage] = useState(1);

  const { logos } = useBranding();
  const brandLogoSrc = useMemo(() => {
    const candidates = [logos.mini, logos.mainReverse, logos.main];
    for (const c of candidates) {
      if (c && !isBrandLogoPlaceholderSrc(c)) return c;
    }
    return "/assets/branding/bidwar-reverse-logo-official.png";
  }, [logos]);

  const { isFavorite, toggleFavorite, favoritesCount, favoriteIds } = useFanFavorites();

  // Sync city to URL query param
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      if (selectedCity !== "all") {
        url.searchParams.set("city", selectedCity);
      } else {
        url.searchParams.delete("city");
      }
      window.history.replaceState(null, "", url.toString());
    } catch {}
  }, [selectedCity]);

  // Available cities from dedicated endpoint
  const { data: citiesData } = useQuery<{ cities: string[] }>({
    queryKey: ["/api/fan/cities"],
    queryFn: async () => {
      const res = await fetch("/api/fan/cities");
      if (!res.ok) return { cities: [] };
      return res.json();
    },
    staleTime: 60_000,
  });
  const availableCities = citiesData?.cities ?? [];

  // Query parameters for discovery API
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (selectedSport !== "all") params.set("sport", selectedSport);
    if (selectedStatus !== "all") params.set("status", selectedStatus);
    if (selectedModule !== "all") params.set("module", selectedModule);
    if (selectedCity !== "all") params.set("city", selectedCity);
    params.set("page", String(page));
    params.set("limit", "24");
    params.set("sortBy", "live_first");
    return params.toString();
  }, [search, selectedSport, selectedStatus, selectedModule, selectedCity, page]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<FanDiscoveryResponse>({
    queryKey: ["/api/fan/tournaments", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/fan/tournaments?${queryParams}`);
      if (!res.ok) {
        throw new Error("Failed to load tournaments");
      }
      return res.json();
    },
    staleTime: 15_000,
    refetchInterval: 30_000, // Poll discovery feed gently every 30s
  });

  const rawItems = data?.items ?? [];

  // Filter client-side by favorites if active
  const displayedItems = useMemo(() => {
    if (!showOnlyFavorites) return rawItems;
    return rawItems.filter((t) => isFavorite(t.id));
  }, [rawItems, showOnlyFavorites, isFavorite]);

  // Find active live highlight (first live tournament)
  const spotlightTournament = useMemo(() => {
    return rawItems.find((t) => t.isLive);
  }, [rawItems]);

  const handleResetFilters = () => {
    setSearch("");
    setSelectedSport("all");
    setSelectedStatus("all");
    setSelectedModule("all");
    setSelectedCity("all");
    setShowOnlyFavorites(false);
    setPage(1);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    selectedSport !== "all" ||
    selectedStatus !== "all" ||
    selectedModule !== "all" ||
    selectedCity !== "all" ||
    showOnlyFavorites;

  return (
    <div className="min-h-screen bg-[#0B101B] text-white flex flex-col selection:bg-amber-500/30">
      {/* ── Top Header & Branding ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0B101B]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Official Brand Logo */}
            {brandLogoSrc ? (
              <img
                src={brandLogoSrc}
                alt="BidWar"
                className="h-7 sm:h-8 w-auto object-contain"
                loading="eager"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 p-0.5 shadow-lg shadow-amber-500/20">
                <div className="w-full h-full bg-[#0B101B] rounded-[10px] flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-amber-400" />
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  <Link to="/fan" className="hover:opacity-80 transition-opacity">BidWar Fan Arena</Link>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Hub
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Discover live auctions, ball-by-ball scoring & match centers
              </p>
            </div>
          </div>

          {/* Favorites Filter Trigger */}
          <button
            type="button"
            onClick={() => setShowOnlyFavorites((prev) => !prev)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
              showOnlyFavorites
                ? "bg-amber-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10"
                : "bg-slate-900/80 border-white/10 text-slate-300 hover:bg-slate-800"
            )}
          >
            <Star className={cn("w-3.5 h-3.5", showOnlyFavorites && "fill-amber-400 text-amber-400")} />
            <span>Favorites</span>
            {favoritesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-amber-200">
                {favoritesCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Main Canvas ──────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {/* ── Spotlight Live Banner (if any tournament is live) ──────────────── */}
        {spotlightTournament && !showOnlyFavorites && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/30 p-5 sm:p-6 shadow-xl"
          >
            <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-amber-500/10 to-transparent pointer-events-none" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse">
                    <Radio className="w-3.5 h-3.5" />
                    Live Spotlight
                  </span>
                  <span className="text-xs text-amber-400/90 font-medium capitalize">
                    {spotlightTournament.sport} • {spotlightTournament.liveSnippet || "Action in Progress"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {spotlightTournament.name}
                  </h2>
                  {spotlightTournament.season?.trim() ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-amber-200 border border-white/15">
                      {spotlightTournament.season.trim()}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  {spotlightTournament.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {spotlightTournament.city}
                    </span>
                  )}
                  {spotlightTournament.teamsCount !== undefined && spotlightTournament.teamsCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      {spotlightTournament.teamsCount} Franchises
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
                {(() => {
                  const b = spotlightTournament.broadcast;
                  const activeStream =
                    (b?.auction?.status === "live" && b.auction) ||
                    (b?.scoring?.status === "live" && b.scoring) ||
                    (b?.auction?.status === "upcoming" && b.auction) ||
                    (b?.scoring?.status === "upcoming" && b.scoring);

                  if (!activeStream) return null;
                  const isLive = activeStream.status === "live";

                  return (
                    <a
                      href={activeStream.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap border",
                        isLive
                          ? "bg-red-500/20 hover:bg-red-500/30 border-red-500/40 text-red-300 hover:text-white shadow-[0_0_15px_rgba(239,68,68,0.25)]"
                          : "bg-slate-800 hover:bg-slate-700 border-white/10 text-slate-300"
                      )}
                    >
                      {isLive && (
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse motion-reduce:animate-none" />
                      )}
                      <span>
                        {activeStream.title ||
                          (isLive ? "Watch Official Stream" : "Stream Scheduled")}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                    </a>
                  );
                })()}

                <Link
                  to={`/tournament/${spotlightTournament.id}/fan`}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm transition-all shadow-lg shadow-amber-500/25 active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <span>Enter Live Arena</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Search & Filter Controls ────────────────────────────────────────── */}
        <div className="space-y-4 bg-slate-900/60 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-md">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search tournaments by name, city, or venue..."
              className="w-full pl-10 pr-10 py-3 bg-black/40 border border-white/10 focus:border-amber-400/80 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Segmented Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Sport Filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] uppercase font-bold text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Sport:
              </span>
              {[
                { id: "all", label: "All" },
                { id: "cricket", label: "🏏 Cricket" },
                { id: "badminton", label: "🏸 Badminton" },
                { id: "football", label: "⚽ Football" },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedSport(s.id);
                    setPage(1);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border",
                    selectedSport === s.id
                      ? "bg-amber-500/20 border-amber-400/80 text-amber-300 font-bold"
                      : "bg-black/30 border-white/10 text-slate-400 hover:text-white hover:bg-slate-800"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] uppercase font-bold text-slate-500 mr-1">Status:</span>
              {[
                { id: "all", label: "All" },
                { id: "live", label: "🔴 Live Now" },
                { id: "upcoming", label: "Upcoming" },
                { id: "completed", label: "Completed" },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(st.id);
                    setPage(1);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border",
                    selectedStatus === st.id
                      ? "bg-amber-500/20 border-amber-400/80 text-amber-300 font-bold"
                      : "bg-black/30 border-white/10 text-slate-400 hover:text-white hover:bg-slate-800"
                  )}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* City Filter */}
            {availableCities.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] uppercase font-bold text-slate-500 mr-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> City:
                </span>
                <select
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-black/30 border border-white/10 text-slate-300 hover:text-white cursor-pointer focus:outline-none focus:border-amber-400/80 transition-colors"
                >
                  <option value="all">All Cities</option>
                  {availableCities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {selectedCity !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 border border-amber-400/60 text-amber-300">
                    {selectedCity}
                    <button
                      type="button"
                      onClick={() => { setSelectedCity("all"); setPage(1); }}
                      className="ml-0.5 hover:text-white cursor-pointer"
                      aria-label="Clear city filter"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-slate-400">
              <span>
                Filters active • {data?.pagination.total ?? 0} tournament(s) found
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-amber-400 hover:text-amber-300 font-bold cursor-pointer transition-colors"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>

        {/* ── Tournaments Grid / Content ──────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-slate-900/40 border border-white/5 animate-pulse p-5 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/10" />
                    <div className="space-y-1.5 flex-1">
                      <div className="w-3/4 h-4 rounded bg-white/10" />
                      <div className="w-1/2 h-3 rounded bg-white/5" />
                    </div>
                  </div>
                  <div className="w-full h-8 rounded bg-white/5" />
                </div>
                <div className="w-full h-10 rounded bg-white/10" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-16 px-4 rounded-2xl bg-slate-900/40 border border-dashed border-white/10 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Unable to load tournaments</h3>
              <p className="text-xs text-slate-400 mt-1">
                Please check your network connection and try again.
              </p>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl bg-slate-900/40 border border-dashed border-white/10 space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {showOnlyFavorites
                  ? "No Bookmarked Tournaments"
                  : "No Tournaments Found"}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {showOnlyFavorites
                  ? "Click the star icon on any tournament card to add it to your quick bookmarks."
                  : "We couldn't find any tournaments matching your current search or filters."}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all shadow cursor-pointer"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {displayedItems.map((tournament) => {
              const favorited = isFavorite(tournament.id);

              return (
                <motion.div
                  key={tournament.id}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "group relative rounded-2xl bg-slate-900/70 border border-white/10 hover:border-amber-400/50 p-5 flex flex-col justify-between transition-all shadow-lg hover:shadow-amber-500/10",
                    tournament.isLive && "border-amber-500/30 bg-slate-900/90 shadow-amber-500/5"
                  )}
                >
                  <div className="space-y-4">
                    {/* Top Row: Sports / Live Badge & Favorite Toggle */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {tournament.isLive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            Live
                          </span>
                        ) : tournament.status === "completed" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-white/5">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Upcoming
                          </span>
                        )}

                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-white/5 capitalize">
                          {tournament.sport === "cricket"
                            ? "🏏 Cricket"
                            : tournament.sport === "badminton"
                            ? "🏸 Badminton"
                            : tournament.sport}
                        </span>
                      </div>

                      {/* Favorite Button */}
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(tournament.id, e)}
                        title={favorited ? "Remove from bookmarks" : "Save to bookmarks"}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer border",
                          favorited
                            ? "bg-amber-500/20 border-amber-400/60 text-amber-400"
                            : "bg-black/30 border-white/10 text-slate-500 hover:text-white hover:border-white/20"
                        )}
                      >
                        <Star className={cn("w-4 h-4", favorited && "fill-amber-400")} />
                      </button>
                    </div>

                    {/* Tournament Logo & Name */}
                    <div className="flex items-start gap-3.5">
                      {tournament.logoUrl ? (
                        <img
                          src={cldUrl(tournament.logoUrl, "teamLogo")}
                          alt=""
                          className="w-12 h-12 rounded-xl object-contain bg-black/40 border border-white/10 p-1 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0 font-black text-sm">
                          {tournament.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base text-white group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug">
                          {tournament.name}
                        </h3>
                        {tournament.season?.trim() ? (
                          <p className="text-[11px] font-medium text-slate-300 mt-0.5 line-clamp-1">
                            {tournament.season.trim()}
                          </p>
                        ) : null}
                        {tournament.code && (
                          <p className="text-[11px] font-mono font-bold text-amber-400/80 mt-0.5">
                            #{tournament.code}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Metadata Strip */}
                    <div className="space-y-1.5 pt-1 text-xs text-slate-400">
                      {tournament.city && (
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="truncate">{tournament.venue ? `${tournament.venue}, ` : ""}{tournament.city}</span>
                        </div>
                      )}
                      {(tournament.auctionDate || tournament.matchDates) && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span>{formatFanDate(tournament.auctionDate) || formatFanDate(tournament.matchDates?.split(",")[0])}</span>
                        </div>
                      )}
                    </div>

                    {/* Module Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-white/5">
                      {tournament.auctionEnabled && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                          ⚡ Auction
                        </span>
                      )}
                      {tournament.scoringEnabled && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          {tournament.sport === "badminton" ? "🏸 Court Scoring" : "🏏 Match Scoring"}
                        </span>
                      )}
                      {tournament.teamsCount !== undefined && tournament.teamsCount > 0 && (
                        <span className="text-[10px] text-slate-500 font-medium ml-auto">
                          {tournament.teamsCount} Teams
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action CTA */}
                  <div className="pt-4 mt-3 space-y-2">
                    {/* Official Broadcast CTA if available */}
                    {(() => {
                      const b = tournament.broadcast;
                      const auctionStream = b?.auction?.url ? b.auction : null;
                      const scoringStream = b?.scoring?.url ? b.scoring : null;
                      if (!auctionStream && !scoringStream) return null;

                      return (
                        <div className="flex flex-col gap-1.5">
                          {auctionStream && (
                            <a
                              href={auctionStream.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "w-full flex items-center justify-between gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all group/stream cursor-pointer",
                                auctionStream.status === "live"
                                  ? "bg-red-500/15 hover:bg-red-500/25 border-red-500/35 text-red-300 hover:text-white shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                                  : auctionStream.status === "upcoming"
                                  ? "bg-slate-800/80 hover:bg-slate-700/80 border-white/10 text-slate-300"
                                  : "bg-slate-900 border-white/5 text-slate-400"
                              )}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                {auctionStream.status === "live" ? (
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse motion-reduce:animate-none shrink-0" />
                                ) : (
                                  <Clock className="w-3 h-3 text-sky-400 shrink-0" />
                                )}
                                <span className="truncate">
                                  {auctionStream.title ||
                                    (auctionStream.status === "live"
                                      ? "Watch Auction Live"
                                      : "Auction Stream Scheduled")}
                                </span>
                              </div>
                              <ExternalLink className="w-3 h-3 opacity-60 group-hover/stream:opacity-100 shrink-0" />
                            </a>
                          )}

                          {scoringStream && (
                            <a
                              href={scoringStream.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "w-full flex items-center justify-between gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all group/stream cursor-pointer",
                                scoringStream.status === "live"
                                  ? "bg-red-500/15 hover:bg-red-500/25 border-red-500/35 text-red-300 hover:text-white shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                                  : scoringStream.status === "upcoming"
                                  ? "bg-slate-800/80 hover:bg-slate-700/80 border-white/10 text-slate-300"
                                  : "bg-slate-900 border-white/5 text-slate-400"
                              )}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                {scoringStream.status === "live" ? (
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse motion-reduce:animate-none shrink-0" />
                                ) : (
                                  <Clock className="w-3 h-3 text-sky-400 shrink-0" />
                                )}
                                <span className="truncate">
                                  {scoringStream.title ||
                                    (scoringStream.status === "live"
                                      ? "Watch Match Live"
                                      : "Match Stream Scheduled")}
                                </span>
                              </div>
                              <ExternalLink className="w-3 h-3 opacity-60 group-hover/stream:opacity-100 shrink-0" />
                            </a>
                          )}
                        </div>
                      );
                    })()}

                    <Link
                      to={`/tournament/${tournament.id}/fan`}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-amber-500 group-hover:bg-amber-500 hover:text-slate-950 group-hover:text-slate-950 text-white font-bold text-xs transition-all shadow active:scale-[0.98] cursor-pointer"
                    >
                      <span>Enter Spectator Arena</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Pagination ──────────────────────────────────────────────────────── */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-6 pb-12">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 bg-slate-900 border border-white/10 hover:bg-slate-800 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              Previous
            </button>
            <span className="text-xs text-slate-400 font-medium">
              Page {data.pagination.page} of {data.pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={!data.pagination.hasMore}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 bg-slate-900 border border-white/10 hover:bg-slate-800 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
