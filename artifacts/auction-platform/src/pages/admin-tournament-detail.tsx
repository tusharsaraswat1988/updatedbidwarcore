import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Activity, BadgeCheck, Lock, Radio } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminTournamentDetail, fetchAdminTournamentDetail } from "@/lib/auth";
import { useAdminAuth } from "@/hooks/use-auth";

function getTournamentId(pathname: string) {
  const match = pathname.match(/\/admin\/tournaments\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function getTab(pathname: string) {
  if (pathname.endsWith("/players")) return "players";
  if (pathname.endsWith("/teams")) return "teams";
  if (pathname.endsWith("/bids")) return "bids";
  return "overview";
}

function StatusPill({ children, tone = "muted" }: { children: string; tone?: "green" | "red" | "amber" | "muted" }) {
  const cls = {
    green: "bg-green-500/15 text-green-400",
    red: "bg-red-500/15 text-red-400",
    amber: "bg-amber-500/15 text-amber-300",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return <Badge className={cls}>{children}</Badge>;
}

function TabLink({ id, label, tournamentId, active }: { id: string; label: string; tournamentId: number; active: string }) {
  const href = id === "overview" ? `/admin/tournaments/${tournamentId}/overview` : `/admin/tournaments/${tournamentId}/${id}`;
  return (
    <Link
      href={href}
      className={`rounded-lg border px-3 py-2 text-sm ${
        active === id
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-border bg-card/70 text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

export default function AdminTournamentDetailPage() {
  const [location, navigate] = useLocation();
  const { isLoggedIn, isLoading } = useAdminAuth();
  const tournamentId = getTournamentId(location);
  const tab = getTab(location);
  const [detail, setDetail] = useState<AdminTournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) navigate("/admin/login");
  }, [isLoading, isLoggedIn, navigate]);

  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;
    setLoading(true);
    fetchAdminTournamentDetail(tournamentId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  const soldCount = useMemo(() => detail?.players.filter((p) => p.status === "sold").length ?? 0, [detail]);

  if (isLoading || !isLoggedIn) return null;
  if (!tournamentId) {
    return (
      <AdminShell title="Tournament Detail" eyebrow="Tournament & Organisers">
        <div className="rounded-xl border border-border bg-card/70 p-4 text-sm text-muted-foreground">
          Tournament not found.
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={detail?.tournament.name || "Tournament Detail"}
      eyebrow="Tournament & Organisers › Tournaments"
      actions={
        detail && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/admin/live/monitor/${detail.tournament.id}`)}>
              <Radio className="mr-2 h-4 w-4" /> Open Live Monitor
            </Button>
            <Button variant="outline" onClick={() => navigate("/admin/settings/reports")}>Reports</Button>
          </div>
        )
      }
    >
      {loading || !detail ? (
        <div className="rounded-xl border border-border bg-card/70 p-4 text-sm text-muted-foreground">
          Loading tournament detail...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone={detail.tournament.status === "active" ? "green" : "muted"}>
                    {detail.tournament.status}
                  </StatusPill>
                  <StatusPill tone={detail.tournament.licenseStatus === "active" ? "green" : "amber"}>
                    {detail.tournament.licenseStatus}
                  </StatusPill>
                  {detail.tournament.adminLocked && <StatusPill tone="red">Locked</StatusPill>}
                  {detail.tournament.localModeEnabled && <StatusPill tone="amber">Local Mode</StatusPill>}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {detail.tournament.sport} · ID #{detail.tournament.id} · {detail.tournament.venue || "No venue"} · {detail.tournament.auctionDate || "No date"}
                </p>
              </div>
              <Button variant="destructive" onClick={() => navigate(`/admin/live/emergency/${detail.tournament.id}`)}>
                Emergency Controls
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3">
            <div className="rounded-xl border border-border bg-card/70 p-4"><div className="text-xs uppercase text-muted-foreground">Players</div><div className="mt-2 text-2xl font-black text-white">{detail.players.length}</div></div>
            <div className="rounded-xl border border-border bg-card/70 p-4"><div className="text-xs uppercase text-muted-foreground">Sold</div><div className="mt-2 text-2xl font-black text-white">{soldCount}</div></div>
            <div className="rounded-xl border border-border bg-card/70 p-4"><div className="text-xs uppercase text-muted-foreground">Teams</div><div className="mt-2 text-2xl font-black text-white">{detail.teams.length}</div></div>
            <div className="rounded-xl border border-border bg-card/70 p-4"><div className="text-xs uppercase text-muted-foreground">Base Purse</div><div className="mt-2 text-2xl font-black text-white">₹{detail.tournament.basePurse.toLocaleString("en-IN")}</div></div>
            <div className="rounded-xl border border-border bg-card/70 p-4"><div className="text-xs uppercase text-muted-foreground">Bid Events</div><div className="mt-2 text-2xl font-black text-white">{detail.recentBids.length}</div></div>
          </div>

          <div className="flex gap-2">
            <TabLink id="overview" label="Overview" tournamentId={tournamentId} active={tab} />
            <TabLink id="players" label={`Players (${detail.players.length})`} tournamentId={tournamentId} active={tab} />
            <TabLink id="teams" label={`Teams (${detail.teams.length})`} tournamentId={tournamentId} active={tab} />
            <TabLink id="bids" label={`Bid Log (${detail.recentBids.length})`} tournamentId={tournamentId} active={tab} />
          </div>

          {tab === "overview" ? (
            <div className="grid grid-cols-[1.4fr_1fr] gap-4">
              <div className="rounded-xl border border-border bg-card/70 p-4">
                <h2 className="font-display font-black text-white">Tournament Info</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Sport</span><div className="text-white">{detail.tournament.sport}</div></div>
                  <div><span className="text-muted-foreground">Venue</span><div className="text-white">{detail.tournament.venue || "Not set"}</div></div>
                  <div><span className="text-muted-foreground">Auction time</span><div className="text-white">{detail.tournament.auctionTime || "Not set"}</div></div>
                  <div><span className="text-muted-foreground">Timer</span><div className="text-white">{detail.tournament.timerSeconds}s / {detail.tournament.bidTimerSeconds}s bid</div></div>
                  <div><span className="text-muted-foreground">Minimum bid</span><div className="text-white">₹{detail.tournament.minBid.toLocaleString("en-IN")}</div></div>
                  <div><span className="text-muted-foreground">Selection mode</span><div className="text-white">{detail.tournament.playerSelectionMode}</div></div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card/70 p-4">
                  <h2 className="font-display font-black text-white">Linked Organiser</h2>
                  <p className="mt-2 text-sm text-white">{detail.tournament.organizerName || "No organiser linked"}</p>
                  <p className="text-xs text-muted-foreground">{detail.tournament.organizerMobile || "No mobile"} · {detail.tournament.organizerEmail || "No email"}</p>
                </div>
                <div className="rounded-xl border border-border bg-card/70 p-4">
                  <h2 className="font-display font-black text-white">Access & Safety</h2>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><BadgeCheck className="h-4 w-4" /> License: {detail.tournament.licenseStatus}</div>
                    <div className="flex items-center gap-2"><Lock className="h-4 w-4" /> Lock: {detail.tournament.adminLocked ? "Locked" : "Unlocked"}</div>
                    <div className="flex items-center gap-2"><Activity className="h-4 w-4" /> Reset count: {detail.tournament.resetCount}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : tab === "players" ? (
            <div className="rounded-xl border border-border bg-card/70">
              {detail.players.slice(0, 30).map((p) => (
                <div key={p.id} className="grid grid-cols-[1fr_160px_120px_130px] border-b border-border px-4 py-2.5 text-sm last:border-b-0">
                  <span className="text-white">{p.name}</span><span className="text-muted-foreground">{p.role || "No role"}</span><span>{p.status}</span><span className="text-right">₹{(p.soldPrice || p.basePrice).toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          ) : tab === "teams" ? (
            <div className="rounded-xl border border-border bg-card/70">
              {detail.teams.map((team) => (
                <div key={team.id} className="grid grid-cols-[1fr_160px_160px_160px] border-b border-border px-4 py-2.5 text-sm last:border-b-0">
                  <span className="text-white">{team.name}</span><span className="text-muted-foreground">{team.shortCode}</span><span>{team.ownerName || "No owner"}</span><span className="text-right">₹{team.purseUsed.toLocaleString("en-IN")} used</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card/70">
              {detail.recentBids.map((bid) => (
                <div key={bid.id} className="grid grid-cols-[100px_1fr_180px_140px] border-b border-border px-4 py-2.5 text-sm last:border-b-0">
                  <span className="text-xs text-muted-foreground">{new Date(bid.timestamp).toLocaleTimeString()}</span><span className="text-white">{bid.playerName || "Event"}</span><span>{bid.teamName || "No team"}</span><span className="text-right text-primary">₹{bid.amount.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
