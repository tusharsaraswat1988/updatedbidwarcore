import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Redirect, useLocation } from "wouter";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Gavel,
  Monitor,
  Radio,
  RefreshCw,
  ShieldAlert,
  Tv,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { LiveAuctionMonitor } from "@/components/admin/live-auction-monitor";
import { LiveDisplaysPanel } from "@/components/admin/live-displays-panel";
import { LiveEmergencyPanel } from "@/components/admin/live-emergency-panel";
import { LiveOwnerAppsPanel } from "@/components/admin/live-owner-apps-panel";
import { LiveOperatorSessionsPanel } from "@/components/admin/live-operator-sessions-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AdminTournamentDetail,
  AdminTournamentRow,
  fetchAdminTournamentDetail,
  listAdminTournaments,
} from "@/lib/auth";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";

const tabs = [
  { id: "auctions", label: "Live Auctions", href: "/admin/live/auctions", icon: Radio },
  { id: "monitor", label: "Auction Monitor", href: "/admin/live/monitor", icon: Activity },
  { id: "displays", label: "Connected Displays", href: "/admin/live/displays", icon: Tv },
  { id: "owner-apps", label: "Connected Owner Apps", href: "/admin/live/owner-apps", icon: Users },
  { id: "sessions", label: "Operator Sessions", href: "/admin/live/sessions", icon: Monitor },
  { id: "emergency", label: "Emergency Controls", href: "/admin/live/emergency", icon: ShieldAlert },
];

function getSection(pathname: string) {
  if (pathname.includes("/monitor")) return "monitor";
  if (pathname.includes("/displays")) return "displays";
  if (pathname.includes("/owner-apps")) return "owner-apps";
  if (pathname.includes("/sessions")) return "sessions";
  if (pathname.includes("/emergency")) return "emergency";
  return "auctions";
}

