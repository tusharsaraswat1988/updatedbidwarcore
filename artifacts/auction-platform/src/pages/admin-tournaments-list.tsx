import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowRightLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trophy,
  UserCheck,
  X,
} from "lucide-react";
import { displayOrganizerMobile } from "@workspace/api-base/mobile";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminScrollPanel } from "@/components/admin/admin-scroll-panel";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AuditReasonField, isAuditReasonValid } from "@/components/audit-reason-field";
import {
  AdminTournamentRow,
  listAdminTournaments,
  setTournamentLicenseStatus,
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import { CreateTournamentModal } from "@/pages/admin";
import { TransferOrganizerDialog } from "@/components/admin/transfer-organizer-dialog";

function getSportTag(sportName?: string) {
  const s = (sportName || "general").toLowerCase();
  if (s.includes("badminton")) return { label: "Badminton", emoji: "🏸" };
  if (s.includes("cricket")) return { label: "Cricket", emoji: "🏏" };
  if (s.includes("football") || s.includes("soccer")) return { label: "Football", emoji: "⚽" };
  if (s.includes("volleyball")) return { label: "Volleyball", emoji: "🏐" };
  if (s.includes("kabaddi")) return { label: "Kabaddi", emoji: "🤼" };
  if (s.includes("esport") || s.includes("gaming")) return { label: "Esports", emoji: "🎮" };
  return { label: sportName || "Sports", emoji: "🏆" };
}

function formatSchedule(dateStr?: string | null, timeStr?: string | null) {
  if (!dateStr) return "Not scheduled";
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return timeStr ? `${formatted} · ${timeStr}` : formatted;
    }
  } catch {}
  return `${dateStr}${timeStr ? ` · ${timeStr}` : ""}`;
}

function formatCreatedDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
  } catch {}
  return "—";
}

// Clean, professional status indicator without boxy borders
function UnifiedTournamentStatus({
  status,
  adminLocked,
}: {
  status: string;
  adminLocked: boolean;
}) {
  if (adminLocked) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400">
        <Lock className="w-3 h-3 text-red-400 shrink-0" />
        <span>Locked</span>
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span>Live</span>
      </div>
    );
  }
  if (status === "completed") {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
        <span>Completed</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
      <span className="capitalize">{status || "Setup"}</span>
    </div>
  );
}

// Clean, professional license indicator without boxy borders
function LicenseTierBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
        <span>Live License</span>
      </div>
    );
  }
  if (status === "completed") {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
        <span>Archived</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
      <span>Trial</span>
    </div>
  );
}

type TournamentStatusFilter = "all" | "setup" | "active" | "completed" | "locked";
type LicenseStatusFilter = "all" | "trial" | "active";

// Mathematically balanced responsive grid proportions for 9 columns:
// Tournament(2fr) | Sport(95px) | Code(100px) | Organiser(1.3fr) | Created(105px) | Schedule(125px) | Status(90px) | License(105px) | Action(140px)
const GRID_COLS = "lg:grid lg:grid-cols-[minmax(200px,2fr)_95px_100px_minmax(140px,1.3fr)_105px_125px_90px_105px_140px] lg:items-center lg:gap-3";

const AUDIT_REASON_PRESETS = [
  "Payment verified in bank statement",
  "Offline cash payment verified",
  "Complimentary organizer access approved",
  "Direct super admin approval",
];

