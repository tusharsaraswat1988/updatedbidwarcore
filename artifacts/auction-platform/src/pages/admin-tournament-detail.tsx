import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Check,
  CheckCircle2,
  CircleDot,
  CreditCard,
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
  Trophy,
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
  setTournamentScoringPhase,
  unlockTournament,
  updateAdminTournament,
  verifyAndGrantTournamentLicense,
} from "@/lib/auth";
import { LicenseModeControl } from "@/components/admin/license-mode-control";
import { AdminScrollPanel } from "@/components/admin/admin-scroll-panel";
import { MetricCard } from "@/components/admin/admin-metric-card";
import { StatusBadge, type StatusTone } from "@/components/admin/admin-status-badge";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { liveViewerPath, obsOverlayPath, sideDisplayPath } from "@/lib/tournament-navigation";

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

function StatusPill({ children, tone = "muted" }: { children: React.ReactNode; tone?: StatusTone }) {
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
  const href = id === "overview" ? `/admin/tournaments/${tournamentId}` : `/admin/tournaments/${tournamentId}/${id}`;
  const isSelected = active === id;
  return (
    <Link href={href}>
      <Button
        variant={isSelected ? "secondary" : "ghost"}
        size="sm"
        className={`h-8 text-xs font-semibold ${isSelected ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground hover:text-white"}`}
      >
        {label}
      </Button>
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
  const isSelected = active === `live-${section}`;
  return (
    <Link href={tournamentLiveOpsPath(tournamentId, section)}>
      <Button
        variant={isSelected ? "secondary" : "ghost"}
        size="sm"
        className={`h-8 text-xs font-semibold gap-1.5 ${isSelected ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-white"}`}
      >
        <Radio className="h-3.5 w-3.5" />
        {label}
      </Button>
    </Link>
  );
}

function TabEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
      <Icon className="h-8 w-8 mb-2 stroke-[1.5] text-muted-foreground/60" />
      <p className="text-sm font-semibold text-white/90">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export default function AdminTournamentDetailPage() {
  const { isMaster } = useAdminPageGuard();
  const [location, navigate] = useLocation();
  const qc = useQueryClient();

  const tournamentId = getTournamentId(location);
  const [tab, setTab] = useState<Tab>(() => getTab(location));

  useEffect(() => {
    setTab(getTab(location));
  }, [location]);

  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
  const [detail, setDetail] = useState<AdminTournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ msg: string; ok: boolean } | null>(null);

  // License reason dialog state
  const [licenseReasonOpen, setLicenseReasonOpen] = useState(false);
  const [pendingLicense, setPendingLicense] = useState<{
    status: "trial" | "active" | "completed";
    label: string;
    alsoLock?: boolean;
  } | null>(null);

  // Scoring phase transition dialog state
  const [pendingScoringPhase, setPendingScoringPhase] = useState<"setup" | "active" | "completed" | null>(null);

  // Verify and grant license dialog state
  const [verifyPaymentOpen, setVerifyPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("4999");
  const [paymentMode, setPaymentMode] = useState<string>("upi");
  const [paymentRef, setPaymentRef] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [paymentAuditReason, setPaymentAuditReason] = useState<string>("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Reset auction state
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetReason, setResetReason] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Delete tournament state
  const [confirmDelete, setConfirmDelete] = useState(false);

  const showFlash = (msg: string, ok = true) => {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 4000);
  };

  const reloadTournaments = useCallback(async () => {
    const list = await listAdminTournaments();
    setTournaments(list);
  }, []);

  const reloadDetail = useCallback(async () => {
    if (tournamentId == null) return;
    const d = await fetchAdminTournamentDetail(tournamentId);
    setDetail(d);
  }, [tournamentId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      await Promise.all([reloadTournaments(), reloadDetail()]);
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, reloadTournaments, reloadDetail]);

  const liveTournaments = useMemo(
    () => tournaments.filter((row) => row.status === "active"),
    [tournaments]
  );

  const doAction = async (label: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
    setActionLoading(label);
    const r = await fn();
    setActionLoading(null);
    if (r.success) {
      showFlash(`${label} completed`);
      await Promise.all([reloadTournaments(), reloadDetail()]);
    } else {
      showFlash(r.error || `${label} failed`, false);
    }
  };

  const requestLicenseChange = (label: string, status: "trial" | "active" | "completed", alsoLock = false) => {
    setPendingLicense({ label, status, alsoLock });
    setLicenseReasonOpen(true);
  };

  const t = detail?.tournament;

  // Resolve product mode with safety fallback
  const productMode = useMemo(() => {
    if (!t) return "auction_only";
    if (t.productMode) return t.productMode;
    if (t.auctionEnabled && t.scoringEnabled) return "both";
    if (t.scoringEnabled) return "scoring_only";
    return "auction_only";
  }, [t]);

  const isAuctionOnly = productMode === "auction_only";
  const isScoringOnly = productMode === "scoring_only";
  const isDualModule = productMode === "both";

  const soldCount = useMemo(() => {
    return detail?.players.filter((p) => p.status === "sold").length ?? 0;
  }, [detail?.players]);

  const matchCounts = detail?.matchCounts ?? { total: 0, live: 0, completed: 0, upcoming: 0 };
  const licenseRequest = detail?.licenseRequest;

  return (
    <AdminShell title="Tournament Operations & Controls">
      {loading || !t || tournamentId == null ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
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

          {/* Module-Aware Tournament Identity & Header */}
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary border border-primary/30">
                    {t.sport}
                  </span>

                  {/* Product Mode Pill */}
                  {isAuctionOnly && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-300 border border-amber-500/30">
                      <Gavel className="h-3 w-3" /> Auction Only
                    </span>
                  )}
                  {isScoringOnly && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-300 border border-emerald-500/30">
                      <Trophy className="h-3 w-3" /> Scoring Only
                    </span>
                  )}
                  {isDualModule && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-blue-300 border border-blue-500/30">
                      <Sparkles className="h-3 w-3" /> Dual Module (Auction + Scoring)
                    </span>
                  )}

                  {/* Tournament Status */}
                  <StatusPill tone={t.status === "active" ? "green" : t.status === "completed" ? "blue" : "muted"}>
                    {t.status.toUpperCase()}
                  </StatusPill>

                  {/* Module-Aware License & Phase Status */}
                  {isAuctionOnly && (
                    <StatusPill tone={t.licenseStatus === "active" ? "green" : t.licenseStatus === "completed" ? "blue" : "amber"}>
                      {t.licenseStatus === "active" ? "Live License" : t.licenseStatus === "completed" ? "Auction Completed" : "Trial License"}
                    </StatusPill>
                  )}

                  {isScoringOnly && (
                    <>
                      <StatusPill tone={t.licenseStatus === "active" ? "green" : "amber"}>
                        {t.licenseStatus === "active" ? "Live License" : "Trial License"}
                      </StatusPill>
                      <StatusPill tone={t.scoringPhase === "active" ? "green" : t.scoringPhase === "completed" ? "blue" : "amber"}>
                        {`Scoring Phase: ${(t.scoringPhase ?? "setup").toUpperCase()}`}
                      </StatusPill>
                    </>
                  )}

                  {isDualModule && (
                    <>
                      <StatusPill tone={t.licenseStatus === "active" ? "green" : t.licenseStatus === "completed" ? "blue" : "amber"}>
                        {`Auction: ${t.licenseStatus === "active" ? "Live" : t.licenseStatus === "completed" ? "Completed" : "Trial"}`}
                      </StatusPill>
                      <StatusPill tone={t.scoringPhase === "active" ? "green" : t.scoringPhase === "completed" ? "blue" : "amber"}>
                        {`Scoring: ${(t.scoringPhase ?? "setup").toUpperCase()}`}
                      </StatusPill>
                    </>
                  )}

                  {t.adminLocked && <StatusPill tone="red">Emergency Locked</StatusPill>}

                  {t.localModeEnabled ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/30">
                      <MonitorDown className="h-3 w-3" /> Local Mode
                    </span>
                  ) : null}
                </div>

                <p className="mt-1.5 text-xs text-muted-foreground">
                  Tournament ID <span className="font-mono text-white/90">#{t.id}</span> · Venue: <span className="text-white/90">{t.venue || "No venue"}</span> · Date: <span className="text-white/90">{t.auctionDate || "No date"}{t.auctionTime ? ` · ${t.auctionTime}` : ""}</span> {t.organizerName ? `· Linked Organiser: ${t.organizerName}` : ""}
                </p>
              </div>

              {/* Module-Aware Compact KPI Stats Strip */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-t border-border/60 pt-3 lg:border-t-0 lg:pt-0">
                {/* Players */}
                <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-1.5 text-center min-w-[70px]">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Players</div>
                  <div className="text-sm font-black text-white">
                    {detail.players.length}
                    {!isScoringOnly && soldCount > 0 && (
                      <span className="text-xs font-normal text-muted-foreground ml-1">({soldCount} sold)</span>
                    )}
                  </div>
                </div>

                {/* Teams */}
                <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-1.5 text-center min-w-[60px]">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Teams</div>
                  <div className="text-sm font-black text-white">{detail.teams.length}</div>
                </div>

                {/* Auction-Specific Stats (Hidden for Scoring-Only) */}
                {!isScoringOnly && (
                  <>
                    <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-1.5 text-center min-w-[85px]">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Base Purse</div>
                      <div className="text-sm font-black text-primary">₹{t.basePurse.toLocaleString("en-IN")}</div>
                    </div>
                    <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-1.5 text-center min-w-[70px]">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Bid Events</div>
                      <div className="text-sm font-black text-white">{detail.recentBids.length}</div>
                    </div>
                  </>
                )}

                {/* Scoring-Specific Stats (Hidden for Auction-Only) */}
                {!isAuctionOnly && (
                  <>
                    <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-1.5 text-center min-w-[70px]">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Matches</div>
                      <div className="text-sm font-black text-emerald-400">
                        {matchCounts.total}
                        {matchCounts.live > 0 && (
                          <span className="text-xs font-bold text-red-400 ml-1">({matchCounts.live} live)</span>
                        )}
                      </div>
                    </div>
                    {isScoringOnly && (
                      <>
                        <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-1.5 text-center min-w-[65px]">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Completed</div>
                          <div className="text-sm font-black text-blue-400">{matchCounts.completed}</div>
                        </div>
                        <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-1.5 text-center min-w-[65px]">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Upcoming</div>
                          <div className="text-sm font-black text-muted-foreground">{matchCounts.upcoming}</div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* License Request & Payment Verification Card (if request exists) */}
          {licenseRequest && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      License Request & Payment Status
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                        licenseRequest.paymentVerified
                          ? "bg-green-500/20 text-green-300 border-green-500/30"
                          : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      }`}
                    >
                      {licenseRequest.paymentVerified ? "Payment Verified" : "Verification Required"}
                    </span>
                    <span className="rounded bg-muted/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border border-border">
                      Status: {licenseRequest.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Requested: <strong className="text-white capitalize">{licenseRequest.requestedModules}</strong>
                    </span>
                    <span>
                      Amount:{" "}
                      <strong className="text-white">
                        {licenseRequest.paymentAmount ? `₹${licenseRequest.paymentAmount.toLocaleString("en-IN")}` : "N/A"}
                      </strong>
                    </span>
                    <span>
                      Mode: <strong className="text-white uppercase">{licenseRequest.paymentMode || "N/A"}</strong>
                    </span>
                    {licenseRequest.paymentRef && (
                      <span>
                        Ref/UTR: <strong className="text-white font-mono">{licenseRequest.paymentRef}</strong>
                      </span>
                    )}
                    {licenseRequest.verifiedBy && (
                      <span>
                        Verified by: <strong className="text-white">{licenseRequest.verifiedBy}</strong>
                        {licenseRequest.verifiedAt ? ` on ${new Date(licenseRequest.verifiedAt).toLocaleDateString()}` : ""}
                      </span>
                    )}
                  </div>
                  {licenseRequest.notes && (
                    <p className="text-xs text-muted-foreground/90 italic mt-0.5">Note: {licenseRequest.notes}</p>
                  )}
                </div>

                {isMaster && (!licenseRequest.paymentVerified || licenseRequest.status === "pending" || t.licenseStatus !== "active") && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-1.5 shrink-0"
                    onClick={() => {
                      setPaymentAmount(String(licenseRequest.paymentAmount || 4999));
                      setPaymentMode(licenseRequest.paymentMode || "upi");
                      setPaymentRef(licenseRequest.paymentRef || "");
                      setPaymentNotes(licenseRequest.notes || "");
                      setPaymentAuditReason("Verified bank/UPI payment transfer");
                      setPaymentError(null);
                      setVerifyPaymentOpen(true);
                    }}
                  >
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verify Payment & Grant Live License
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Module-Aware Navigation Bar */}
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/50 p-2 sm:flex-row sm:items-center sm:justify-between overflow-hidden">
            {/* Primary Data Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
              <DataTabLink id="overview" label="Overview & Controls" tournamentId={tournamentId} active={tab} />
              <DataTabLink id="players" label={`Players (${detail.players.length})`} tournamentId={tournamentId} active={tab} />
              <DataTabLink id="teams" label={`Teams (${detail.teams.length})`} tournamentId={tournamentId} active={tab} />
              {/* Bid Log tab hidden for Scoring-Only */}
              {!isScoringOnly && (
                <DataTabLink id="bids" label={`Bid Log (${detail.recentBids.length})`} tournamentId={tournamentId} active={tab} />
              )}
            </div>

            {/* Live Operations Tabs */}
            <div className="flex items-center gap-1.5 border-t border-border/60 pt-2 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-3 overflow-x-auto max-w-full pb-1 sm:pb-0">
              {!isScoringOnly && (
                <LiveOpsTabLink
                  section="monitor"
                  label="Live Auction Monitor"
                  tournamentId={tournamentId}
                  active={tab}
                />
              )}
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
                        Tournament Operations & Controls
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

                {/* Architectural Invariants Notice */}
                <div className="mb-4 rounded-lg border border-border/60 bg-muted/15 p-2.5 text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-white">Dual-Lifecycle Decoupling: </strong>
                  Auction and Sports Scoring lifecycles operate independently. Concluding an auction does not conclude or lock match scoring. Scorer live write operations require an active tournament license.
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {/* CARD 1: MODULE-AWARE LICENSING & LIFECYCLE */}
                  <div className="rounded-xl border border-border/80 bg-muted/10 p-4 flex flex-col justify-between space-y-4">
                    {/* SCENARIO A: SCORING-ONLY */}
                    {isScoringOnly ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-emerald-400" />
                            <span className="text-xs font-bold uppercase tracking-wider text-white">
                              Sports Scoring Lifecycle
                            </span>
                          </div>
                          <StatusPill tone={t.scoringPhase === "active" ? "green" : t.scoringPhase === "completed" ? "blue" : "amber"}>
                            {(t.scoringPhase ?? "setup").toUpperCase()}
                          </StatusPill>
                        </div>

                        {/* Authoritative Phase Controller */}
                        <div className="rounded-lg border border-border/60 bg-card/60 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white">Scoring Phase Controls</span>
                            <span className="text-[11px] text-muted-foreground">Super admin audit required</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 pt-1">
                            <Button
                              size="sm"
                              variant={t.scoringPhase === "setup" ? "secondary" : "outline"}
                              className={`h-8 text-xs ${t.scoringPhase === "setup" ? "border-amber-500/40 text-amber-300" : ""}`}
                              disabled={!isMaster || t.scoringPhase === "setup" || !!actionLoading}
                              onClick={() => setPendingScoringPhase("setup")}
                            >
                              Setup
                            </Button>
                            <Button
                              size="sm"
                              variant={t.scoringPhase === "active" ? "secondary" : "outline"}
                              className={`h-8 text-xs ${t.scoringPhase === "active" ? "border-green-500/40 text-green-300" : ""}`}
                              disabled={!isMaster || t.scoringPhase === "active" || !!actionLoading}
                              onClick={() => setPendingScoringPhase("active")}
                            >
                              Active / Live
                            </Button>
                            <Button
                              size="sm"
                              variant={t.scoringPhase === "completed" ? "secondary" : "outline"}
                              className={`h-8 text-xs ${t.scoringPhase === "completed" ? "border-blue-500/40 text-blue-300" : ""}`}
                              disabled={!isMaster || t.scoringPhase === "completed" || !!actionLoading}
                              onClick={() => setPendingScoringPhase("completed")}
                            >
                              Completed
                            </Button>
                          </div>
                        </div>

                        {/* Tournament License Status & Upgrade */}
                        <div className="rounded-lg border border-border/60 bg-card/60 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-semibold text-white">Tournament License Status</div>
                              <div className="text-[11px] text-muted-foreground">
                                {t.licenseStatus === "active" ? "Live production license active" : "Trial mode — limited live access"}
                              </div>
                            </div>
                            <StatusPill tone={t.licenseStatus === "active" ? "green" : "amber"}>
                              {t.licenseStatus === "active" ? "LIVE" : "TRIAL"}
                            </StatusPill>
                          </div>

                          {isMaster && (
                            <div className="pt-1">
                              {t.licenseStatus !== "active" ? (
                                <Button
                                  size="sm"
                                  className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
                                  onClick={() => requestLicenseChange("Switch to Live License", "active")}
                                >
                                  <BadgeCheck className="h-3.5 w-3.5" />
                                  Upgrade / Grant Live License
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full h-8 text-xs text-amber-300 border-amber-500/40 hover:bg-amber-500/10 gap-1.5"
                                  onClick={() => requestLicenseChange("Switch to Trial", "trial")}
                                >
                                  Switch to Trial License
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : isDualModule ? (
                      /* SCENARIO B: DUAL-MODULE (AUCTION + SCORING) */
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-blue-400" />
                            <span className="text-xs font-bold uppercase tracking-wider text-white">
                              Dual-Module Lifecycles
                            </span>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Co-Equal
                          </span>
                        </div>

                        {/* Sub-Section 1: Auction Lifecycle */}
                        <div className="rounded-lg border border-border/60 bg-card/60 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                              <Gavel className="h-3.5 w-3.5 text-primary" />
                              Auction Engine
                            </div>
                            <StatusPill tone={t.licenseStatus === "active" ? "green" : t.licenseStatus === "completed" ? "blue" : "amber"}>
                              {t.licenseStatus.toUpperCase()}
                            </StatusPill>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Ending auction marks auction completed and preserves active sports scoring.
                          </div>
                          <div className="pt-1">
                            <LicenseModeControl
                              licenseStatus={t.licenseStatus}
                              isMaster={isMaster}
                              actionLoading={actionLoading}
                              onSwitchToTrial={() => requestLicenseChange("Switch to Trial", "trial")}
                              onSwitchToLive={() => requestLicenseChange("Switch to Live", "active")}
                              onEndAuction={() => {
                                if (!window.confirm("This will end the auction and prevent further bidding. Match scoring will remain active. Continue?")) return;
                                requestLicenseChange("End auction", "completed", false);
                              }}
                            />
                          </div>
                          {isMaster && t.adminLocked && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 w-full border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 gap-1.5"
                              disabled={!!actionLoading}
                              onClick={() => doAction("Re-open Auction", () => unlockTournament(tournamentId))}
                            >
                              <Unlock className="h-3.5 w-3.5" />
                              Re-open / Unlock Auction
                            </Button>
                          )}
                        </div>

                        {/* Sub-Section 2: Sports Scoring Lifecycle */}
                        <div className="rounded-lg border border-border/60 bg-card/60 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                              <Trophy className="h-3.5 w-3.5 text-emerald-400" />
                              Sports Scoring Phase
                            </div>
                            <StatusPill tone={t.scoringPhase === "active" ? "green" : t.scoringPhase === "completed" ? "blue" : "amber"}>
                              {(t.scoringPhase ?? "setup").toUpperCase()}
                            </StatusPill>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 pt-1">
                            <Button
                              size="sm"
                              variant={t.scoringPhase === "setup" ? "secondary" : "outline"}
                              className={`h-8 text-xs ${t.scoringPhase === "setup" ? "border-amber-500/40 text-amber-300" : ""}`}
                              disabled={!isMaster || t.scoringPhase === "setup" || !!actionLoading}
                              onClick={() => setPendingScoringPhase("setup")}
                            >
                              Setup
                            </Button>
                            <Button
                              size="sm"
                              variant={t.scoringPhase === "active" ? "secondary" : "outline"}
                              className={`h-8 text-xs ${t.scoringPhase === "active" ? "border-green-500/40 text-green-300" : ""}`}
                              disabled={!isMaster || t.scoringPhase === "active" || !!actionLoading}
                              onClick={() => setPendingScoringPhase("active")}
                            >
                              Active / Live
                            </Button>
                            <Button
                              size="sm"
                              variant={t.scoringPhase === "completed" ? "secondary" : "outline"}
                              className={`h-8 text-xs ${t.scoringPhase === "completed" ? "border-blue-500/40 text-blue-300" : ""}`}
                              disabled={!isMaster || t.scoringPhase === "completed" || !!actionLoading}
                              onClick={() => setPendingScoringPhase("completed")}
                            >
                              Completed
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* SCENARIO C: AUCTION-ONLY */
                      <div className="space-y-4">
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

                        {isMaster && t.adminLocked && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 gap-1.5"
                            disabled={!!actionLoading}
                            onClick={() => doAction("Re-open Auction", () => unlockTournament(tournamentId))}
                          >
                            <Unlock className="h-3.5 w-3.5" />
                            Re-open / Unlock Auction
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CARD 2: RUNTIME MODES & FEATURE ENGINES */}
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

                      {/* Sports Scoring Module Toggle */}
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

                      {/* Auction Engine Toggle */}
                      <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-semibold text-white">Auction Engine</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Real-time bidding and player draft engine
                            </div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.auctionEnabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {t.auctionEnabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                        {isMaster && (
                          <Button
                            size="sm"
                            variant="outline"
                            className={`mt-2.5 w-full h-8 text-xs gap-1.5 ${t.auctionEnabled ? "border-primary/40 text-primary hover:bg-primary/10" : ""}`}
                            disabled={!!actionLoading}
                            onClick={() =>
                              doAction(t.auctionEnabled ? "Disable Auction Engine" : "Enable Auction Engine", () =>
                                updateAdminTournament(tournamentId, { auctionEnabled: !t.auctionEnabled })
                              )
                            }
                          >
                            <Gavel className="h-3.5 w-3.5" />
                            {t.auctionEnabled ? "Disable Auction Engine" : "Enable Auction Engine"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CARD 3: EMERGENCY & SAFETY ZONE */}
                  <div className="rounded-xl border border-red-500/40 bg-red-500/[0.04] p-4 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-red-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-red-300">
                            Emergency & Safety Zone
                          </span>
                        </div>
                        {!isScoringOnly && (
                          <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300 border border-red-500/30">
                            {t.resetCount ?? 0}× Resets
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Emergency data operations require super admin master privileges and explicit audit explanation.
                      </p>

                      {/* Box 1: Reset Protocol (Only for tournaments with Auction) */}
                      {!isScoringOnly ? (
                        <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-300">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                              Reset Auction Protocol
                            </div>
                            {(t.resetCount ?? 0) > 0 && (
                              <span className="rounded bg-red-500/30 px-1.5 py-0.5 text-[10px] font-bold text-red-200">
                                {t.resetCount}× used
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-red-200/80 mt-1 leading-normal">
                            Clears all bids, team purses, lot progression, and resets players to available.
                            {isDualModule && " Match scorecards and scoring records remain untouched."}
                          </p>
                          {isMaster && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2.5 w-full h-8 text-xs border-red-500/50 bg-red-500/15 text-red-200 hover:bg-red-500/25 hover:text-white gap-1.5"
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
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-border/60 bg-muted/15 p-3">
                          <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                            <CircleDot className="h-3.5 w-3.5" /> Auction Resets Inapplicable
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-normal">
                            Auction module is disabled for this tournament. Match data and scorecards are managed authoritative in the Scoring Hub.
                          </p>
                        </div>
                      )}

                      {/* Box 2: Permanent Deletion */}
                      <div className="rounded-lg border border-red-500/25 bg-red-950/20 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            Permanent Deletion
                          </div>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                            Destructive
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-normal">
                          Permanently drops tournament, rosters, lots, matches, and linked runtime sessions.
                        </p>
                        {isMaster && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-2.5 w-full h-8 text-xs border border-red-500/30 bg-destructive/10 text-red-300 hover:bg-destructive/25 hover:text-red-100 gap-1.5"
                            onClick={() => setConfirmDelete(true)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Tournament Permanently
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
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
                  {/* Sports Scoring Launchers (When Scoring Enabled) */}
                  {t.scoringEnabled && (
                    <>
                      {t.sport === "cricket" ? (
                        <>
                          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 truncate border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10" asChild>
                            <a href={`/cricket/scorer?tid=${t.id}`} target="_blank" rel="noreferrer">
                              <Trophy className="h-3.5 w-3.5 text-emerald-400" />
                              Scorer Portal
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 truncate border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10" asChild>
                            <a href={`/tournament/${t.id}/score`} target="_blank" rel="noreferrer">
                              <Activity className="h-3.5 w-3.5 text-emerald-400" />
                              Cricket Hub
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 truncate" asChild>
                            <a href={`/cricket/live-control?tid=${t.id}`} target="_blank" rel="noreferrer">
                              <Radio className="h-3.5 w-3.5 text-blue-400" />
                              Live Control
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 truncate" asChild>
                            <a href={`/tournament/${t.id}/cricket/links`} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5 text-amber-400" />
                              Match Links
                            </a>
                          </Button>
                        </>
                      ) : t.sport === "badminton" ? (
                        <>
                          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 truncate border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10" asChild>
                            <a href={`/badminton/scorer?tid=${t.id}`} target="_blank" rel="noreferrer">
                              <Trophy className="h-3.5 w-3.5 text-emerald-400" />
                              Scorer Portal
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 truncate border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10" asChild>
                            <a href={`/tournament/${t.id}/badminton`} target="_blank" rel="noreferrer">
                              <Activity className="h-3.5 w-3.5 text-emerald-400" />
                              Badminton Hub
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 truncate" asChild>
                            <a href={`/badminton/standings?tid=${t.id}`} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5 text-amber-400" />
                              Standings
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 truncate" asChild>
                            <a href={`/tournament/${t.id}/badminton/matches`} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5 text-blue-400" />
                              Matches
                            </a>
                          </Button>
                        </>
                      ) : null}
                    </>
                  )}

                  {/* Auction Launchers (When Auction Enabled) */}
                  {t.auctionEnabled && (
                    <>
                      <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 truncate" asChild>
                        <a href={liveViewerPath(t.id)} target="_blank" rel="noreferrer">
                          <Tv className="h-3.5 w-3.5 text-primary" />
                          Live Viewer
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 truncate" asChild>
                        <a href={obsOverlayPath(t.id)} target="_blank" rel="noreferrer">
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
                          Auction Room
                        </a>
                      </Button>
                    </>
                  )}
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
          ) : tab === "bids" && !isScoringOnly ? (
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
          ) : tab === "live-monitor" && !isScoringOnly ? (
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

      {/* VERIFY PAYMENT & GRANT LIVE LICENSE DIALOG */}
      {t && (
        <Dialog open={verifyPaymentOpen} onOpenChange={setVerifyPaymentOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-emerald-400 flex items-center gap-2">
                <BadgeCheck className="h-5 w-5" /> Verify Payment & Grant Live License
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              Confirm payment receipt for <strong className="text-white">{t.name}</strong> to unlock full live production entitlements.
            </p>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground font-semibold uppercase">Amount Received (₹)</label>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="4999"
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-semibold uppercase">Payment Mode</label>
                  <Input
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    placeholder="upi / bank / razorpay"
                    className="mt-1 h-8 text-xs uppercase"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold uppercase">Payment Ref / UTR / Order ID</label>
                <Input
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. UPI/1234567890 or Bank Txn ID"
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold uppercase">Internal Notes (Optional)</label>
                <Input
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Paid by organiser via GPay"
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <AuditReasonField
                value={paymentAuditReason}
                onChange={setPaymentAuditReason}
                placeholder="Reason: e.g. Payment verified in HDFC account statement"
              />
              {paymentError && <p className="text-xs text-red-400">{paymentError}</p>}
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setVerifyPaymentOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                disabled={paymentSubmitting || !isAuditReasonValid(paymentAuditReason)}
                onClick={async () => {
                  if (tournamentId == null) return;
                  setPaymentSubmitting(true);
                  setPaymentError(null);
                  const parsedAmount = Number(paymentAmount) || 0;
                  const r = await verifyAndGrantTournamentLicense(tournamentId, {
                    requestId: licenseRequest?.id,
                    paymentAmount: parsedAmount,
                    paymentMode: paymentMode.trim() || "upi",
                    paymentRef: paymentRef.trim() || undefined,
                    notes: paymentNotes.trim()
                      ? `${paymentNotes.trim()} [Audit: ${paymentAuditReason.trim()}]`
                      : `Audit: ${paymentAuditReason.trim()}`,
                    reason: paymentAuditReason.trim(),
                  });
                  setPaymentSubmitting(false);
                  if (r.success) {
                    setVerifyPaymentOpen(false);
                    showFlash("Payment verified & live license granted successfully");
                    await Promise.all([reloadDetail(), reloadTournaments()]);
                  } else {
                    setPaymentError(r.error || "Payment verification failed");
                  }
                }}
              >
                {paymentSubmitting ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Verify & Grant Live License
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* RESET AUCTION DATA DIALOG */}
      {t && !isScoringOnly && (
        <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Reset Tournament Auction Data
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will clear all bids, bid feed log, player sales history, and reset tournament progress to block-ready for <strong className="text-white">{t.name}</strong>.
              {isDualModule && " Match schedules, scores, and sports scoring data will be preserved."}
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
                  if (tournamentId == null) return;
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
              Are you sure you want to permanently delete <strong className="text-white">{t.name}</strong> and all related teams, players, matches, and bid logs? This cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={!!actionLoading}
                onClick={async () => {
                  if (tournamentId == null) return;
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

      {/* AUDIT REASON DIALOG FOR SCORING PHASE TRANSITIONS */}
      {tournamentId != null && (
        <AuditReasonDialog
          open={pendingScoringPhase !== null}
          onOpenChange={(open) => {
            if (!open) setPendingScoringPhase(null);
          }}
          title={`Transition Scoring Phase to ${(pendingScoringPhase ?? "").toUpperCase()}`}
          description="Changing the sports scoring lifecycle phase requires an administrative audit reason and is recorded in the platform audit trail."
          confirmLabel={`Set Phase: ${pendingScoringPhase}`}
          loading={actionLoading === "Set Scoring Phase"}
          onConfirm={async (reason) => {
            if (!pendingScoringPhase || tournamentId == null) return;
            setActionLoading("Set Scoring Phase");
            const r = await setTournamentScoringPhase(tournamentId, pendingScoringPhase, reason);
            setActionLoading(null);
            if (!r.success) {
              showFlash(r.error || "Failed to update scoring phase", false);
              return;
            }
            showFlash(`Scoring phase transitioned to ${pendingScoringPhase}`);
            setPendingScoringPhase(null);
            await Promise.all([reloadDetail(), reloadTournaments()]);
          }}
        />
      )}

      {/* AUDIT REASON DIALOG FOR AUCTION / TOURNAMENT LICENCE CHANGES */}
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
