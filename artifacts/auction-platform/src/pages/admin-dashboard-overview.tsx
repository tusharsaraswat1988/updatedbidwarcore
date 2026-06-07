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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AdminOrganizerRow,
  AdminTournamentRow,
  listAdminOrganizers,
  listAdminTournaments,
} from "@/lib/auth";
import { organizerAccessLabel } from "@workspace/api-base/organizer-account";
import { tournamentLiveOpsPath } from "@/lib/admin-live-ops-paths";
import { useAdminAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-media-query";

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: typeof Trophy;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const live = status === "active";
  return (
    <Badge className={live ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"}>
      {live ? "Live" : status}
    </Badge>
  );
}

export default function AdminDashboardOverview() {
  const [, navigate] = useLocation();
  const { isLoggedIn, isLoading } = useAdminAuth();
  const isMobile = useIsMobile();
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
  const [organisers, setOrganisers] = useState<AdminOrganizerRow[]>([]);
  const [loading, setLoading] = useState(true);

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
          <MetricCard label="Players" value="--" sub="across platform" icon={Users} />
          <MetricCard label="Revenue" value="--" sub="month to date" icon={Wallet} />
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
              <div className="px-4 py-3 text-sm text-muted-foreground">Loading live auctions...</div>
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
                  <StatusBadge status={t.status} />
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
            <div className="divide-y divide-border">
              {tournaments.slice(0, 8).map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/admin/tournaments/${t.id}`)}
                  className="grid w-full grid-cols-[1fr_160px_110px_130px] items-center gap-4 px-4 py-2.5 text-left text-sm hover:bg-accent/50"
                >
                  <span className="font-medium text-white">{t.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{t.organizerName || "No organiser"}</span>
                  <StatusBadge status={t.status} />
                  <span className="text-right text-xs text-muted-foreground">{t.auctionDate || "No date"}</span>
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
