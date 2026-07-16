import { useCallback, useEffect, useMemo, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { BadgeCheck, Gavel, Radio, RefreshCw } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { AdminTournamentRow, listAdminTournaments } from "@/lib/auth";
import { legacyLiveOpsRedirect, tournamentLiveOpsPath } from "@/lib/admin-live-ops-paths";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { MetricCard } from "@/components/admin/admin-metric-card";
import { StatusBadge } from "@/components/admin/admin-status-badge";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { Skeleton } from "@/components/ui/skeleton";

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
  return <StatusBadge tone={live ? "green" : "muted"}>{live ? "Live" : tournament.licenseStatus}</StatusBadge>;
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
      <AdminListHeader
        gridClassName="md:grid md:grid-cols-[1fr_120px_180px_140px_140px]"
        columns={[
          { label: "Tournament" },
          { label: "Status" },
          { label: "Organiser" },
          { label: "Auction date" },
          { label: "Action", align: "right" },
        ]}
      />
      {rows.map((t) => (
        <button
          key={t.id}
          onClick={() => navigate(tournamentLiveOpsPath(t.id, "monitor"))}
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
            {t.licenseStatus === "active" ? "Open tournament" : "Prepare"}
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
  const { isLoggedIn, isLoading } = useAdminPageGuard();
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
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

  const liveTournaments = useMemo(
    () => tournaments.filter((t) => t.licenseStatus === "active" && !t.adminLocked),
    [tournaments],
  );

  if (location === "/admin/live") return <Redirect to="/admin/live/auctions" />;

  if (section !== "auctions") {
    if (tournamentId) {
      return <Redirect to={legacyLiveOpsRedirect(section, tournamentId)} />;
    }
    return <Redirect to="/admin/live/auctions" />;
  }

  if (isLoading || !isLoggedIn) return null;

  return (
    <AdminShell
      title="Live Auctions"
      eyebrow="Platform overview"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true);
            reloadTournaments().finally(() => setLoading(false));
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
          Pick a tournament to open its live monitor, displays, owner apps, operator sessions, and emergency controls inside that tournament.
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <MetricCard label="Live now" value={liveTournaments.length} icon={Radio} />
          <MetricCard label="All tournaments" value={tournaments.length} />
          <MetricCard label="Locked auctions" value={tournaments.filter((t) => t.adminLocked).length} />
        </div>

        {loading ? (
          <div className="space-y-2 rounded-xl border border-border bg-card/70 p-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <LiveAuctions liveTournaments={liveTournaments} allTournaments={tournaments} navigate={navigate} />
        )}

        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card/70 px-4 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 text-green-400">
            <BadgeCheck className="h-3.5 w-3.5" /> Tournament-scoped controls live inside each tournament
          </span>
          <span className="flex items-center gap-1">
            <Gavel className="h-3.5 w-3.5" /> Emergency controls stay isolated per tournament
          </span>
        </div>
      </div>
    </AdminShell>
  );
}