export default function AdminTournamentsListPage() {
  const [, navigate] = useLocation();
  const { isLoggedIn, isLoading: authLoading } = useAdminPageGuard();
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tournamentStatusFilter, setTournamentStatusFilter] = useState<TournamentStatusFilter>("all");
  const [licenseStatusFilter, setLicenseStatusFilter] = useState<LicenseStatusFilter>("all");
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  // Quick grant license modal state
  const [grantTarget, setGrantTarget] = useState<AdminTournamentRow | null>(null);
  const [grantReason, setGrantReason] = useState("");
  const [grantLoading, setGrantLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ msg: string; ok: boolean } | null>(null);

  // Transfer organiser state
  const [transferTarget, setTransferTarget] = useState<AdminTournamentRow | null>(null);

  function showFlash(msg: string, ok = true) {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 4000);
  }

  async function load() {
    setLoading(true);
    const data = await listAdminTournaments();
    // Sort latest first by default (by createdAt or id desc)
    const sorted = [...data].sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      if (tb !== ta) return tb - ta;
      return b.id - a.id;
    });
    setTournaments(sorted);
    setLoading(false);
  }

  useEffect(() => {
    if (isLoggedIn) load();
  }, [isLoggedIn]);

  useEffect(() => {
    if (window.location.pathname === "/admin/tournaments/new") setCreateOpen(true);
  }, []);

  const sportsList = useMemo(() => {
    const set = new Set<string>();
    tournaments.forEach((t) => {
      if (t.sport) set.add(t.sport.toLowerCase());
    });
    return Array.from(set);
  }, [tournaments]);

  const tournamentCounts = useMemo(() => {
    let active = 0;
    let setup = 0;
    let completed = 0;
    let locked = 0;
    for (const t of tournaments) {
      if (t.adminLocked) locked += 1;
      if (t.status === "active") active += 1;
      else if (t.status === "completed") completed += 1;
      else setup += 1;
    }
    return { all: tournaments.length, setup, active, completed, locked };
  }, [tournaments]);

  const licenseCounts = useMemo(() => {
    let trial = 0;
    let active = 0;
    for (const t of tournaments) {
      if (t.licenseStatus === "active") active += 1;
      else trial += 1;
    }
    return { all: tournaments.length, trial, active };
  }, [tournaments]);

  const filtered = useMemo(() => {
    return tournaments.filter((t) => {
      // Tournament status filter
      if (tournamentStatusFilter === "locked" && !t.adminLocked) return false;
      if (tournamentStatusFilter === "active" && t.status !== "active") return false;
      if (tournamentStatusFilter === "setup" && t.status !== "setup" && t.status !== "draft" && !!t.status) return false;
      if (tournamentStatusFilter === "completed" && t.status !== "completed") return false;

      // License status filter
      if (licenseStatusFilter === "trial" && t.licenseStatus !== "trial") return false;
      if (licenseStatusFilter === "active" && t.licenseStatus !== "active") return false;

      // Sport filter
      if (sportFilter !== "all" && (t.sport || "").toLowerCase() !== sportFilter) return false;

      // Search query
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const cleanMobile = displayOrganizerMobile(t.organizerMobile) || "";
      return (
        t.name.toLowerCase().includes(q) ||
        (t.season && t.season.toLowerCase().includes(q)) ||
        (t.auctionCode && t.auctionCode.toLowerCase().includes(q)) ||
        String(t.id).includes(q) ||
        (t.sport && t.sport.toLowerCase().includes(q)) ||
        cleanMobile.includes(q) ||
        (t.organizerEmail && t.organizerEmail.toLowerCase().includes(q)) ||
        (t.organizerName && t.organizerName.toLowerCase().includes(q))
      );
    });
  }, [tournaments, search, tournamentStatusFilter, licenseStatusFilter, sportFilter]);

  function handleCopyCode(e: React.MouseEvent, code: string) {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode((curr) => (curr === code ? null : curr)), 1800);
  }

  async function handleGrantLicenseConfirm() {
    if (!grantTarget || !isAuditReasonValid(grantReason)) return;
    setGrantLoading(true);
    const res = await setTournamentLicenseStatus(grantTarget.id, "active", grantReason.trim());
    setGrantLoading(false);
    if (res.success) {
      showFlash(`Live license successfully granted to "${grantTarget.name}"`, true);
      setGrantTarget(null);
      setGrantReason("");
      await load();
    } else {
      showFlash(res.error || "Failed to grant license", false);
    }
  }

  const isAnyFilterActive =
    tournamentStatusFilter !== "all" ||
    licenseStatusFilter !== "all" ||
    sportFilter !== "all" ||
    Boolean(search.trim());

  if (authLoading || !isLoggedIn) return null;

  return (
    <AdminShell
      title="Tournaments"
      eyebrow="Tournament Management"
      actions={
        <Button size="sm" className="gap-1.5 font-semibold text-white shadow-sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Tournament
        </Button>
      }
    >
      {flash && (
        <div
          className={cn(
            "mb-3 flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium shadow-sm transition-all",
            flash.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          )}
        >
          {flash.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Clock className="h-4 w-4 shrink-0" />}
          <span>{flash.msg}</span>
          <button onClick={() => setFlash(null)} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card/70 shadow-sm overflow-hidden">
        {/* Top Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border p-3 gap-3 bg-card/50">
          {/* Left: Search Input */}
          <div className="relative w-full sm:w-80 flex-shrink-0">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tournament, code, sport, host..."
              className="h-8.5 pl-8 pr-7 text-xs bg-background/70 border-border"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Right: Sport Selector & Refresh */}
          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {sportsList.length > 0 && (
              <select
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background/80 px-2.5 text-xs text-foreground outline-none focus:border-primary"
              >
                <option value="all">All Sports ({tournaments.length})</option>
                {sportsList.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            )}

            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 gap-1.5 text-xs"
              onClick={load}
              title="Refresh tournaments"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Global Standard Segmented Filter Bar with High-Contrast Active States */}
        <div className="border-b border-border px-3.5 py-2.5 bg-muted/20 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 text-xs">
          {/* Filter Groups */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Tournament Status Group */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Tournament:
              </span>
              <div className="inline-flex items-center rounded-lg bg-background p-0.5 border border-border shadow-xs">
                <button
                  type="button"
                  onClick={() => setTournamentStatusFilter("all")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs transition-all whitespace-nowrap",
                    tournamentStatusFilter === "all"
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium"
                  )}
                >
                  All ({tournamentCounts.all})
                </button>
                <button
                  type="button"
                  onClick={() => setTournamentStatusFilter("setup")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs transition-all whitespace-nowrap",
                    tournamentStatusFilter === "setup"
                      ? "bg-slate-200 text-slate-900 font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium"
                  )}
                >
                  Setup ({tournamentCounts.setup})
                </button>
                <button
                  type="button"
                  onClick={() => setTournamentStatusFilter("active")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs transition-all whitespace-nowrap",
                    tournamentStatusFilter === "active"
                      ? "bg-emerald-500 text-white font-bold shadow-xs"
                      : "text-muted-foreground hover:text-emerald-400 hover:bg-muted/40 font-medium"
                  )}
                >
                  Live ({tournamentCounts.active})
                </button>
                <button
                  type="button"
                  onClick={() => setTournamentStatusFilter("completed")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs transition-all whitespace-nowrap",
                    tournamentStatusFilter === "completed"
                      ? "bg-blue-500 text-white font-bold shadow-xs"
                      : "text-muted-foreground hover:text-blue-400 hover:bg-muted/40 font-medium"
                  )}
                >
                  Completed ({tournamentCounts.completed})
                </button>
                {tournamentCounts.locked > 0 && (
                  <button
                    type="button"
                    onClick={() => setTournamentStatusFilter("locked")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs transition-all whitespace-nowrap",
                      tournamentStatusFilter === "locked"
                        ? "bg-red-500 text-white font-bold shadow-xs"
                        : "text-muted-foreground hover:text-red-400 hover:bg-muted/40 font-medium"
                    )}
                  >
                    Locked ({tournamentCounts.locked})
                  </button>
                )}
              </div>
            </div>

            {/* Subtle Vertical Divider */}
            <div className="hidden sm:block h-4 w-px bg-border/80 self-center" />

            {/* License Status Group */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                License:
              </span>
              <div className="inline-flex items-center rounded-lg bg-background p-0.5 border border-border shadow-xs">
                <button
                  type="button"
                  onClick={() => setLicenseStatusFilter("all")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs transition-all whitespace-nowrap",
                    licenseStatusFilter === "all"
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium"
                  )}
                >
                  All Licenses ({licenseCounts.all})
                </button>
                <button
                  type="button"
                  onClick={() => setLicenseStatusFilter("trial")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs transition-all whitespace-nowrap",
                    licenseStatusFilter === "trial"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                      : "text-muted-foreground hover:text-amber-300 hover:bg-muted/40 font-medium"
                  )}
                >
                  Trial ({licenseCounts.trial})
                </button>
                <button
                  type="button"
                  onClick={() => setLicenseStatusFilter("active")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs transition-all whitespace-nowrap",
                    licenseStatusFilter === "active"
                      ? "bg-emerald-500 text-white font-bold shadow-xs"
                      : "text-muted-foreground hover:text-emerald-300 hover:bg-muted/40 font-medium"
                  )}
                >
                  Live License ({licenseCounts.active})
                </button>
              </div>
            </div>
          </div>

          {/* Counts and Clear Controls */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground self-end xl:self-auto">
            <span className="font-medium text-[11px]">
              {filtered.length === tournaments.length
                ? `${tournaments.length} tournaments · Latest first`
                : `Showing ${filtered.length} of ${tournaments.length} tournaments`}
            </span>
            {isAnyFilterActive && (
              <button
                type="button"
                onClick={() => {
                  setTournamentStatusFilter("all");
                  setLicenseStatusFilter("all");
                  setSportFilter("all");
                  setSearch("");
                }}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors underline decoration-dotted"
              >
                <X className="h-3 w-3" /> Reset
              </button>
            )}
          </div>
        </div>

        {/* Table Header: Exactly matching GRID_COLS and row padding */}
        <AdminListHeader
          gridClassName={GRID_COLS}
          columns={[
            { label: "Tournament" },
            { label: "Sport" },
            { label: "Code" },
            { label: "Organiser" },
            { label: "Created" },
            { label: "Schedule" },
            { label: "Status" },
            { label: "License" },
            { label: "Action", align: "right" },
          ]}
        />

        <AdminScrollPanel>
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
              <Trophy className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <span className="font-semibold text-foreground">
                {search || tournamentStatusFilter !== "all" || licenseStatusFilter !== "all" || sportFilter !== "all"
                  ? "No tournaments match your search and filter criteria."
                  : "No tournaments registered yet."}
              </span>
              {!isAnyFilterActive ? (
                <Button size="sm" onClick={() => setCreateOpen(true)} className="mt-3 gap-1">
                  <Plus className="h-3.5 w-3.5" /> Create tournament
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setTournamentStatusFilter("all");
                    setLicenseStatusFilter("all");
                    setSportFilter("all");
                  }}
                  className="mt-3 text-xs"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((t) => {
                const sport = getSportTag(t.sport);
                const safeMobile = displayOrganizerMobile(t.organizerMobile);
                return (
                  <div
                    key={t.id}
                    onClick={() => navigate(`/admin/tournaments/${t.id}`)}
                    className={`block w-full border-b border-border px-4 py-3 text-left text-sm hover:bg-accent/40 transition-colors cursor-pointer ${GRID_COLS} lg:border-b-0`}
                  >
                    {/* Col 1: Tournament Name */}
                    <div className="min-w-0">
                      <span
                        className="font-bold text-foreground text-sm hover:text-primary transition-colors truncate block"
                        title={t.name}
                      >
                        {t.name}
                      </span>
                      {t.season?.trim() ? (
                        <span className="text-[11px] text-muted-foreground truncate block font-medium">
                          {t.season.trim()}
                        </span>
                      ) : null}
                    </div>

                    {/* Col 2: Sport (Clean icon + typography, no box) */}
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/90 min-w-0 mt-1.5 lg:mt-0">
                      <span className="text-sm shrink-0">{sport.emoji}</span>
                      <span className="truncate">{sport.label}</span>
                    </div>

                    {/* Col 3: Tournament / Auction Code (Clean font-mono + subtle copy icon) */}
                    <div className="flex items-center min-w-0 mt-1.5 lg:mt-0">
                      {t.auctionCode ? (
                        <button
                          type="button"
                          onClick={(e) => handleCopyCode(e, t.auctionCode!)}
                          title="Click to copy tournament code"
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground/80 hover:text-foreground transition-colors group cursor-pointer"
                        >
                          <span className="tracking-wider">{t.auctionCode}</span>
                          {copiedCode === t.auctionCode ? (
                            <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground/40 font-mono">—</span>
                      )}
                    </div>

                    {/* Col 4: Organiser (Name + Contact + Linked Indicator) */}
                    <div className="min-w-0 flex flex-col justify-center mt-1.5 lg:mt-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-xs font-medium text-foreground/90">
                          {t.organizerName || <span className="text-muted-foreground italic">Unlinked Host</span>}
                        </span>
                        {t.organizerId ? (
                          <UserCheck className="h-3 w-3 text-emerald-400 shrink-0" title="Linked Host Account" />
                        ) : null}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTransferTarget(t);
                          }}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shrink-0"
                          title="Transfer or Reassign Organiser"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                        </button>
                      </div>
                      {safeMobile ? (
                        <span className="block truncate text-[11px] text-muted-foreground font-mono">
                          {safeMobile}
                        </span>
                      ) : t.organizerEmail ? (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {t.organizerEmail}
                        </span>
                      ) : (
                        <span className="block truncate text-[11px] text-muted-foreground/60">
                          No contact on file
                        </span>
                      )}
                    </div>

                    {/* Col 5: Created Date */}
                    <div className="text-xs text-muted-foreground min-w-0 mt-1.5 lg:mt-0 whitespace-nowrap">
                      {formatCreatedDate(t.createdAt)}
                    </div>

                    {/* Col 6: Schedule */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 mt-1.5 lg:mt-0">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 hidden lg:inline" />
                      <span className="truncate">{formatSchedule(t.auctionDate, t.auctionTime)}</span>
                    </div>

                    {/* Col 7: Tournament Status (Clean dot indicator, no box) */}
                    <div className="flex items-center min-w-0 mt-1.5 lg:mt-0">
                      <UnifiedTournamentStatus status={t.status} adminLocked={t.adminLocked} />
                    </div>

                    {/* Col 8: License Status (Clean dot indicator, no box) */}
                    <div className="flex items-center min-w-0 mt-1.5 lg:mt-0">
                      <LicenseTierBadge status={t.licenseStatus} />
                    </div>

                    {/* Col 9: Actions (Refined Grant License, Transfer & Open) */}
                    <div className="flex items-center justify-start lg:justify-end gap-1.5 min-w-0 mt-2.5 lg:mt-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTransferTarget(t);
                        }}
                        className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 gap-1 shrink-0"
                        title="Transfer tournament to another organiser"
                      >
                        <ArrowRightLeft className="h-3 w-3" />
                        <span className="hidden xl:inline">Transfer</span>
                      </Button>
                      {t.licenseStatus !== "active" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGrantTarget(t);
                            setGrantReason("Payment verified in bank statement");
                          }}
                          className="h-7 px-2 text-[11px] font-semibold border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/15 gap-1 shrink-0"
                          title="Grant Live License directly"
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>Grant</span>
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/tournaments/${t.id}`);
                        }}
                        className="h-7 px-2 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-0.5 shrink-0"
                      >
                        Open →
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AdminScrollPanel>
      </div>

      {/* DIRECT GRANT LIVE LICENSE DIALOG */}
      <Dialog
        open={Boolean(grantTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setGrantTarget(null);
            setGrantReason("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" /> Grant Live License
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Activate the full live license for{" "}
              <strong className="text-foreground">{grantTarget?.name}</strong>
              {grantTarget?.auctionCode ? (
                <span>
                  {" "}(Code: <span className="font-mono text-foreground font-semibold">{grantTarget.auctionCode}</span>)
                </span>
              ) : null}
              . This immediately lifts all player, squad, and bidding limits.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Quick Audit Reason Presets */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Quick Reason Presets:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {AUDIT_REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setGrantReason(preset)}
                    className={cn(
                      "text-[11px] rounded-md px-2 py-0.5 border transition-colors text-left",
                      grantReason === preset
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-medium"
                        : "bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:bg-muted/70"
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Audit Reason Text Area */}
            <AuditReasonField
              value={grantReason}
              onChange={setGrantReason}
              label="Administrative Audit Reason (Required)"
              placeholder="State the verification reason (e.g. UTR reference, payment mode, or approval notes)..."
            />
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setGrantTarget(null);
                setGrantReason("");
              }}
              disabled={grantLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={grantLoading || !isAuditReasonValid(grantReason)}
              onClick={handleGrantLicenseConfirm}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5"
            >
              {grantLoading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Granting…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Grant Live License
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {createOpen && (
          <CreateTournamentModal
            onClose={() => {
              setCreateOpen(false);
              if (window.location.pathname === "/admin/tournaments/new") navigate("/admin/tournaments");
            }}
            onCreated={load}
          />
        )}
      </AnimatePresence>

      {/* TRANSFER / REASSIGN ORGANISER DIALOG */}
      <TransferOrganizerDialog
        open={Boolean(transferTarget)}
        onOpenChange={(open) => {
          if (!open) setTransferTarget(null);
        }}
        tournament={transferTarget}
        onSuccess={(result) => {
          if (result.linkedOrganizerId) {
            showFlash(`Tournament transferred to organiser: ${result.linkedOrganizerName || `#${result.linkedOrganizerId}`}`);
          } else {
            showFlash("Organiser account unlinked from tournament");
          }
          load();
        }}
      />
    </AdminShell>
  );
}
