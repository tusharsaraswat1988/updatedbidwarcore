import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  BadgeCheck,
  Calendar,
  Check,
  CheckCircle2,
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
import { Badge } from "@/components/ui/badge";
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

function getSportTag(sportName?: string) {
  const s = (sportName || "general").toLowerCase();
  if (s.includes("badminton")) return { label: "Badminton", emoji: "🏸", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  if (s.includes("cricket")) return { label: "Cricket", emoji: "🏏", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
  if (s.includes("football") || s.includes("soccer")) return { label: "Football", emoji: "⚽", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
  if (s.includes("volleyball")) return { label: "Volleyball", emoji: "🏐", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" };
  if (s.includes("kabaddi")) return { label: "Kabaddi", emoji: "🤼", color: "bg-orange-500/15 text-orange-400 border-orange-500/30" };
  if (s.includes("esport") || s.includes("gaming")) return { label: "Esports", emoji: "🎮", color: "bg-pink-500/15 text-pink-400 border-pink-500/30" };
  return { label: sportName || "Sports", emoji: "🏆", color: "bg-primary/15 text-primary border-primary/30" };
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

function UnifiedTournamentStatus({
  status,
  adminLocked,
}: {
  status: string;
  adminLocked: boolean;
}) {
  if (adminLocked) {
    return (
      <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 gap-1 text-[11px] font-semibold">
        <Lock className="w-2.5 h-2.5" /> Locked
      </Badge>
    );
  }
  if (status === "active") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 gap-1.5 text-[11px] font-semibold">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Live
      </Badge>
    );
  }
  if (status === "completed") {
    return (
      <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[11px] font-semibold">
        Completed
      </Badge>
    );
  }
  return (
    <Badge className="bg-muted/40 text-muted-foreground border border-border text-[11px] font-semibold capitalize">
      {status || "Setup"}
    </Badge>
  );
}

function LicenseTierBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 gap-1 text-[11px] font-semibold">
        <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        Live License
      </Badge>
    );
  }
  if (status === "completed") {
    return (
      <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30 gap-1 text-[11px] font-semibold">
        <BadgeCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        Archived
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 gap-1 text-[11px] font-semibold">
      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
      Trial
    </Badge>
  );
}

type TournamentStatusFilter = "all" | "setup" | "active" | "completed" | "locked";
type LicenseStatusFilter = "all" | "trial" | "active";

const GRID_COLS = "lg:grid lg:grid-cols-[minmax(180px,1.6fr)_100px_105px_minmax(130px,1.2fr)_125px_95px_115px_minmax(130px,auto)] lg:items-center lg:gap-3";

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
            "mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium shadow-sm transition-all",
            flash.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          )}
        >
          {flash.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span>{flash.msg}</span>
          <button onClick={() => setFlash(null)} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card/70 shadow-sm overflow-hidden">
        {/* Top Search & Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border p-3 gap-3 bg-card/50">
          {/* Left: Compact Search Input */}
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

          {/* Right: Quick Action & Refresh */}
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

        {/* Separated Filter Rows: Tournament Status & License Status */}
        <div className="border-b border-border px-3 py-2.5 bg-muted/20 space-y-2 text-xs">
          {/* Row 1: Tournament Status Filter Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-muted-foreground mr-1 uppercase tracking-wider">
                Tournament:
              </span>
              <button
                onClick={() => setTournamentStatusFilter("all")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  tournamentStatusFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({tournamentCounts.all})
              </button>
              <button
                onClick={() => setTournamentStatusFilter("setup")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  tournamentStatusFilter === "setup"
                    ? "bg-slate-600 text-white shadow-xs"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                Setup ({tournamentCounts.setup})
              </button>
              <button
                onClick={() => setTournamentStatusFilter("active")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  tournamentStatusFilter === "active"
                    ? "bg-emerald-500 text-white shadow-xs"
                    : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                }`}
              >
                Live ({tournamentCounts.active})
              </button>
              <button
                onClick={() => setTournamentStatusFilter("completed")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  tournamentStatusFilter === "completed"
                    ? "bg-blue-500 text-white shadow-xs"
                    : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                }`}
              >
                Completed ({tournamentCounts.completed})
              </button>
              {tournamentCounts.locked > 0 && (
                <button
                  onClick={() => setTournamentStatusFilter("locked")}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                    tournamentStatusFilter === "locked"
                      ? "bg-red-500 text-white shadow-xs"
                      : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  }`}
                >
                  Locked ({tournamentCounts.locked})
                </button>
              )}
            </div>

            <div className="text-[11px] font-medium text-muted-foreground hidden sm:block">
              {filtered.length === tournaments.length
                ? `${tournaments.length} tournaments · Latest first`
                : `Showing ${filtered.length} of ${tournaments.length}`}
            </div>
          </div>

          {/* Row 2: License Status Filter Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-muted-foreground mr-1 uppercase tracking-wider">
                License:
              </span>
              <button
                onClick={() => setLicenseStatusFilter("all")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  licenseStatusFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                All Licenses ({licenseCounts.all})
              </button>
              <button
                onClick={() => setLicenseStatusFilter("trial")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  licenseStatusFilter === "trial"
                    ? "bg-amber-500 text-white shadow-xs"
                    : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                }`}
              >
                Trial ({licenseCounts.trial})
              </button>
              <button
                onClick={() => setLicenseStatusFilter("active")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  licenseStatusFilter === "active"
                    ? "bg-emerald-500 text-white shadow-xs"
                    : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                }`}
              >
                Live License ({licenseCounts.active})
              </button>
            </div>

            {isAnyFilterActive && (
              <button
                onClick={() => {
                  setTournamentStatusFilter("all");
                  setLicenseStatusFilter("all");
                  setSportFilter("all");
                  setSearch("");
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground underline decoration-dotted"
              >
                Reset all filters
              </button>
            )}
          </div>
        </div>

        {/* Table Header with strictly matched grid columns */}
        <AdminListHeader
          gridClassName={GRID_COLS}
          columns={[
            { label: "Tournament" },
            { label: "Sport" },
            { label: "Code" },
            { label: "Organiser" },
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
                    className={`block w-full border-b border-border p-3.5 text-left text-sm hover:bg-accent/40 transition-colors cursor-pointer ${GRID_COLS} lg:border-b-0`}
                  >
                    {/* Col 1: Tournament Info (Without ID number, clean title + linked badge) */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="font-bold text-foreground text-sm hover:text-primary transition-colors truncate max-w-[280px]"
                          title={t.name}
                        >
                          {t.name}
                        </span>
                        {t.organizerId ? (
                          <Badge className="h-4 bg-emerald-500/15 px-1.5 text-[9px] text-emerald-400 font-semibold gap-0.5">
                            <UserCheck className="h-2.5 w-2.5" /> Linked
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    {/* Col 2: Sport */}
                    <div className="min-w-0 mt-1.5 lg:mt-0">
                      <Badge variant="outline" className={`text-[10px] gap-1 px-1.5 py-0.5 font-medium ${sport.color}`}>
                        <span>{sport.emoji}</span>
                        <span>{sport.label}</span>
                      </Badge>
                    </div>

                    {/* Col 3: Tournament / Auction Code */}
                    <div className="min-w-0 mt-1.5 lg:mt-0 flex items-center gap-1">
                      {t.auctionCode ? (
                        <button
                          type="button"
                          onClick={(e) => handleCopyCode(e, t.auctionCode!)}
                          title="Click to copy tournament code"
                          className="inline-flex items-center gap-1 rounded bg-muted/60 hover:bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground/90 transition-colors border border-border/60 group"
                        >
                          <span>{t.auctionCode}</span>
                          {copiedCode === t.auctionCode ? (
                            <Check className="h-2.5 w-2.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-2.5 w-2.5 text-muted-foreground opacity-60 group-hover:opacity-100" />
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 font-mono">—</span>
                      )}
                    </div>

                    {/* Col 4: Organiser */}
                    <div className="min-w-0 mt-1.5 lg:mt-0">
                      <span className="block truncate text-xs font-medium text-foreground/90">
                        {t.organizerName || <span className="text-muted-foreground italic">Unlinked Host</span>}
                      </span>
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

                    {/* Col 5: Schedule */}
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 lg:mt-0">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 hidden lg:inline" />
                      <span className="truncate">{formatSchedule(t.auctionDate, t.auctionTime)}</span>
                    </div>

                    {/* Col 6: Tournament Status */}
                    <div className="mt-1.5 flex items-center gap-2 lg:mt-0">
                      <UnifiedTournamentStatus status={t.status} adminLocked={t.adminLocked} />
                    </div>

                    {/* Col 7: License Status */}
                    <div className="mt-1.5 flex items-center gap-1.5 min-w-0 lg:mt-0">
                      <LicenseTierBadge status={t.licenseStatus} />
                    </div>

                    {/* Col 8: Actions (Grant License & Open) */}
                    <div className="mt-2.5 flex items-center justify-start lg:justify-end gap-1.5 lg:mt-0">
                      {t.licenseStatus !== "active" && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGrantTarget(t);
                            setGrantReason("Payment verified in bank statement");
                          }}
                          className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] gap-1 shrink-0 shadow-xs"
                          title="Grant Live License directly"
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>Grant License</span>
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
              <BadgeCheck className="h-5 w-5" /> Grant Live License
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
    </AdminShell>
  );
}
