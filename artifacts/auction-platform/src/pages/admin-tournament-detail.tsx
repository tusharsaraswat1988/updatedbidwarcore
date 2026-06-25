import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Activity, BadgeCheck, CircleDot, Lock, RefreshCw, Sparkles } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { LiveAuctionMonitor } from "@/components/admin/live-auction-monitor";
import { LiveDisplaysPanel } from "@/components/admin/live-displays-panel";
import { LiveEmergencyPanel } from "@/components/admin/live-emergency-panel";
import { LiveOwnerAppsPanel } from "@/components/admin/live-owner-apps-panel";
import { LiveOperatorSessionsPanel } from "@/components/admin/live-operator-sessions-panel";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LIVE_OPS_TABS,
  LiveOpsSection,
  tournamentLiveOpsPath,
} from "@/lib/admin-live-ops-paths";
import {
  AdminTournamentDetail,
  AdminTournamentRow,
  fetchAdminTournamentDetail,
  listAdminTournaments,
  updateAdminTournament,
} from "@/lib/auth";
import { Switch } from "@/components/ui/switch";

type DataTab = "overview" | "players" | "teams" | "bids";
type Tab = DataTab | `live-${LiveOpsSection}`;

function getTournamentId(pathname: string) {
  const match = pathname.match(/\/admin\/tournaments\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function getTab(pathname: string): Tab {
  const liveMatch = pathname.match(/\/live\/(monitor|displays|owner-apps|sessions|emergency)/);
  if (liveMatch) return `live-${liveMatch[1]}` as Tab;
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

function DataTabLink({
  id,
  label,
  tournamentId,
  active,
}: {
  id: DataTab;
  label: string;
  tournamentId: number;
  active: Tab;
}) {
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

function LiveOpsTabLink({
  section,
  label,
  tournamentId,
  active,
}: {
  section: LiveOpsSection;
  label: string;
  tournamentId: number;
  active: Tab;
}) {
  const tabId = `live-${section}` as Tab;
  return (
    <Link
      href={tournamentLiveOpsPath(tournamentId, section)}
      className={`rounded-lg border px-3 py-2 text-sm ${
        active === tabId
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
  const { isLoggedIn, isLoading, isMaster } = useAdminPageGuard();
  const tournamentId = getTournamentId(location);
  const tab = getTab(location);
  const isLiveTab = tab.startsWith("live-");

  const [detail, setDetail] = useState<AdminTournamentDetail | null>(null);
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoringToggleLoading, setScoringToggleLoading] = useState(false);
  const [buzzStudioToggleLoading, setBuzzStudioToggleLoading] = useState(false);

  const reloadDetail = useCallback(() => {
    if (!tournamentId) return Promise.resolve();
    return fetchAdminTournamentDetail(tournamentId).then((data) => {
      if (data) setDetail(data);
    });
  }, [tournamentId]);

  const reloadTournaments = useCallback(() => {
    return listAdminTournaments().then(setTournaments);
  }, []);

  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchAdminTournamentDetail(tournamentId), listAdminTournaments()])
      .then(([detailData, tournamentRows]) => {
        if (cancelled) return;
        if (detailData) setDetail(detailData);
        setTournaments(tournamentRows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  const liveTournaments = useMemo(
    () => tournaments.filter((t) => t.licenseStatus === "active" && !t.adminLocked),
    [tournaments],
  );
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true);
                Promise.all([reloadDetail(), reloadTournaments()]).finally(() => setLoading(false));
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline" onClick={() => navigate("/admin/tournaments")}>
              All Tournaments
            </Button>
            <Button variant="outline" onClick={() => navigate("/admin/settings/reports")}>
              Reports
            </Button>
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
            <div className="flex items-start justify-between gap-4">
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
                  {(detail.tournament.sport === "cricket" || detail.tournament.sport === "badminton") &&
                    detail.tournament.scoringEnabled && (
                    <StatusPill tone="green">Match Scoring</StatusPill>
                  )}
                  {detail.tournament.features?.buzzStudio && (
                    <StatusPill tone="green">Buzz Studio</StatusPill>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {detail.tournament.sport} · ID #{detail.tournament.id} · {detail.tournament.venue || "No venue"} · {detail.tournament.auctionDate || "No date"}
                </p>
              </div>
            </div>
          </div>

          {!isLiveTab && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-xl border border-border bg-card/70 p-4"><div className="text-xs uppercase text-muted-foreground">Players</div><div className="mt-2 text-2xl font-black text-white">{detail.players.length}</div></div>
              <div className="rounded-xl border border-border bg-card/70 p-4"><div className="text-xs uppercase text-muted-foreground">Sold</div><div className="mt-2 text-2xl font-black text-white">{soldCount}</div></div>
              <div className="rounded-xl border border-border bg-card/70 p-4"><div className="text-xs uppercase text-muted-foreground">Teams</div><div className="mt-2 text-2xl font-black text-white">{detail.teams.length}</div></div>
              <div className="rounded-xl border border-border bg-card/70 p-4"><div className="text-xs uppercase text-muted-foreground">Base Purse</div><div className="mt-2 text-2xl font-black text-white">₹{detail.tournament.basePurse.toLocaleString("en-IN")}</div></div>
              <div className="rounded-xl border border-border bg-card/70 p-4"><div className="text-xs uppercase text-muted-foreground">Bid Events</div><div className="mt-2 text-2xl font-black text-white">{detail.recentBids.length}</div></div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <DataTabLink id="overview" label="Overview" tournamentId={tournamentId} active={tab} />
              <DataTabLink id="players" label={`Players (${detail.players.length})`} tournamentId={tournamentId} active={tab} />
              <DataTabLink id="teams" label={`Teams (${detail.teams.length})`} tournamentId={tournamentId} active={tab} />
              <DataTabLink id="bids" label={`Bid Log (${detail.recentBids.length})`} tournamentId={tournamentId} active={tab} />
            </div>
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
                Live Operations
              </div>
              <div className="flex flex-wrap gap-2">
                {LIVE_OPS_TABS.map((item) => (
                  <LiveOpsTabLink
                    key={item.id}
                    section={item.id}
                    label={item.label}
                    tournamentId={tournamentId}
                    active={tab}
                  />
                ))}
              </div>
            </div>
          </div>

          {tab === "overview" ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
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
                    {(detail.tournament.sport === "cricket" || detail.tournament.sport === "badminton") && (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          Match scoring: {detail.tournament.scoringEnabled ? "Enabled" : "Disabled (default)"}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`h-8 gap-1.5 text-xs ${detail.tournament.scoringEnabled
                            ? "border-primary/40 text-primary hover:bg-primary/10"
                            : "border-border text-muted-foreground"}`}
                          disabled={scoringToggleLoading}
                          onClick={async () => {
                            if (!tournamentId) return;
                            setScoringToggleLoading(true);
                            const next = !detail.tournament.scoringEnabled;
                            const r = await updateAdminTournament(tournamentId, { scoringEnabled: next });
                            if (r.success) await reloadDetail();
                            setScoringToggleLoading(false);
                          }}
                        >
                          {scoringToggleLoading
                            ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            : <CircleDot className="h-3.5 w-3.5" />}
                          {detail.tournament.scoringEnabled ? "Disable Match Scoring" : "Enable Match Scoring"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card/70 p-4">
                  <h2 className="font-display font-black text-white">Tournament Features</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enable premium modules for this tournament. Admin only.
                  </p>
                  <div className="mt-4 flex items-start justify-between gap-4 border-t border-border pt-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-medium text-white">Enable Buzz Studio</span>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground max-w-lg leading-relaxed">
                        Allow organizers to access BidWar Media Center and generate tournament creatives.
                      </p>
                    </div>
                    <Switch
                      checked={detail.tournament.features?.buzzStudio === true}
                      disabled={buzzStudioToggleLoading}
                      onCheckedChange={async (checked) => {
                        if (!tournamentId) return;
                        setBuzzStudioToggleLoading(true);
                        const r = await updateAdminTournament(tournamentId, {
                          features: { buzzStudio: checked },
                        });
                        if (r.success) await reloadDetail();
                        setBuzzStudioToggleLoading(false);
                      }}
                    />
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
          ) : tab === "bids" ? (
            <div className="rounded-xl border border-border bg-card/70">
              {detail.recentBids.map((bid) => (
                <div key={bid.id} className="grid grid-cols-[100px_1fr_180px_140px] border-b border-border px-4 py-2.5 text-sm last:border-b-0">
                  <span className="text-xs text-muted-foreground">{new Date(bid.timestamp).toLocaleTimeString()}</span><span className="text-white">{bid.playerName || "Event"}</span><span>{bid.teamName || "No team"}</span><span className="text-right text-primary">₹{bid.amount.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          ) : tab === "live-monitor" ? (
            <LiveAuctionMonitor
              detail={detail}
              liveTournaments={liveTournaments}
              allTournaments={tournaments}
              tournamentId={tournamentId}
              navigate={navigate}
              showPicker={false}
            />
          ) : tab === "live-displays" ? (
            <LiveDisplaysPanel
              tournaments={tournaments}
              tournamentId={tournamentId}
              detail={detail}
              onNavigate={navigate}
              showPicker={false}
            />
          ) : tab === "live-owner-apps" ? (
            <LiveOwnerAppsPanel
              tournaments={tournaments}
              tournamentId={tournamentId}
              detail={detail}
              onNavigate={navigate}
              showPicker={false}
            />
          ) : tab === "live-sessions" ? (
            <LiveOperatorSessionsPanel
              tournaments={tournaments}
              tournamentId={tournamentId}
              detail={detail}
              onNavigate={navigate}
              showPicker={false}
            />
          ) : tab === "live-emergency" ? (
            <LiveEmergencyPanel
              tournaments={tournaments}
              tournamentId={tournamentId}
              detail={detail}
              isMaster={isMaster}
              navigate={navigate}
              showPicker={false}
              afterDeleteHref="/admin/tournaments"
              onRefresh={() => {
                void reloadTournaments();
                void reloadDetail();
              }}
            />
          ) : null}
        </div>
      )}
    </AdminShell>
  );
}
