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
  MessageSquare,
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
import { displayOrganizerMobile } from "@workspace/api-base/mobile";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveAuctionMonitor } from "@/components/admin/live-auction-monitor";
import { LiveConnectedEndpointsPanel } from "@/components/admin/live-connected-endpoints-panel";
import { LiveEmergencyPanel } from "@/components/admin/live-emergency-panel";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { Badge } from "@/components/ui/badge";
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
  const [grantWhatsappEnabled, setGrantWhatsappEnabled] = useState(true);

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
    <AdminShell title="Tournament Operations & Controls" eyebrow="Tournament & Organisers › Operations">
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
          <div className="rounded-xl border border-border bg-card/70 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground truncate">{t.name}</h2>
                  <span className="rounded-md bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs font-semibold capitalize">
                    {t.sport}
                  </span>

                  {/* Product Mode Pill */}
                  {isAuctionOnly && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300 border border-amber-500/20">
                      <Gavel className="h-3 w-3" /> Auction Only
                    </span>
                  )}
                  {isScoringOnly && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300 border border-emerald-500/20">
                      <Trophy className="h-3 w-3" /> Scoring Only
                    </span>
                  )}
                  {isDualModule && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-300 border border-blue-500/20">
                      <Sparkles className="h-3 w-3" /> Dual Module (Auction + Scoring)
                    </span>
                  )}

                  {/* Unified Tournament Status */}
                  {t.adminLocked ? (
                    <span className="rounded-md bg-destructive/15 text-destructive border border-destructive/30 px-2 py-0.5 text-xs font-semibold">
                      Emergency Locked
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-semibold border flex items-center gap-1.5",
                        t.status === "active"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : t.status === "completed"
                          ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                          : "bg-muted/40 text-muted-foreground border-border"
                      )}
                    >
                      {t.status === "active" && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      )}
                      {t.status === "active" ? "Live" : t.status === "completed" ? "Completed" : "Setup"}
                    </span>
                  )}

                  {/* License Tier */}
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-semibold border",
                      t.licenseStatus === "active"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    )}
                  >
                    {t.licenseStatus === "active" ? "Production License" : "Trial License"}
                  </span>

                  {t.localModeEnabled && (
                    <span className="rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-xs font-medium flex items-center gap-1">
                      <MonitorDown className="w-3 h-3" /> Local Mode
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>ID <strong className="font-mono text-foreground">#{t.id}</strong></span>
                  <span>·</span>
                  <span>{t.venue ? `${t.venue}, ` : ""}{t.city || "Venue TBD"}</span>
                  <span>·</span>
                  <span>
                    {t.auctionDate
                      ? new Date(t.auctionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "Unscheduled"}
                    {t.auctionTime ? ` · ${t.auctionTime}` : ""}
                  </span>
                  {t.organizerName && (
                    <>
                      <span>·</span>
                      <span>
                        Host: <strong className="text-foreground">{t.organizerName}</strong>
                        {t.organizerMobile && displayOrganizerMobile(t.organizerMobile) ? (
                          <span className="font-mono text-muted-foreground ml-1">
                            ({displayOrganizerMobile(t.organizerMobile)})
                          </span>
                        ) : null}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* High-Level Overview Metrics */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-t border-border/60 pt-3 lg:border-t-0 lg:pt-0">
                <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-2 text-center min-w-[70px]">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Teams</div>
                  <div className="text-sm font-bold text-foreground">{detail.teams.length}</div>
                </div>

                <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-2 text-center min-w-[70px]">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Players</div>
                  <div className="text-sm font-bold text-foreground">
                    {detail.players.length}
                    {!isScoringOnly && soldCount > 0 && (
                      <span className="text-xs font-normal text-muted-foreground ml-1">({soldCount} sold)</span>
                    )}
                  </div>
                </div>

                {!isScoringOnly && (
                  <>
                    <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-2 text-center min-w-[85px]">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Base Purse</div>
                      <div className="text-sm font-bold text-primary">₹{(t.basePurse / 10000000).toFixed(2)} Cr</div>
                    </div>
                    <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-2 text-center min-w-[70px]">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Bid Events</div>
                      <div className="text-sm font-bold text-foreground">{detail.recentBids.length}</div>
                    </div>
                  </>
                )}

                {!isAuctionOnly && (
                  <>
                    <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-2 text-center min-w-[70px]">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Matches</div>
                      <div className="text-sm font-bold text-emerald-400">
                        {matchCounts.total}
                        {matchCounts.live > 0 && (
                          <span className="text-xs text-red-400 ml-1">({matchCounts.live} live)</span>
                        )}
                      </div>
                    </div>
                    {isScoringOnly && (
                      <>
                        <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-2 text-center min-w-[65px]">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Completed</div>
                          <div className="text-sm font-bold text-blue-400">{matchCounts.completed}</div>
                        </div>
                        <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-2 text-center min-w-[65px]">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Upcoming</div>
                          <div className="text-sm font-bold text-muted-foreground">{matchCounts.upcoming}</div>
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
              {!isScoringOnly && (
                <DataTabLink id="bids" label={`Bid Log (${detail.recentBids.length})`} tournamentId={tournamentId} active={tab} />
              )}
            </div>

            {/* Live Operations Tabs */}
            <div className="flex items-center gap-1.5 border-t border-border/60 pt-2 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-3 overflow-x-auto max-w-full pb-1 sm:pb-0">
              {!isScoringOnly && (
                <LiveOpsTabLink
                  section="monitor"
                  label="Live Monitor"
                  tournamentId={tournamentId}
                  active={tab}
                />
              )}
              <LiveOpsTabLink
                section="endpoints"
                label="Endpoints & Sessions"
                tournamentId={tournamentId}
                active={tab}
              />
            </div>
          </div>

          {/* TAB: OVERVIEW & PROMINENT CONTROLS */}
          {tab === "overview" ? (
            <div className="space-y-6">
              {/* Dual-Lifecycle Architecture Context Note */}
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3.5 py-2.5 text-xs text-muted-foreground flex items-center justify-between">
                <span>
                  <strong className="text-foreground">Dual-Lifecycle Decoupling: </strong>
                  Concluding an auction does not conclude or lock match scoring. Modules operate independently.
                </span>
                <span className="text-[11px] text-muted-foreground/80 font-mono">
                  Module: {productMode.replace("_", " ").toUpperCase()}
                </span>
              </div>

              {/* SECTION 1: OPERATIONS & LIFECYCLE CONTROLS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Panel 1: Engine Lifecycle & License Management */}
                <div className="rounded-xl border border-border bg-card/70 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {isDualModule ? "Dual-Module Lifecycles" : "Tournament Lifecycle & Licensing"}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Authoritative module state transitions.</p>
                      </div>
                    </div>
                    {!isMaster && (
                      <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300 border border-amber-500/20">
                        Read-Only
                      </span>
                    )}
                  </div>

                  {/* Auction Lifecycle (if auction enabled) */}
                  {t.auctionEnabled && (
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Gavel className="h-3.5 w-3.5 text-primary" />
                          Auction Engine
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-semibold uppercase",
                            t.licenseStatus === "active"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : t.licenseStatus === "completed"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          )}
                        >
                          {t.licenseStatus}
                        </Badge>
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
                            if (!window.confirm("This will end the auction and prevent further bidding. Continue?")) return;
                            requestLicenseChange("End auction", "completed", false);
                          }}
                        />
                      </div>

                      {isMaster && t.adminLocked && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-8 text-xs border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 gap-1.5"
                          disabled={!!actionLoading}
                          onClick={() => doAction("Re-open Auction", () => unlockTournament(tournamentId))}
                        >
                          <Unlock className="h-3.5 w-3.5" />
                          Re-open / Unlock Auction
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Scoring Phase Lifecycle (if scoring enabled) */}
                  {t.scoringEnabled && (
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Trophy className="h-3.5 w-3.5 text-emerald-400" />
                          Sports Scoring Phase
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-semibold uppercase",
                            t.scoringPhase === "active"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : t.scoringPhase === "completed"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          )}
                        >
                          {t.scoringPhase ?? "setup"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <Button
                          size="sm"
                          variant={t.scoringPhase === "setup" ? "secondary" : "outline"}
                          className={cn("h-8 text-xs font-medium", t.scoringPhase === "setup" && "border-amber-500/40 text-amber-300")}
                          disabled={!isMaster || t.scoringPhase === "setup" || !!actionLoading}
                          onClick={() => setPendingScoringPhase("setup")}
                        >
                          Setup
                        </Button>
                        <Button
                          size="sm"
                          variant={t.scoringPhase === "active" ? "secondary" : "outline"}
                          className={cn("h-8 text-xs font-medium", t.scoringPhase === "active" && "border-emerald-500/40 text-emerald-300")}
                          disabled={!isMaster || t.scoringPhase === "active" || !!actionLoading}
                          onClick={() => setPendingScoringPhase("active")}
                        >
                          Active / Live
                        </Button>
                        <Button
                          size="sm"
                          variant={t.scoringPhase === "completed" ? "secondary" : "outline"}
                          className={cn("h-8 text-xs font-medium", t.scoringPhase === "completed" && "border-blue-500/40 text-blue-300")}
                          disabled={!isMaster || t.scoringPhase === "completed" || !!actionLoading}
                          onClick={() => setPendingScoringPhase("completed")}
                        >
                          Completed
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Tournament License Status box */}
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-foreground">Tournament License Status</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {t.licenseStatus === "active" ? "Production license unlocked" : "Trial limits applied"}
                      </div>
                    </div>
                    {isMaster && (
                      <Button
                        size="sm"
                        variant={t.licenseStatus === "active" ? "outline" : "default"}
                        className="h-8 text-xs"
                        onClick={() => requestLicenseChange(
                          t.licenseStatus === "active" ? "Switch to Trial" : "Switch to Live License",
                          t.licenseStatus === "active" ? "trial" : "active"
                        )}
                      >
                        {t.licenseStatus === "active" ? "Switch to Trial" : "Upgrade to Live"}
                      </Button>
                    )}
                  </div>

                  {/* WhatsApp Communication Module Control */}
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-emerald-400" />
                          <span className="text-xs font-semibold text-foreground">WhatsApp Messaging Service</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-semibold",
                              t.features?.whatsappNotifications === false
                                ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                : t.licenseStatus === "active"
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                : "bg-muted/40 text-muted-foreground border-border"
                            )}
                          >
                            {t.features?.whatsappNotifications === false
                              ? "Disabled by Admin"
                              : t.licenseStatus === "active"
                              ? "Active & Enabled"
                              : "Trial (Blocked)"}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {t.features?.whatsappNotifications === false
                            ? "Automated player-sold alerts and Communication Center blasts are disabled for this tournament (e.g. discounted in-person license fee)."
                            : t.licenseStatus === "active"
                            ? "Approved Meta utility templates (player-sold with celebration image) and Communication Center blasts are active."
                            : "WhatsApp messaging requires an active live tournament license."}
                        </p>
                      </div>
                    </div>

                    {isMaster && (
                      <div className="pt-1">
                        {t.features?.whatsappNotifications === false ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-8 text-xs gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                            disabled={!!actionLoading}
                            onClick={() =>
                              doAction("Enable WhatsApp", async () => {
                                const res = await updateAdminTournament(t.id, {
                                  features: { ...t.features, whatsappNotifications: true },
                                });
                                if (res.success) {
                                  showFlash("WhatsApp messaging service enabled for this tournament");
                                  await reloadDetail();
                                }
                                return res;
                              })
                            }
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Enable WhatsApp Messaging
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-8 text-xs gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                            disabled={!!actionLoading}
                            onClick={() =>
                              doAction("Disable WhatsApp", async () => {
                                const res = await updateAdminTournament(t.id, {
                                  features: { ...t.features, whatsappNotifications: false },
                                });
                                if (res.success) {
                                  showFlash("WhatsApp messaging service disabled for this tournament (discounted plan)");
                                  await reloadDetail();
                                }
                                return res;
                              })
                            }
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Disable WhatsApp Messaging (Discounted / No-WhatsApp Plan)
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Panel 2: Infrastructure & Runtime Modes */}
                <div className="rounded-xl border border-border bg-card/70 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Radio className="h-4 w-4 text-primary" />
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Runtime Modes & Connectivity</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Infrastructure and operator link controls.</p>
                      </div>
                    </div>
                  </div>

                  {/* Operator Connection: Cloud vs Local */}
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-foreground">Operator Connection Mode</div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {t.localModeEnabled ? "Running on local venue Wi-Fi network" : "Connected directly to cloud database"}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-semibold",
                          t.localModeEnabled
                            ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                            : "bg-blue-500/10 text-blue-300 border-blue-500/20"
                        )}
                      >
                        {t.localModeEnabled ? "Local Wi-Fi" : "Cloud Sync"}
                      </Badge>
                    </div>

                    {isMaster && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs gap-1.5 mt-2"
                        disabled={!!actionLoading}
                        onClick={() =>
                          doAction(t.localModeEnabled ? "Switch to Cloud" : "Enable Local Mode", () =>
                            updateAdminTournament(tournamentId, { localModeEnabled: !t.localModeEnabled })
                          )
                        }
                      >
                        <MonitorDown className="h-3.5 w-3.5" />
                        {t.localModeEnabled ? "Switch to Cloud Synchronized Mode" : "Enable Local Venue Wi-Fi Mode"}
                      </Button>
                    )}
                  </div>

                  {/* Active Feature Engines */}
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 space-y-3">
                    <div className="text-xs font-semibold text-foreground">Active Feature Modules</div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Gavel className="w-3.5 h-3.5 text-primary" /> Auction & Purse Engine
                        </span>
                        <Badge variant="outline" className={cn("text-[10px]", t.auctionEnabled ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" : "text-muted-foreground")}>
                          {t.auctionEnabled ? "Active" : "Disabled"}
                        </Badge>
                      </div>

                      {(t.sport === "cricket" || t.sport === "badminton") && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Trophy className="w-3.5 h-3.5 text-emerald-400" /> Match Scoring Engine ({t.sport})
                          </span>
                          <Badge variant="outline" className={cn("text-[10px]", t.scoringEnabled ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" : "text-muted-foreground")}>
                            {t.scoringEnabled ? "Active" : "Disabled"}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: QUICK ROOM & DISPLAY LAUNCHERS */}
              <div className="rounded-xl border border-border bg-card/70 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Quick Launchers & Displays</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Direct links to operational rooms, overlays, and public views.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-primary hover:text-primary/80 gap-1"
                    onClick={() => navigate(tournamentLiveOpsPath(t.id, "endpoints"))}
                  >
                    Open Endpoints Hub →
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Category 1: Match Center & Scoring */}
                  {t.scoringEnabled && (
                    <div className="rounded-lg border border-border/60 bg-muted/15 p-3.5 space-y-2.5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5 text-emerald-400" /> Match Center & Scoring
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {t.sport === "cricket" ? (
                          <>
                            <Button variant="outline" size="sm" className="h-8 justify-start text-xs gap-2" asChild>
                              <a href={`/cricket/scorer?tid=${t.id}`} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-3.5 w-3.5 text-emerald-400" /> Scorer Portal
                              </a>
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 justify-start text-xs gap-2" asChild>
                              <a href={`/tournament/${t.id}/score`} target="_blank" rel="noreferrer">
                                <Activity className="h-3.5 w-3.5 text-emerald-400" /> Cricket Match Center
                              </a>
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 justify-start text-xs gap-2" asChild>
                              <a href={`/cricket/live-control?tid=${t.id}`} target="_blank" rel="noreferrer">
                                <Radio className="h-3.5 w-3.5 text-blue-400" /> Live Match Control
                              </a>
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 justify-start text-xs gap-2" asChild>
                              <a href={`/tournament/${t.id}/cricket/links`} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-3.5 w-3.5 text-amber-400" /> Match Links
                              </a>
                            </Button>
                          </>
                        ) : t.sport === "badminton" ? (
                          <>
                            <Button variant="outline" size="sm" className="h-8 justify-start text-xs gap-2" asChild>
                              <a href={`/badminton/scorer?tid=${t.id}`} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-3.5 w-3.5 text-emerald-400" /> Badminton Scorer
                              </a>
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 justify-start text-xs gap-2" asChild>
                              <a href={`/tournament/${t.id}/badminton`} target="_blank" rel="noreferrer">
                                <Activity className="h-3.5 w-3.5 text-emerald-400" /> Badminton Hub
                              </a>
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 justify-start text-xs gap-2" asChild>
                              <a href={`/badminton/standings?tid=${t.id}`} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-3.5 w-3.5 text-amber-400" /> Standings
                              </a>
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 justify-start text-xs gap-2" asChild>
                              <a href={`/tournament/${t.id}/badminton/matches`} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-3.5 w-3.5 text-blue-400" /> Matches
                              </a>
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {/* Category 2: Auction Operations */}
                  {t.auctionEnabled && (
                    <div className="rounded-lg border border-border/60 bg-muted/15 p-3.5 space-y-2.5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Gavel className="w-3.5 h-3.5 text-primary" /> Auction Operations
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Button variant="outline" size="sm" className="h-8 justify-start text-xs gap-2" asChild>
                          <a href={`/tournament/${t.id}/auction`} target="_blank" rel="noreferrer">
                            <Radio className="h-3.5 w-3.5 text-red-400" /> Live Auction Room
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 justify-start text-xs gap-2" asChild>
                          <a href={`/admin/tournaments/${t.id}/workbook`} target="_blank" rel="noreferrer">
                            <Database className="h-3.5 w-3.5 text-primary" /> Master Workbook
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 justify-start text-xs gap-2" asChild>
                          <a href={liveViewerPath(t.id)} target="_blank" rel="noreferrer">
                            <Tv className="h-3.5 w-3.5 text-primary" /> Live Public Viewer
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Category 3: Broadcast & Displays */}
                  <div className="rounded-lg border border-border/60 bg-muted/15 p-3.5 space-y-2.5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Tv className="w-3.5 h-3.5 text-blue-400" /> Broadcast & Stage Displays
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {t.auctionEnabled && (
                        <>
                          <Button variant="outline" size="sm" className="h-8 justify-start text-xs gap-2" asChild>
                            <a href={obsOverlayPath(t.id)} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5 text-amber-400" /> OBS Stream Overlay
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 justify-start text-xs gap-2" asChild>
                            <a href={sideDisplayPath(t.id, "sponsors")} target="_blank" rel="noreferrer">
                              <Tv className="h-3.5 w-3.5 text-emerald-400" /> Stage / Sponsor LED
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 justify-start text-xs gap-2" asChild>
                            <a href={sideDisplayPath(t.id, "player")} target="_blank" rel="noreferrer">
                              <Users className="h-3.5 w-3.5 text-indigo-400" /> Player Profile Screen
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 justify-start text-xs gap-2" asChild>
                            <a href={`/tournament/${t.id}/break-timer`} target="_blank" rel="noreferrer">
                              <Activity className="h-3.5 w-3.5 text-blue-400" /> Break Timer Screen
                            </a>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: DANGER ZONE (BOTTOM QUARANTINED) */}
              <div className="rounded-xl border border-destructive/30 bg-destructive/[0.03] p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b border-destructive/20 pb-2.5">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive">Danger Zone</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Reset Auction Protocol */}
                  {!isScoringOnly ? (
                    <div className="rounded-lg border border-destructive/20 bg-background/50 p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">Reset Auction Data</span>
                        {(t.resetCount ?? 0) > 0 && (
                          <span className="text-[10px] font-semibold text-destructive px-1.5 py-0.5 rounded bg-destructive/10">
                            {t.resetCount}× previously reset
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        Clears all bids, team purses, and lots. Resets auction progress while preserving roster and match scorecards.
                      </p>
                      {isMaster && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-8 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 gap-1.5 mt-2"
                          onClick={() => {
                            setResetPassword("");
                            setResetError(null);
                            setResetReason("");
                            setConfirmReset(true);
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Reset Auction Data
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border/60 bg-muted/15 p-3.5">
                      <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <CircleDot className="h-3.5 w-3.5" /> Auction Resets Inapplicable
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-normal">
                        Auction module is disabled for this tournament. Match data and scorecards are managed authoritative in the Scoring Hub.
                      </p>
                    </div>
                  )}

                  {/* Permanent Deletion */}
                  <div className="rounded-lg border border-destructive/20 bg-background/50 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-destructive">Permanent Tournament Deletion</span>
                      <span className="text-[10px] uppercase font-bold text-destructive px-1.5 py-0.5 rounded bg-destructive/10">
                        Irreversible
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      Permanently drops tournament, rosters, teams, lots, matches, and linked runtime sessions.
                    </p>
                    {isMaster && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full h-8 text-xs border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 gap-1.5 mt-2"
                        onClick={() => setConfirmDelete(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete Tournament Permanently
                      </Button>
                    )}
                  </div>
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
              <div className="flex items-center space-x-2 pt-1 border-t border-border/60">
                <input
                  type="checkbox"
                  id="grantWhatsappEnabled"
                  checked={grantWhatsappEnabled}
                  onChange={(e) => setGrantWhatsappEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-emerald-500"
                />
                <label htmlFor="grantWhatsappEnabled" className="text-xs text-muted-foreground select-none cursor-pointer">
                  Enable WhatsApp Messaging Service{" "}
                  <span className="text-[11px] opacity-75">(Uncheck if paid discounted amount without WhatsApp)</span>
                </label>
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
                    if (!grantWhatsappEnabled && t) {
                      await updateAdminTournament(tournamentId, {
                        features: { ...t.features, whatsappNotifications: false },
                      });
                    }
                    setVerifyPaymentOpen(false);
                    showFlash(
                      grantWhatsappEnabled
                        ? "Payment verified & live license granted successfully"
                        : "Payment verified & live license granted (WhatsApp disabled for discounted plan)"
                    );
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
