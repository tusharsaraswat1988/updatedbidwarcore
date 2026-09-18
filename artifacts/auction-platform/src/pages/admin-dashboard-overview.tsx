import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Building2,
  Calendar,
  CalendarDays,
  ExternalLink,
  Flame,
  Layers,
  Plus,
  Radio,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AdminOrganizerRow,
  AdminTournamentRow,
  fetchAdminTournamentDetail,
  listAdminOrganizers,
  listAdminTournaments,
} from "@/lib/auth";
import { tournamentLiveOpsPath } from "@/lib/admin-live-ops-paths";
import { useAdminAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-media-query";
import { CreateTournamentModal, LicenseBadge } from "@/pages/admin";

function getSportBadge(sportName?: string) {
  const s = (sportName || "general").toLowerCase();
  if (s.includes("badminton")) return { label: "Badminton", emoji: "🏸", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  if (s.includes("cricket")) return { label: "Cricket", emoji: "🏏", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
  if (s.includes("football") || s.includes("soccer")) return { label: "Football", emoji: "⚽", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
  if (s.includes("volleyball")) return { label: "Volleyball", emoji: "🏐", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" };
  if (s.includes("kabaddi")) return { label: "Kabaddi", emoji: "🤼", color: "bg-orange-500/15 text-orange-400 border-orange-500/30" };
  if (s.includes("esport") || s.includes("gaming")) return { label: "Esports", emoji: "🎮", color: "bg-pink-500/15 text-pink-400 border-pink-500/30" };
  return { label: sportName || "Sports", emoji: "🏆", color: "bg-primary/15 text-primary border-primary/30" };
}

function parseDateSafe(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function isDateInCurrentMonthOrUpcoming(dateStr?: string | null): boolean {
  const d = parseDateSafe(dateStr);
  if (!d) return false;
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const isThisMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  const diffDays = (d.getTime() - now.getTime()) / (1000 * 3600 * 24);
  return isThisMonth || (diffDays >= 0 && diffDays <= 30);
}

function formatDisplayDate(dateStr?: string | null, timeStr?: string | null): string {
  if (!dateStr) return "Date not set";
  const d = parseDateSafe(dateStr);
  if (!d) return dateStr;
  const dateFormatted = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return timeStr ? `${dateFormatted} at ${timeStr}` : dateFormatted;
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "Recently";
  const d = parseDateSafe(dateStr);
  if (!d) return dateStr;
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const diffDays = Math.floor(diffSec / 86400);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AdminDashboardOverview() {
  const [, navigate] = useLocation();
  const { isLoggedIn, isLoading } = useAdminAuth();
  const isMobile = useIsMobile();
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
  const [organisers, setOrganisers] = useState<AdminOrganizerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformStats, setPlatformStats] = useState<{ totalPlayers: number } | null>(null);
  const [platformStatsLoading, setPlatformStatsLoading] = useState(true);
  const [createTournamentOpen, setCreateTournamentOpen] = useState(false);
  const [tournamentTab, setTournamentTab] = useState<"scheduled" | "recent" | "all">("scheduled");

  useEffect(() => {
    if (!isLoading && !isLoggedIn) navigate("/admin/login");
  }, [isLoading, isLoggedIn, navigate]);

  useEffect(() => {
    if (!isLoading && isLoggedIn && isMobile) navigate("/admin/live/auctions");
  }, [isLoading, isLoggedIn, isMobile, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tRows, oRows] = await Promise.all([listAdminTournaments(), listAdminOrganizers()]);
      setTournaments(tRows);
      setOrganisers(oRows);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    loadData();
  }, [isLoggedIn]);

  // Total player count across tournaments
  useEffect(() => {
    if (!isLoggedIn || loading) return;
    if (!tournaments.length) {
      setPlatformStats({ totalPlayers: 0 });
      setPlatformStatsLoading(false);
      return;
    }
    let cancelled = false;
    setPlatformStatsLoading(true);
    Promise.all(tournaments.map((t) => fetchAdminTournamentDetail(t.id)))
      .then((details) => {
        if (cancelled) return;
        let totalPlayers = 0;
        for (const detail of details) {
          if (detail?.playerCounts?.total) {
            totalPlayers += detail.playerCounts.total;
          }
        }
        setPlatformStats({ totalPlayers });
      })
      .finally(() => {
        if (!cancelled) setPlatformStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, loading, tournaments]);

  const stats = useMemo(() => {
    const live = tournaments.filter((t) => (t.status === "active" || t.licenseStatus === "active") && !t.adminLocked);
    const activeTournaments = tournaments.filter((t) => t.licenseStatus !== "completed");
    const scheduledThisMonth = tournaments.filter((t) => isDateInCurrentMonthOrUpcoming(t.auctionDate));
    const verifiedOrganisers = organisers.filter((o) => o.phoneVerified || o.phoneStatus === "verified");

    // Unique sports
    const sportCounts = new Map<string, number>();
    for (const t of tournaments) {
      const s = (t.sport || "Other").trim();
      const normalized = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      sportCounts.set(normalized, (sportCounts.get(normalized) || 0) + 1);
    }

    // Organisers sorted by join date
    const recentOrganisers = [...organisers].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return tb - ta;
    });

    // Tournaments sorted by creation date
    const recentTournaments = [...tournaments].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return tb - ta;
    });

    // Upcoming scheduled tournaments
    const upcomingScheduled = tournaments
      .filter((t) => t.auctionDate)
      .sort((a, b) => {
        const da = parseDateSafe(a.auctionDate)?.getTime() ?? 0;
        const db = parseDateSafe(b.auctionDate)?.getTime() ?? 0;
        return da - db;
      });

    return {
      live,
      activeTournaments,
      scheduledThisMonth,
      verifiedOrganisers,
      sportCounts,
      recentOrganisers,
      recentTournaments,
      upcomingScheduled,
    };
  }, [organisers, tournaments]);

  if (isLoading || !isLoggedIn || isMobile) return null;

  return (
    <AdminShell
      title="Dashboard"
      eyebrow="Platform Overview"
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/admin/live/auctions")}
            className="gap-1.5 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
          >
            <Radio className="h-3.5 w-3.5" />
            Live Arena
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateTournamentOpen(true)}
            className="gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 font-semibold text-white shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-amber-700"
          >
            <Plus className="h-4 w-4" />
            New Tournament
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card/90 to-primary/5 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                BidWar Platform Active & Operational
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                Welcome back to BidWar Admin 🎯
              </h1>
              <p className="text-sm text-muted-foreground">
                Track live auctions, scheduled matchdays, organizer registrations, and player pipelines in real time.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5 text-xs font-medium"
                onClick={() => navigate("/admin/organisers")}
              >
                <Users className="h-3.5 w-3.5 text-primary" />
                {organisers.length} Organisers
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5 text-xs font-medium"
                onClick={() => navigate("/admin/tournaments")}
              >
                <Trophy className="h-3.5 w-3.5 text-amber-400" />
                {tournaments.length} Tournaments
              </Button>
            </div>
          </div>
        </div>

        {/* 6 Cheerful & Logical Top Metric Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {/* Card 1: Live Auctions */}
          <div
            onClick={() => navigate("/admin/live/auctions")}
            className="group relative cursor-pointer overflow-hidden rounded-xl border border-red-500/30 bg-gradient-to-br from-red-500/10 via-card to-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-red-500/60 hover:shadow-lg hover:shadow-red-500/10"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-red-400">Live Auctions</span>
              <div className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
                <Radio className="h-3.5 w-3.5" />
                {stats.live.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 animate-ping" />
                )}
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-14" />
            ) : (
              <div className="text-2xl sm:text-3xl font-black text-foreground">{stats.live.length}</div>
            )}
            <div className="mt-1 text-[11px] font-medium text-red-300/80">
              {stats.live.length > 0 ? "Streaming live now" : "None active right now"}
            </div>
          </div>

          {/* Card 2: Total Tournaments */}
          <div
            onClick={() => navigate("/admin/tournaments")}
            className="group relative cursor-pointer overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/60 hover:shadow-lg hover:shadow-amber-500/10"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Tournaments</span>
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                <Trophy className="h-3.5 w-3.5" />
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-14" />
            ) : (
              <div className="text-2xl sm:text-3xl font-black text-foreground">{tournaments.length}</div>
            )}
            <div className="mt-1 text-[11px] font-medium text-amber-300/80">
              {stats.activeTournaments.length} active / pipeline
            </div>
          </div>

          {/* Card 3: Scheduled This Month */}
          <div
            onClick={() => {
              setTournamentTab("scheduled");
              window.scrollTo({ top: 380, behavior: "smooth" });
            }}
            className="group relative cursor-pointer overflow-hidden rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-card to-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-500/60 hover:shadow-lg hover:shadow-sky-500/10"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">This Month</span>
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
                <CalendarDays className="h-3.5 w-3.5" />
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-14" />
            ) : (
              <div className="text-2xl sm:text-3xl font-black text-foreground">{stats.scheduledThisMonth.length}</div>
            )}
            <div className="mt-1 text-[11px] font-medium text-sky-300/80">scheduled auctions</div>
          </div>

          {/* Card 4: Registered Organisers */}
          <div
            onClick={() => navigate("/admin/organisers")}
            className="group relative cursor-pointer overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Organisers</span>
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <Building2 className="h-3.5 w-3.5" />
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-14" />
            ) : (
              <div className="text-2xl sm:text-3xl font-black text-foreground">{organisers.length}</div>
            )}
            <div className="mt-1 text-[11px] font-medium text-emerald-300/80">
              {stats.verifiedOrganisers.length} verified accounts
            </div>
          </div>

          {/* Card 5: Total Players */}
          <div className="group relative overflow-hidden rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-card to-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Players</span>
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
                <Users className="h-3.5 w-3.5" />
              </div>
            </div>
            {platformStatsLoading ? (
              <Skeleton className="h-8 w-14" />
            ) : (
              <div className="text-2xl sm:text-3xl font-black text-foreground">
                {platformStats?.totalPlayers ?? 0}
              </div>
            )}
            <div className="mt-1 text-[11px] font-medium text-purple-300/80">across all squads</div>
          </div>

          {/* Card 6: Active Sports */}
          <div
            onClick={() => navigate("/admin/tournaments/sports")}
            className="group relative cursor-pointer overflow-hidden rounded-xl border border-pink-500/30 bg-gradient-to-br from-pink-500/10 via-card to-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-pink-500/60 hover:shadow-lg hover:shadow-pink-500/10"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-pink-400">Sports</span>
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-pink-500/20 text-pink-400">
                <Flame className="h-3.5 w-3.5" />
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-14" />
            ) : (
              <div className="text-2xl sm:text-3xl font-black text-foreground">{stats.sportCounts.size}</div>
            )}
            <div className="mt-1 text-[11px] font-medium text-pink-300/80">multi-format active</div>
          </div>
        </div>

        {/* Live Spotlight / Arena Status */}
        {stats.live.length > 0 ? (
          <div className="rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/15 via-card to-card p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
                  <Radio className="h-5 w-5" />
                  <span className="absolute -right-1 -top-1 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-500/20 text-red-300 border-red-500/30 uppercase text-[10px] font-bold tracking-wider">
                      Live Auction Matchday
                    </Badge>
                    <span className="text-xs font-semibold text-white">{stats.live[0].name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {stats.live[0].sport} · Organised by {stats.live[0].organizerName || "Verified Host"} · #{stats.live[0].id}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/live/${stats.live[0].id}`)}
                  className="gap-1 text-xs"
                >
                  <ExternalLink className="h-3 w-3" /> Live Viewer
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate(tournamentLiveOpsPath(stats.live[0].id, "monitor"))}
                  className="gap-1 bg-red-600 text-white hover:bg-red-700 text-xs font-semibold"
                >
                  Open Live Monitor <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">Auction Readiness & Pipeline</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.upcomingScheduled.length > 0
                      ? `Next scheduled tournament: "${stats.upcomingScheduled[0].name}" on ${formatDisplayDate(stats.upcomingScheduled[0].auctionDate, stats.upcomingScheduled[0].auctionTime)}`
                      : "All systems ready. No auctions actively streaming right now."}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCreateTournamentOpen(true)}
                className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
              >
                <Plus className="h-3.5 w-3.5" /> Schedule New Auction
              </Button>
            </div>
          </div>
        )}

        {/* 2 Main Columns: Tournaments Radar & Organisers Activity */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left / Center Column (7 Cols): Tournaments Pipeline */}
          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-xl border border-border bg-card/70 overflow-hidden shadow-sm">
              {/* Header with Filter Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border p-4 gap-3">
                <div>
                  <h2 className="font-display text-base font-black text-foreground flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-400" />
                    Tournament Pipeline
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Scheduled dates, active tournaments, and recent setups
                  </p>
                </div>

                <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-1 text-xs">
                  <button
                    onClick={() => setTournamentTab("scheduled")}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      tournamentTab === "scheduled"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Scheduled ({stats.upcomingScheduled.length})
                  </button>
                  <button
                    onClick={() => setTournamentTab("recent")}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      tournamentTab === "recent"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Recently Created
                  </button>
                  <button
                    onClick={() => setTournamentTab("all")}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      tournamentTab === "all"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All ({tournaments.length})
                  </button>
                </div>
              </div>

              {/* Tournament List */}
              <div className="divide-y divide-border">
                {loading ? (
                  <div className="space-y-2 p-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : (
                  (() => {
                    const list =
                      tournamentTab === "scheduled"
                        ? stats.upcomingScheduled.slice(0, 7)
                        : tournamentTab === "recent"
                        ? stats.recentTournaments.slice(0, 7)
                        : tournaments.slice(0, 7);

                    if (list.length === 0) {
                      return (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                          <Trophy className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                          <p className="font-semibold text-foreground">No tournaments found in this view</p>
                          <p className="text-xs mt-1">Create a new tournament to get started.</p>
                          <Button
                            size="sm"
                            onClick={() => setCreateTournamentOpen(true)}
                            className="mt-3 gap-1 text-xs"
                          >
                            <Plus className="h-3.5 w-3.5" /> Create Tournament
                          </Button>
                        </div>
                      );
                    }

                    return list.map((t) => {
                      const sport = getSportBadge(t.sport);
                      return (
                        <div
                          key={t.id}
                          onClick={() => navigate(`/admin/tournaments/${t.id}`)}
                          className="group flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 hover:bg-accent/40 cursor-pointer transition-colors gap-3"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                                {t.name}
                              </span>
                              <Badge variant="outline" className={`text-[10px] gap-1 px-1.5 py-0 ${sport.color}`}>
                                <span>{sport.emoji}</span>
                                <span>{sport.label}</span>
                              </Badge>
                              <LicenseBadge status={t.licenseStatus} />
                              {t.status === "active" && (
                                <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px] uppercase font-bold">
                                  Live
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3 text-muted-foreground/70" />
                                {t.organizerName || "Unassigned Organiser"}
                              </span>
                              <span>·</span>
                              <span className="flex items-center gap-1 font-medium text-foreground/80">
                                <Calendar className="h-3 w-3 text-primary/70" />
                                {formatDisplayDate(t.auctionDate, t.auctionTime)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs font-semibold text-primary group-hover:bg-primary/10"
                            >
                              Manage →
                            </Button>
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
              </div>

              {tournaments.length > 7 && (
                <div className="border-t border-border p-3 text-center bg-card/40">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs font-semibold text-primary gap-1"
                    onClick={() => navigate("/admin/tournaments")}
                  >
                    View all {tournaments.length} tournaments <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 Cols): Organiser Onboarding & Creation Pulse */}
          <div className="space-y-6 lg:col-span-5">
            {/* Recent Organiser Signups ("Kon Register Hua") */}
            <div className="rounded-xl border border-border bg-card/70 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b border-border p-4">
                <div>
                  <h2 className="font-display text-base font-black text-foreground flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-emerald-400" />
                    New Organisers
                  </h2>
                  <p className="text-xs text-muted-foreground">Recently joined tournament hosts</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/admin/organisers")}
                  className="text-xs h-7 px-2.5"
                >
                  All ({organisers.length})
                </Button>
              </div>

              <div className="divide-y divide-border">
                {loading ? (
                  <div className="space-y-2 p-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : stats.recentOrganisers.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground">No organisers registered yet.</p>
                ) : (
                  stats.recentOrganisers.slice(0, 5).map((org) => {
                    const isVerified = org.phoneVerified || org.phoneStatus === "verified";
                    return (
                      <div
                        key={org.id}
                        onClick={() => navigate(`/admin/organisers/${org.id}`)}
                        className="flex items-center justify-between p-3.5 hover:bg-accent/40 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 font-black text-xs">
                            {org.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-foreground truncate">{org.name}</span>
                              {isVerified && (
                                <BadgeCheck className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {org.mobile || org.email || "No direct contact"} · {org.tournamentCount} tournament{org.tournamentCount !== 1 ? "s" : ""}
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0 pl-2">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {formatRelativeTime(org.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Platform Sports Breakdown */}
            <div className="rounded-xl border border-border bg-card/70 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm font-black text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Sports Represented
                </h3>
                <span className="text-xs text-muted-foreground font-medium">
                  {stats.sportCounts.size} active formats
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {Array.from(stats.sportCounts.entries()).map(([sportName, count]) => {
                  const badge = getSportBadge(sportName);
                  return (
                    <div
                      key={sportName}
                      onClick={() => navigate("/admin/tournaments")}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition-all hover:scale-105 ${badge.color}`}
                    >
                      <span>{badge.emoji}</span>
                      <span>{sportName}</span>
                      <span className="ml-1 rounded-full bg-background/50 px-1.5 py-0.5 text-[10px] font-bold">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Tournament Modal */}
      <AnimatePresence>
        {createTournamentOpen && (
          <CreateTournamentModal
            onClose={() => setCreateTournamentOpen(false)}
            onCreated={loadData}
          />
        )}
      </AnimatePresence>
    </AdminShell>
  );
}
