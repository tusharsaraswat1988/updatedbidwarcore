import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Check,
  CircleDot,
  Database,
  ExternalLink,
  Flame,
  Gavel,
  Lock,
  Mail,
  MonitorDown,
  Radio,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  Sparkles,
  Trash2,
  Tv,
  Unlock,
  Users,
  Zap,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveAuctionMonitor } from "@/components/admin/live-auction-monitor";
import { LiveConnectedEndpointsPanel } from "@/components/admin/live-connected-endpoints-panel";
import { LiveEmergencyPanel } from "@/components/admin/live-emergency-panel";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AuditReasonDialog } from "@/components/audit-reason-dialog";
import { AuditReasonField, isAuditReasonValid } from "@/components/audit-reason-field";
import { applyAuctionResetState } from "@/lib/sync-auction-sse";
import {
  LIVE_OPS_TABS,
  LiveOpsSection,
  tournamentLiveOpsPath,
} from "@/lib/admin-live-ops-paths";
import {
  AdminTournamentDetail,
  AdminTournamentRow,
  deleteAdminTournament,
  fetchAdminTournamentDetail,
  listAdminTournaments,
  lockTournament,
  resetTournamentAsAdmin,
  setTournamentLicenseStatus,
  unlockTournament,
  updateAdminTournament,
} from "@/lib/auth";
import { LicenseModeControl } from "@/components/admin/license-mode-control";
import { AdminScrollPanel } from "@/components/admin/admin-scroll-panel";
import { MetricCard } from "@/components/admin/admin-metric-card";
import { StatusBadge, type StatusTone } from "@/components/admin/admin-status-badge";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { liveViewerPath, sideDisplayPath } from "@/lib/tournament-navigation";

type DataTab = "overview" | "players" | "teams" | "bids";
type Tab = DataTab | `live-${LiveOpsSection}`;