function getId(pathname: string) {
  const match = pathname.match(/\/admin\/live\/(?:monitor|emergency|displays|owner-apps|sessions)\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function LiveStatus({ tournament }: { tournament: AdminTournamentRow }) {
  const live = tournament.licenseStatus === "active" && !tournament.adminLocked;
  return (
    <Badge className={live ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"}>
      {live ? "Live" : tournament.licenseStatus}
    </Badge>
  );
}

function TabBar({ active }: { active: string }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`flex flex-shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
              isActive
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border bg-card/70 text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

function LiveAuctions({
  liveTournaments,
  allTournaments,
  navigate,
}: {
  liveTournaments: AdminTournamentRow[];
  allTournaments: AdminTournamentRow[];
  navigate: (path: string) => void;
}) {
  const scheduled = allTournaments.filter((t) => t.licenseStatus !== "completed" && t.licenseStatus !== "active");
  const rows = liveTournaments.length ? liveTournaments : scheduled.slice(0, 8);
  return (
    <div className="rounded-xl border border-border bg-card/70">
      <div className="hidden border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:grid md:grid-cols-[1fr_120px_180px_140px_140px]">
        <span>Tournament</span>
        <span>Status</span>
        <span>Organiser</span>
        <span>Auction date</span>
        <span className="text-right">Action</span>
      </div>
      {rows.map((t) => (
        <button
          key={t.id}
          onClick={() => navigate(`/admin/live/monitor/${t.id}`)}
          className="block w-full border-b border-border px-4 py-3 text-left text-sm last:border-b-0 hover:bg-accent/50 md:grid md:grid-cols-[1fr_120px_180px_140px_140px] md:items-center md:gap-4"
        >
          <div className="min-w-0">
            <div className="font-semibold text-white">{t.name}</div>
            <div className="text-xs text-muted-foreground">{t.sport} · ID #{t.id}</div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 md:mt-0">
            <LiveStatus tournament={t} />
            <span className="text-xs text-muted-foreground md:hidden">{t.organizerName || "No organiser"}</span>
          </div>
          <div className="mt-1 hidden truncate text-xs text-muted-foreground md:block">{t.organizerName || "No organiser"}</div>
          <div className="mt-1 text-xs text-muted-foreground md:mt-0">{t.auctionDate || "Not set"}</div>
          <div className="mt-2 text-xs font-semibold text-primary md:mt-0 md:text-right">
            {t.licenseStatus === "active" ? "Open monitor" : "Prepare"}
          </div>
        </button>
      ))}
      {!liveTournaments.length && !scheduled.length && (
        <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
          <span>No live or scheduled auctions.</span>
          <Button size="sm" variant="outline" onClick={() => navigate("/admin/tournaments")}>
            View tournaments
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminLiveOperations() {
  const [location, navigate] = useLocation();
  const { isLoggedIn, isLoading, isMaster } = useAdminPageGuard();
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
  const [detail, setDetail] = useState<AdminTournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const section = getSection(location);
  const tournamentId = getId(location);

  const reloadTournaments = useCallback(() => {
    return listAdminTournaments().then((rows) => setTournaments(rows));
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    setLoading(true);
    reloadTournaments().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, reloadTournaments]);

  useEffect(() => {
    if (!tournamentId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    fetchAdminTournamentDetail(tournamentId).then((data) => {
      if (!cancelled) setDetail(data);
    });
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  const liveTournaments = useMemo(
    () => tournaments.filter((t) => t.licenseStatus === "active" && !t.adminLocked),
    [tournaments],
  );

  const lockedCount = useMemo(() => tournaments.filter((t) => t.adminLocked).length, [tournaments]);

  useEffect(() => {
    if (section !== "monitor" || tournamentId || liveTournaments.length !== 1) return;
    navigate(`/admin/live/monitor/${liveTournaments[0].id}`);
  }, [section, tournamentId, liveTournaments, navigate]);

  if (location === "/admin/live") return <Redirect to="/admin/live/auctions" />;
  if (isLoading || !isLoggedIn) return null;

  return (
    <AdminShell
      title="Live Operations"
      eyebrow="Auction operations command center"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true);
            reloadTournaments().finally(() => setLoading(false));
            if (tournamentId) {
              fetchAdminTournamentDetail(tournamentId).then(setDetail);
            }
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Live Auctions</div>
            <div className="mt-2 text-2xl font-black text-white">{liveTournaments.length}</div>
          </div>
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Displays</div>
            <div className="mt-2 text-2xl font-black text-white">{liveTournaments.length}</div>
            <div className="text-xs text-muted-foreground">active endpoints</div>
          </div>
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Owner Apps</div>
            <div className="mt-2 text-2xl font-black text-white">
              {detail?.teams.length ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              {tournamentId ? "teams in focus" : "select tournament"}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Emergency</div>
            <div className="mt-2 text-2xl font-black text-white">{lockedCount}</div>
            <div className="text-xs text-muted-foreground">locked auctions</div>
          </div>
        </div>

        <TabBar active={section} />

        {loading ? (
          <div className="rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
            Loading operations data...
          </div>
        ) : section === "auctions" ? (
          <LiveAuctions liveTournaments={liveTournaments} allTournaments={tournaments} navigate={navigate} />
        ) : section === "monitor" ? (
          <LiveAuctionMonitor
            detail={detail}
            liveTournaments={liveTournaments}
            allTournaments={tournaments}
            tournamentId={tournamentId}
            navigate={navigate}
          />
        ) : section === "displays" ? (
          <LiveDisplaysPanel tournaments={tournaments} tournamentId={tournamentId} detail={detail} />
        ) : section === "owner-apps" ? (
          <LiveOwnerAppsPanel tournaments={tournaments} tournamentId={tournamentId} detail={detail} />
        ) : section === "sessions" ? (
          <LiveOperatorSessionsPanel tournaments={tournaments} tournamentId={tournamentId} detail={detail} />
        ) : (
          <LiveEmergencyPanel
            tournaments={tournaments}
            tournamentId={tournamentId}
            detail={detail}
            isMaster={isMaster}
            onRefresh={() => {
              reloadTournaments();
              if (tournamentId) fetchAdminTournamentDetail(tournamentId).then(setDetail);
            }}
            navigate={navigate}
          />
        )}

        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card/70 px-4 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 text-green-400">
            <BadgeCheck className="h-3.5 w-3.5" /> Real-time event channel on monitor
          </span>
          <span className="flex items-center gap-1">
            <Gavel className="h-3.5 w-3.5" /> Emergency controls isolated per tournament
          </span>
          <span className="flex items-center gap-1 text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" /> Display presence inferred from SSE until heartbeat APIs ship
          </span>
        </div>
      </div>
    </AdminShell>
  );
}
