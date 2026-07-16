import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Building2,
  Radio,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AdminOrganizerRow,
  AdminTournamentRow,
  fetchAdminTournamentDetail,
  listAdminOrganizers,
  listAdminTournaments,
} from "@/lib/auth";
import { organizerAccessLabel } from "@workspace/api-base/organizer-account";
import { tournamentLiveOpsPath } from "@/lib/admin-live-ops-paths";
import { useAdminAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-media-query";
import { AdminRecentActivityFeed } from "@/components/admin/admin-recent-activity-feed";
import { MetricCard } from "@/components/admin/admin-metric-card";
import { StatusBadge } from "@/components/admin/admin-status-badge";
import { AdminListHeader } from "@/components/admin/admin-list-header";

function TournamentStatusBadge({ status }: { status: string }) {
  const live = status === "active";
  return <StatusBadge tone={live ? "green" : "muted"}>{live ? "Live" : status}</StatusBadge>;
}

export default function AdminDashboardOverview() {
  const [, navigate] = useLocation();
  const { isLoggedIn, isLoading } = useAdminAuth();
  const isMobile = useIsMobile();
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
  const [organisers, setOrganisers] = useState<AdminOrganizerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformStats, setPlatformStats] = useState<{ totalPlayers: number; revenue: number } | null>(null);
  const [platformStatsLoading, setPlatformStatsLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) navigate("/admin/login");
  }, [isLoading, isLoggedIn, navigate]);

  useEffect(() => {
    if (!isLoading && isLoggedIn && isMobile) navigate("/admin/live/auctions");
  }, [isLoading, isLoggedIn, isMobile, navigate]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([listAdminTournaments(), listAdminOrganizers()])
      .then(([tournamentRows, organiserRows]) => {
        if (cancelled) return;
        setTournaments(tournamentRows);
        setOrganisers(organiserRows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  // Aggregate real platform-wide player and revenue totals from per-tournament
  // detail records instead of showing an unwired "--" placeholder.
  useEffect(() => {
    if (!isLoggedIn || loading) return;
    if (!tournaments.length) {
      setPlatformStats({ totalPlayers: 0, revenue: 0 });
      setPlatformStatsLoading(false);
      return;
    }
    let cancelled = false;
    setPlatformStatsLoading(true);
    Promise.all(tournaments.map((t) => fetchAdminTournamentDetail(t.id)))
      .then((details) => {
        if (cancelled) return;
        let totalPlayers = 0;
        let revenue = 0;
        for (const detail of details) {
          if (!detail) continue;
          totalPlayers += detail.playerCounts.total;
          for (const p of detail.players) {
            if (p.status === "sold" && p.soldPrice) revenue += p.soldPrice;
          }
        }
        setPlatformStats({ totalPlayers, revenue });
      })
      .finally(() => {
        if (!cancelled) setPlatformStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, loading, tournaments]);

  function formatRevenue(amount: number) {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    return `₹${amount.toLocaleString("en-IN")}`;
  }

  const stats = useMemo(() => {
    const live = tournaments.filter((t) => t.licenseStatus === "active" && !t.adminLocked);
    const lockedOrganisers = organisers.filter((o) => organizerAccessLabel(o.licenseStatus) === "locked");
    return {
      live,
      activeTournaments: tournaments.filter((t) => t.licenseStatus !== "completed"),
      lockedOrganisers,
    };
  }, [organisers, tournaments]);

  if (isLoading || !isLoggedIn || isMobile) return null;

  return (
    <AdminShell title="Dashboard" eyebrow="Platform overview">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Live Auctions" value={stats.live.length} sub="currently active" icon={Radio} />
          <MetricCard label="Tournaments" value={tournaments.length} sub={`${stats.activeTournaments.length} active/trial`} icon={Trophy} />
          <MetricCard label="Organisers" value={organisers.length} sub={`${stats.lockedOrganisers.length} locked`} icon={Building2} />
          <MetricCard
            label="Players"
            value={platformStats?.totalPlayers ?? 0}
            sub="across platform"
            icon={Users}
            loading={platformStatsLoading}
          />
          <MetricCard
            label="Revenue"
            value={platformStats ? formatRevenue(platformStats.revenue) : "₹0"}
            sub="total sold value"
            icon={Wallet}
            loading={platformStatsLoading}
          />
          <MetricCard label="Attention" value={stats.lockedOrganisers.length} sub="locked accounts" icon={AlertTriangle} />
        </div>

        <div className="rounded-xl border border-border bg-card/70">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="font-display text-base font-black text-white">Live Now</h2>
              <p className="text-xs text-muted-foreground">Primary auction operations, ordered for fast handoff.</p>
            </div>
            <Button size="sm" onClick={() => navigate("/admin/live/auctions")}>
              Open Live Operations
            </Button>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : stats.live.length ? (
              stats.live.slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(tournamentLiveOpsPath(t.id, "monitor"))}
                  className="block w-full px-4 py-3 text-left text-sm hover:bg-accent/50 md:grid md:grid-cols-[1fr_140px_160px_120px] md:items-center md:gap-4"
                >
                  <div>
                    <div className="font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.sport} · ID #{t.id}</div>
                  </div>
                  <TournamentStatusBadge status={t.status} />
                  <div className="truncate text-xs text-muted-foreground">{t.organizerName || "No organiser linked"}</div>
                  <div className="text-right text-xs font-semibold text-primary">Open monitor →</div>
                </button>
              ))
            ) : (
              <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
                <span>No live auctions right now.</span>
                <Button variant="outline" size="sm" onClick={() => navigate("/admin/tournaments")}>
                  View scheduled
                </Button>
              </div>
            )}
          </div>
        </div>

        <AdminRecentActivityFeed />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
          <div className="rounded-xl border border-border bg-card/70">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-display text-base font-black text-white">Requires Attention</h2>
            </div>
            <div className="space-y-2 p-4 text-sm">
              {stats.lockedOrganisers.length ? (
                <button
                  onClick={() => navigate("/admin/organisers")}
                  className="flex w-full items-center justify-between rounded-lg bg-red-500/10 px-3 py-2 text-left text-red-300"
                >
                  <span>{stats.lockedOrganisers.length} organiser account{stats.lockedOrganisers.length !== 1 ? "s" : ""} locked</span>
                  <span>Review →</span>
                </button>
              ) : (
                <div className="rounded-lg bg-muted/20 px-3 py-2 text-muted-foreground">
                  No locked organiser accounts.
                </div>
              )}
              <div className="rounded-lg bg-muted/20 px-3 py-2 text-muted-foreground">
                Display and owner app connection alerts appear in Live Operations.
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/70">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-display text-base font-black text-white">Recent Tournaments</h2>
            </div>
            <AdminListHeader
              gridClassName="sm:grid sm:grid-cols-[1fr_160px_110px_130px]"
              columns={[
                { label: "Tournament" },
                { label: "Organiser" },
                { label: "Status" },
                { label: "Date", align: "right" },
              ]}
            />
            <div className="divide-y divide-border">
              {tournaments.slice(0, 8).map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/admin/tournaments/${t.id}`)}
                  className="block w-full px-4 py-2.5 text-left text-sm hover:bg-accent/50 sm:grid sm:grid-cols-[1fr_160px_110px_130px] sm:items-center sm:gap-4"
                >
                  <span className="font-medium text-white">{t.name}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground sm:mt-0">
                    {t.organizerName || "No organiser"}
                  </span>
                  <div className="mt-1.5 flex items-center gap-2 sm:mt-0 sm:contents">
                    <TournamentStatusBadge status={t.status} />
                    <span className="text-xs text-muted-foreground sm:hidden">{t.auctionDate || "No date"}</span>
                  </div>
                  <span className="hidden text-right text-xs text-muted-foreground sm:block">
                    {t.auctionDate || "No date"}
                  </span>
                </button>
              ))}
              {!tournaments.length && (
                <div className="px-4 py-3 text-sm text-muted-foreground">No tournaments yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5 rounded-xl border border-border bg-card/70 px-4 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 text-green-400"><BadgeCheck className="h-3.5 w-3.5" /> API healthy</span>
          <span>SMS configured</span>
          <span>Reports available</span>
          <span className="flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Last refreshed now</span>
        </div>
      </div>
    </AdminShell>
  );
}