function getTournamentId(pathname: string) {
  const match = pathname.match(/\/admin\/tournaments\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function getTab(pathname: string): Tab {
  const liveMatch = pathname.match(/\/live\/(monitor|displays|owner-apps|sessions|emergency|endpoints)/);
  if (liveMatch) return `live-${liveMatch[1]}` as Tab;
  if (pathname.endsWith("/players")) return "players";
  if (pathname.endsWith("/teams")) return "teams";
  if (pathname.endsWith("/bids")) return "bids";
  return "overview";
}

function StatusPill({ children, tone = "muted" }: { children: string; tone?: StatusTone }) {
  return <StatusBadge tone={tone}>{children}</StatusBadge>;
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
      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        active === id
          ? "border-primary/50 bg-primary/15 text-primary shadow-sm"
          : "border-border bg-card/70 text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

function TabEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/30">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
    </div>
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
  const isMatch = active === tabId || (section === "endpoints" && (active === "live-displays" || active === "live-owner-apps" || active === "live-sessions"));
  return (
    <Link
      href={tournamentLiveOpsPath(tournamentId, section)}
      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        isMatch
          ? "border-primary/50 bg-primary/15 text-primary shadow-sm"
          : "border-border bg-card/70 text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

export default function AdminTournamentDetailPage() {
  const [location, navigate] = useLocation();
  const qc = useQueryClient();
  const { isLoggedIn, isLoading, isMaster } = useAdminPageGuard();
  const tournamentId = getTournamentId(location);
  const tab = getTab(location);
  const isLiveTab = tab.startsWith("live-");

  const [detail, setDetail] = useState<AdminTournamentDetail | null>(null);
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  // Dialog states for emergency operations directly on Overview
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetReason, setResetReason] = useState("");
  const [licenseReasonOpen, setLicenseReasonOpen] = useState(false);
  const [pendingLicense, setPendingLicense] = useState<{
    label: string;
    status: "trial" | "active" | "completed";
    alsoLock?: boolean;
  } | null>(null);

  const showFlash = (msg: string, ok = true) => {
    setFlash({ ok, msg });
    window.setTimeout(() => setFlash(null), 4000);
  };

  const reloadDetail = useCallback(() => {
    if (!tournamentId) return Promise.resolve();
    return fetchAdminTournamentDetail(tournamentId).then((data) => {
      if (data) setDetail(data);
    });
  }, [tournamentId]);

  const reloadTournaments = useCallback(() => {
    return listAdminTournaments().then(setTournaments);
  }, []);

  const doAction = async (label: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
    setActionLoading(label);
    try {
      const r = await fn();
      if (!r.success) showFlash(r.error || `${label} failed`, false);
      else showFlash(`${label} updated successfully`);
      await reloadDetail();
      await reloadTournaments();
    } finally {
      setActionLoading(null);
    }
  };

  function requestLicenseChange(
    label: string,
    status: "trial" | "active" | "completed",
    alsoLock = false,
  ) {
    setPendingLicense({ label, status, alsoLock });
    setLicenseReasonOpen(true);
  }

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

  const t = detail?.tournament;

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
          </div>
        )
      }
    >
      {loading || !detail || !t ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <div className="space-y-2 rounded-xl border border-border bg-card/70 p-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {flash && (
            <div
              className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                flash.ok ? "bg-green-500/15 text-green-300 border border-green-500/30" : "bg-red-500/15 text-red-400 border border-red-500/30"
              }`}
            >
              {flash.msg}
            </div>
          )}

          {/* Sleek Consolidated Tournament Identity & Stats Header */}
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary border border-primary/30">
                    {t.sport}
                  </span>
                  <StatusPill tone={t.status === "active" ? "green" : "muted"}>
                    {t.status}
                  </StatusPill>
                  <StatusPill tone={t.licenseStatus === "active" ? "green" : t.licenseStatus === "completed" ? "blue" : "amber"}>
                    {t.licenseStatus === "active" ? "Live License" : t.licenseStatus === "completed" ? "Auction Completed" : "Trial License"}
                  </StatusPill>
                  {t.adminLocked && <StatusPill tone="red">Locked</StatusPill>}
                  {t.localModeEnabled ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/30">
                      <MonitorDown className="h-3 w-3" /> Local Mode
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Tournament ID <span className="font-mono text-white/90">#{t.id}</span> · Venue: <span className="text-white/90">{t.venue || "No venue"}</span> · Date: <span className="text-white/90">{t.auctionDate || "No date"}</span> {t.organizerName ? `· Linked Organiser: ${t.organizerName}` : ""}
                </p>
              </div>

              {/* Compact Inline KPI Stats */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 border-t border-border/60 pt-3 lg:border-t-0 lg:pt-0">
                <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-1.5 text-center">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Players</div>
                  <div className="text-sm font-black text-white">{detail.players.length} <span className="text-xs font-normal text-muted-foreground">({soldCount} sold)</span></div>
                </div>
                <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-1.5 text-center">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Teams</div>
                  <div className="text-sm font-black text-white">{detail.teams.length}</div>
                </div>
                <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-1.5 text-center">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Base Purse</div>
                  <div className="text-sm font-black text-primary">₹{t.basePurse.toLocaleString("en-IN")}</div>
                </div>
                <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-1.5 text-center">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Bid Events</div>
                  <div className="text-sm font-black text-white">{detail.recentBids.length}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Unified Single-Row Navigation Bar */}
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/50 p-2 sm:flex-row sm:items-center sm:justify-between">
            {/* Primary Data Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <DataTabLink id="overview" label="Overview & Controls" tournamentId={tournamentId} active={tab} />
              <DataTabLink id="players" label={`Players (${detail.players.length})`} tournamentId={tournamentId} active={tab} />
              <DataTabLink id="teams" label={`Teams (${detail.teams.length})`} tournamentId={tournamentId} active={tab} />
              <DataTabLink id="bids" label={`Bid Log (${detail.recentBids.length})`} tournamentId={tournamentId} active={tab} />
            </div>

            {/* Live Operations Tabs on the Same Line */}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-3">
              <LiveOpsTabLink
                section="monitor"
                label="Live Auction Monitor"
                tournamentId={tournamentId}
                active={tab}
              />
              <LiveOpsTabLink
                section="endpoints"
                label="Connected Endpoints & Sessions"
                tournamentId={tournamentId}
                active={tab}
              />
            </div>
          </div>

          {/* TAB: OVERVIEW & PROMINENT CONTROLS */}
          {tab === "overview" ? (
            <div className="space-y-4">
              {/* PROMINENT CONTROL CENTER SECTION */}
              <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-card/90 via-card/70 to-card/50 p-5 shadow-lg">
                <div className="flex items-center justify-between border-b border-border/80 pb-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="font-display text-base font-black text-white tracking-wide">
                        Tournament Operations & Emergency Mission Control
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Live lifecycle licensing, runtime modes, feature engines, and safety resets.
                      </p>
                    </div>
                  </div>
                  {!isMaster && (
                    <span className="rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 border border-amber-500/20">
                      Read-Only Mode
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {/* Card 1: Licensing & Lifecycle */}
                  <div className="rounded-xl border border-border/80 bg-muted/10 p-4 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BadgeCheck className="h-4 w-4 text-primary" />
                          <span className="text-xs font-bold uppercase tracking-wider text-white">
                            Auction Licence & Lifecycle
                          </span>
                        </div>
                        <StatusPill tone={t.licenseStatus === "active" ? "green" : t.licenseStatus === "completed" ? "blue" : "amber"}>
                          {t.licenseStatus.toUpperCase()}
                        </StatusPill>
                      </div>

                      <div className="mt-3">
                        <LicenseModeControl
                          licenseStatus={t.licenseStatus}
                          isMaster={isMaster}
                          actionLoading={actionLoading}
                          onSwitchToTrial={() => requestLicenseChange("Switch to Trial", "trial")}
                          onSwitchToLive={() => requestLicenseChange("Switch to Live", "active")}
                          onEndAuction={() => {
                            if (!window.confirm("This will end the auction and prevent further bidding. Continue?")) return;
                            requestLicenseChange("End auction", "completed", true);
                          }}
                        />
                      </div>
                    </div>

                    {isMaster && t.adminLocked && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 gap-1.5"
                        disabled={!!actionLoading}
                        onClick={() => doAction("Re-open Auction", () => unlockTournament(tournamentId))}
                      >
                        {actionLoading === "Re-open Auction" ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Unlock className="h-3.5 w-3.5" />
                        )}
                        Re-open / Unlock Auction
                      </Button>
                    )}
                  </div>

                  {/* Card 2: Infrastructure & Feature Engines */}
                  <div className="rounded-xl border border-border/80 bg-muted/10 p-4 flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold uppercase tracking-wider text-white">
                          Runtime Modes & Engines
                        </span>
                      </div>

                      {/* Cloud vs Local Mode */}
                      <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-semibold text-white">Operator Connection</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {t.localModeEnabled ? "Local Wi-Fi mode for venue" : "Cloud synchronized database"}
                            </div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.localModeEnabled ? "bg-amber-500/20 text-amber-300" : "bg-blue-500/20 text-blue-300"}`}>
                            {t.localModeEnabled ? "Local Mode" : "Cloud"}
                          </span>
                        </div>
                        {isMaster && (
                          <Button
                            size="sm"
                            variant="outline"
                            className={`mt-2.5 w-full h-8 text-xs gap-1.5 ${t.localModeEnabled ? "border-amber-500/40 text-amber-300 hover:bg-amber-500/10" : ""}`}
                            disabled={!!actionLoading}
                            onClick={() =>
                              doAction(t.localModeEnabled ? "Switch to Cloud" : "Enable Local Mode", () =>
                                updateAdminTournament(tournamentId, { localModeEnabled: !t.localModeEnabled })
                              )
                            }
                          >
                            <MonitorDown className="h-3.5 w-3.5" />
                            {t.localModeEnabled ? "Switch to Cloud Mode" : "Enable Local Venue Mode"}
                          </Button>
                        )}
                      </div>

                      {/* Match Scoring Engine */}
                      {(t.sport === "cricket" || t.sport === "badminton") && (
                        <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-semibold text-white">Match Scoring Engine</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                Live scoring module for {t.sport}
                              </div>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.scoringEnabled ? "bg-green-500/20 text-green-300" : "bg-muted text-muted-foreground"}`}>
                              {t.scoringEnabled ? "Enabled" : "Disabled"}
                            </span>
                          </div>
                          {isMaster && (
                            <Button
                              size="sm"
                              variant="outline"
                              className={`mt-2.5 w-full h-8 text-xs gap-1.5 ${t.scoringEnabled ? "border-green-500/40 text-green-300 hover:bg-green-500/10" : ""}`}
                              disabled={!!actionLoading}
                              onClick={() =>
                                doAction(t.scoringEnabled ? "Disable Match Scoring" : "Enable Match Scoring", () =>
                                  updateAdminTournament(tournamentId, { scoringEnabled: !t.scoringEnabled })
                                )
                              }
                            >
                              <CircleDot className="h-3.5 w-3.5" />
                              {t.scoringEnabled ? "Disable Match Scoring" : "Enable Match Scoring"}
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Buzz Studio Feature */}
                      <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                              <Sparkles className="h-3.5 w-3.5 text-primary" />
                              Buzz Studio Media Center
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Social posters & AI tournament creatives
                            </div>
                          </div>
                          {isMaster && (
                            <Switch
                              checked={t.features?.buzzStudio === true}
                              disabled={!!actionLoading}
                              onCheckedChange={(checked) =>
                                doAction(checked ? "Enable Buzz Studio" : "Disable Buzz Studio", () =>
                                  updateAdminTournament(tournamentId, { features: { buzzStudio: checked } })
                                )
                              }
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Danger Zone & Safety Resets */}
                  <div className="rounded-xl border border-red-500/40 bg-red-500/[0.04] p-4 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-red-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-red-300">
                            Emergency & Safety Zone
                          </span>
                        </div>
                        <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300 border border-red-500/30">
                          {t.resetCount ?? 0}× Resets
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Emergency data operations require super admin master privileges and explicit audit explanation.
                      </p>

                      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200/90 space-y-1">
                        <div className="font-semibold text-red-300 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" /> Reset Protocol
                        </div>
                        <div>Clears all bids, team purses, lot progression, and resets players to available.</div>
                      </div>
                    </div>

                    {isMaster && (
                      <div className="space-y-2 pt-2 border-t border-red-500/20">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20 gap-1.5"
                          onClick={() => {
                            setResetPassword("");
                            setResetError(null);
                            setResetReason("");
                            setConfirmReset(true);
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Reset Auction Data
                          {(t.resetCount ?? 0) > 0 && (
                            <span className="ml-1 rounded bg-red-500/30 px-1.5 py-0.2 text-[10px] font-bold">
                              {t.resetCount}×
                            </span>
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full text-destructive hover:bg-destructive/15 text-xs gap-1.5"
                          onClick={() => setConfirmDelete(true)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete Tournament Permanently
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* TOURNAMENT SPECS & ORGANISER ROW */}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
                {/* Left: Tournament Info */}
                <div className="rounded-xl border border-border bg-card/70 p-4">
                  <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                    <h2 className="font-display font-black text-white">Tournament Info & Specs</h2>
                    <span className="text-xs text-muted-foreground">ID #{t.id}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Sport</span>
                      <div className="text-white font-medium capitalize">{t.sport}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Venue</span>
                      <div className="text-white font-medium">{t.venue || "Not specified"}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Auction Time & Date</span>
                      <div className="text-white font-medium">{t.auctionDate || "Date TBD"} {t.auctionTime ? `· ${t.auctionTime}` : ""}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Timers</span>
                      <div className="text-white font-medium">{t.timerSeconds}s standard / {t.bidTimerSeconds}s per bid</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Minimum Bid</span>
                      <div className="text-white font-medium">₹{t.minBid.toLocaleString("en-IN")}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Player Selection Mode</span>
                      <div className="text-white font-medium capitalize">{t.playerSelectionMode}</div>
                    </div>
                  </div>
                </div>

                {/* Right: Linked Organiser */}
                <div className="rounded-xl border border-border bg-card/70 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                      <h2 className="font-display font-black text-white">Linked Organiser</h2>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold text-white">{t.organizerName || "No organiser linked"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Mobile: {t.organizerMobile || "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Email: {t.organizerEmail || "N/A"}
                    </p>
                  </div>
                  {t.organizerEmail && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-4 w-full h-8 gap-1.5 text-xs"
                      onClick={() => navigate(`/admin/communication/bulk?tournamentId=${tournamentId}&target=organiser`)}
                    >
                      <Mail className="h-3.5 w-3.5" /> Email Organiser
                    </Button>
                  )}
                </div>
              </div>

              {/* QUICK ACCESS TO LIVE ROOMS & ENDPOINTS */}
              <div className="rounded-xl border border-border bg-card/70 p-4">
                <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                  <div>
                    <h3 className="font-display font-black text-white text-sm">Quick Room & Display Launchers</h3>
                    <p className="text-xs text-muted-foreground">Instant 1-click links for active tournament endpoints.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-primary hover:text-primary/80 gap-1"
                    onClick={() => navigate(tournamentLiveOpsPath(t.id, "endpoints"))}
                  >
                    Open Full Endpoints Hub →
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 truncate" asChild>
                    <a href={liveViewerPath(t.id)} target="_blank" rel="noreferrer">
                      <Tv className="h-3.5 w-3.5 text-primary" />
                      Live Viewer
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 truncate" asChild>
                    <a href={`/tournament/${t.id}/obs`} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 text-amber-400" />
                      OBS Overlay
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 truncate" asChild>
                    <a href={`/tournament/${t.id}/break-timer`} target="_blank" rel="noreferrer">
                      <Activity className="h-3.5 w-3.5 text-blue-400" />
                      Break Timer
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 truncate" asChild>
                    <a href={sideDisplayPath(t.id, "sponsors")} target="_blank" rel="noreferrer">
                      <Tv className="h-3.5 w-3.5 text-green-400" />
                      Sponsor LED
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 truncate" asChild>
                    <a href={sideDisplayPath(t.id, "player")} target="_blank" rel="noreferrer">
                      <Users className="h-3.5 w-3.5 text-indigo-400" />
                      Player Profile
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 truncate" asChild>
                    <a href={`/tournament/${t.id}/auction`} target="_blank" rel="noreferrer">
                      <Radio className="h-3.5 w-3.5 text-red-400" />
                      Operator Console
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          ) : tab === "players" ? (
            <div className="space-y-3">
              {isMaster && (
                <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <Database className="h-4 w-4 text-primary" />
                      Tournament Master Workbook
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Official import/export for all tournament data — Excel & Google Sheets.
                    </p>
                  </div>
                  <Link href={`/admin/tournaments/${tournamentId}/workbook`}>
                    <Button size="sm" className="gap-1.5">Open Workbook</Button>
                  </Link>
                </div>
              )}
              <div className="rounded-xl border border-border bg-card/70 overflow-hidden">
                {detail.players.length ? (
                  <>
                    <AdminListHeader
                      gridClassName="sm:grid sm:grid-cols-[1fr_140px_110px_120px_48px]"
                      columns={[
                        { label: "Player" },
                        { label: "Role" },
                        { label: "Status" },
                        { label: "Price", align: "right" },
                        { label: "" },
                      ]}
                    />
                    <AdminScrollPanel>
                      {detail.players.map((p) => (
                        <div
                          key={p.id}
                          className="block border-b border-border px-4 py-2.5 text-sm last:border-b-0 sm:grid sm:grid-cols-[1fr_140px_110px_120px_48px] sm:items-center"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-medium text-white block truncate">{p.name}</span>
                            {p.email && <span className="text-[11px] text-muted-foreground block truncate">{p.email}</span>}
                          </div>
                          <span className="text-muted-foreground">{p.role || "No role"}</span>
                          <span className="mt-1 block sm:mt-0">
                            <span className="text-muted-foreground sm:hidden">Status: </span>
                            {p.status}
                          </span>
                          <span className="mt-1 block sm:mt-0 sm:text-right">
                            <span className="text-muted-foreground sm:hidden">Price: </span>
                            ₹{(p.soldPrice || p.basePrice).toLocaleString("en-IN")}
                          </span>
                          <div className="mt-1 flex justify-end sm:mt-0">
                            {p.email ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                title="Send / Resend Email to Player"
                                onClick={() => navigate(`/admin/communication/bulk?tournamentId=${tournamentId}&target=player&playerId=${p.id}`)}
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </AdminScrollPanel>
                  </>
                ) : (
                  <TabEmptyState
                    icon={Users}
                    title="No players added yet"
                    description="Add players via the Tournament Master Workbook or the organiser's player list to see them here."
                  />
                )}
              </div>
            </div>
          ) : tab === "teams" ? (
            <div className="rounded-xl border border-border bg-card/70 overflow-hidden">
              {detail.teams.length ? (
                <>
                  <AdminListHeader
                    gridClassName="sm:grid sm:grid-cols-[1fr_140px_160px_130px_48px]"
                    columns={[
                      { label: "Team" },
                      { label: "Code" },
                      { label: "Owner" },
                      { label: "Purse used", align: "right" },
                      { label: "" },
                    ]}
                  />
                  <AdminScrollPanel>
                    {detail.teams.map((team) => (
                      <div
                        key={team.id}
                        className="block border-b border-border px-4 py-2.5 text-sm last:border-b-0 sm:grid sm:grid-cols-[1fr_140px_160px_130px_48px] sm:items-center"
                      >
                        <span className="font-medium text-white">{team.name}</span>
                        <span className="text-muted-foreground">{team.shortCode}</span>
                        <div className="min-w-0 pr-2 mt-1 sm:mt-0">
                          <span className="text-muted-foreground sm:hidden">Owner: </span>
                          <span className="text-white block truncate">{team.ownerName || "No owner"}</span>
                          {team.ownerEmail && <span className="block text-[11px] text-muted-foreground truncate">{team.ownerEmail}</span>}
                        </div>
                        <span className="mt-1 block sm:mt-0 sm:text-right">
                          ₹{team.purseUsed.toLocaleString("en-IN")} used
                        </span>
                        <div className="mt-1 flex justify-end sm:mt-0">
                          {team.ownerEmail ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                              title="Send / Resend Email to Team Owner"
                              onClick={() => navigate(`/admin/communication/bulk?tournamentId=${tournamentId}&target=team_owner&teamId=${team.id}`)}
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </AdminScrollPanel>
                </>
              ) : (
                <TabEmptyState
                  icon={Shield}
                  title="No teams added yet"
                  description="Teams created by the organiser for this tournament will appear here."
                />
              )}
            </div>
          ) : tab === "bids" ? (
            <div className="rounded-xl border border-border bg-card/70 overflow-hidden">
              {detail.recentBids.length ? (
                <>
                  <AdminListHeader
                    gridClassName="sm:grid sm:grid-cols-[100px_1fr_180px_140px]"
                    columns={[
                      { label: "Time" },
                      { label: "Player" },
                      { label: "Team" },
                      { label: "Amount", align: "right" },
                    ]}
                  />
                  <AdminScrollPanel>
                    {detail.recentBids.map((bid) => (
                      <div
                        key={bid.id}
                        className="block border-b border-border px-4 py-2.5 text-sm last:border-b-0 sm:grid sm:grid-cols-[100px_1fr_180px_140px] sm:items-center"
                      >
                        <span className="text-xs text-muted-foreground">{new Date(bid.timestamp).toLocaleTimeString()}</span>
                        <span className="mt-1 block font-medium text-white sm:mt-0">{bid.playerName || "Event"}</span>
                        <span className="mt-1 block text-muted-foreground sm:mt-0">{bid.teamName || "No team"}</span>
                        <span className="mt-1 block text-primary sm:mt-0 sm:text-right">
                          ₹{bid.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </AdminScrollPanel>
                </>
              ) : (
                <TabEmptyState
                  icon={Gavel}
                  title="No bids recorded yet"
                  description="Bid activity will appear here in real time once the auction goes live."
                />
              )}
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
          ) : tab === "live-endpoints" || tab === "live-displays" || tab === "live-owner-apps" || tab === "live-sessions" ? (
            <LiveConnectedEndpointsPanel
              tournaments={tournaments}
              tournamentId={tournamentId}
              detail={detail}
              initialSection={tab === "live-owner-apps" ? "owner-apps" : tab === "live-sessions" ? "operator" : "displays"}
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

      {/* RESET AUCTION DATA DIALOG */}
      {t && (
        <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Reset Tournament Auction Data
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will clear all bids, bid feed log, player sales history, and reset tournament progress to block-ready for <strong className="text-white">{t.name}</strong>.
            </p>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs text-muted-foreground font-semibold uppercase">Super Admin Password</label>
                <Input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => {
                    setResetPassword(e.target.value);
                    setResetError(null);
                  }}
                  placeholder="Enter super admin password"
                  autoComplete="current-password"
                  className="mt-1"
                />
              </div>
              <AuditReasonField
                value={resetReason}
                onChange={setResetReason}
                placeholder="Explain why auction data is being reset…"
              />
              {resetError && <p className="text-xs text-red-400">{resetError}</p>}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
              <Button
                className="bg-red-700 hover:bg-red-600 text-white"
                disabled={resetting || !resetPassword.trim() || !isAuditReasonValid(resetReason)}
                onClick={async () => {
                  setResetting(true);
                  setResetError(null);
                  const r = await resetTournamentAsAdmin(tournamentId, resetPassword, resetReason.trim());
                  setResetting(false);
                  if (r.success) {
                    if (r.state) applyAuctionResetState(qc, tournamentId, r.state);
                    setConfirmReset(false);
                    setResetPassword("");
                    setResetReason("");
                    showFlash("Auction data reset successfully");
                    await reloadDetail();
                  } else {
                    setResetError(r.error || "Reset failed");
                  }
                }}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${resetting ? "animate-spin" : ""}`} />
                Yes, reset everything
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* DELETE TOURNAMENT PERMANENTLY DIALOG */}
      {t && (
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="h-5 w-5" /> Delete Tournament
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to permanently delete <strong className="text-white">{t.name}</strong> and all related teams, players, and bid logs? This cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={!!actionLoading}
                onClick={async () => {
                  setConfirmDelete(false);
                  setActionLoading("Delete");
                  const r = await deleteAdminTournament(tournamentId);
                  setActionLoading(null);
                  if (r.success) {
                    navigate("/admin/tournaments");
                  } else {
                    showFlash(r.error || "Delete failed", false);
                  }
                }}
              >
                Delete permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* AUDIT REASON DIALOG FOR LICENCE CHANGES */}
      {tournamentId != null && (
        <AuditReasonDialog
          open={licenseReasonOpen}
          onOpenChange={(open) => {
            setLicenseReasonOpen(open);
            if (!open) setPendingLicense(null);
          }}
          title={pendingLicense?.label ?? "Change licence mode"}
          description="Licence modifications are recorded in the audit log and require an administrative reason."
          confirmLabel={pendingLicense?.label ?? "Confirm"}
          loading={!!actionLoading}
          onConfirm={async (reason) => {
            if (!pendingLicense || tournamentId == null) return;
            setActionLoading(pendingLicense.label);
            const r1 = await setTournamentLicenseStatus(tournamentId, pendingLicense.status, reason);
            if (!r1.success) {
              setActionLoading(null);
              showFlash(r1.error || `${pendingLicense.label} failed`, false);
              return;
            }
            if (pendingLicense.alsoLock) {
              const r2 = await lockTournament(tournamentId);
              showFlash(r2.success ? "Auction completed & locked" : "Licence updated to completed", r2.success);
            } else {
              showFlash(`${pendingLicense.label} completed`);
            }
            setActionLoading(null);
            setLicenseReasonOpen(false);
            setPendingLicense(null);
            await reloadDetail();
            await reloadTournaments();
          }}
        />
      )}
    </AdminShell>
  );
}
