import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  BadgeCheck,
  Calendar,
  Lock,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Trophy,
  UserCheck,
  X,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminScrollPanel } from "@/components/admin/admin-scroll-panel";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AdminTournamentRow,
  listAdminTournaments,
} from "@/lib/auth";
import {
  CreateTournamentModal,
  LicenseBadge,
  LockBadge,
  StatusBadge,
} from "@/pages/admin";

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

type FilterStatus = "all" | "active" | "trial" | "completed" | "locked";

const GRID_COLS = "md:grid md:grid-cols-[minmax(240px,2fr)_minmax(160px,1.2fr)_110px_110px_130px_90px] md:items-center md:gap-4";

export default function AdminTournamentsListPage() {
  const [, navigate] = useLocation();
  const { isLoggedIn, isLoading: authLoading } = useAdminPageGuard();
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

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

  const counts = useMemo(() => {
    let active = 0;
    let trial = 0;
    let completed = 0;
    let locked = 0;
    for (const t of tournaments) {
      if (t.adminLocked) locked += 1;
      if (t.licenseStatus === "active" || t.status === "active") active += 1;
      else if (t.licenseStatus === "trial") trial += 1;
      else if (t.licenseStatus === "completed" || t.status === "completed") completed += 1;
    }
    return { active, trial, completed, locked };
  }, [tournaments]);

  const filtered = useMemo(() => {
    return tournaments.filter((t) => {
      // Status filter
      if (statusFilter === "locked" && !t.adminLocked) return false;
      if (statusFilter === "active" && (t.status !== "active" && t.licenseStatus !== "active")) return false;
      if (statusFilter === "trial" && t.licenseStatus !== "trial") return false;
      if (statusFilter === "completed" && (t.licenseStatus !== "completed" && t.status !== "completed")) return false;

      // Sport filter
      if (sportFilter !== "all" && (t.sport || "").toLowerCase() !== sportFilter) return false;

      // Search query
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        String(t.id).includes(q) ||
        (t.sport && t.sport.toLowerCase().includes(q)) ||
        (t.organizerMobile && t.organizerMobile.toLowerCase().includes(q)) ||
        (t.organizerEmail && t.organizerEmail.toLowerCase().includes(q)) ||
        (t.organizerName && t.organizerName.toLowerCase().includes(q))
      );
    });
  }, [tournaments, search, statusFilter, sportFilter]);

  if (authLoading || !isLoggedIn) return null;

  return (
    <AdminShell
      title="Tournaments"
      eyebrow="Tournament & Organisers"
      actions={
        <Button size="sm" className="gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 font-semibold text-white shadow-sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Tournament
        </Button>
      }
    >
      <div className="rounded-xl border border-border bg-card/70 shadow-sm overflow-hidden">
        {/* Top Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border p-3 gap-3 bg-card/50">
          {/* Left: Compact Search Input */}
          <div className="relative w-full sm:w-72 flex-shrink-0">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tournament, ID, sport..."
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
            {/* Sport Filter Dropdown */}
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

        {/* Filter Chips Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-border px-3 py-2 gap-2 bg-muted/20 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setStatusFilter("all")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                statusFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({tournaments.length})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                statusFilter === "active"
                  ? "bg-emerald-500 text-white shadow-xs"
                  : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
              }`}
            >
              Active / Live ({counts.active})
            </button>
            <button
              onClick={() => setStatusFilter("trial")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                statusFilter === "trial"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
              }`}
            >
              Trial ({counts.trial})
            </button>
            <button
              onClick={() => setStatusFilter("completed")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                statusFilter === "completed"
                  ? "bg-sky-500 text-white shadow-xs"
                  : "bg-sky-500/10 text-sky-400 hover:bg-sky-500/20"
              }`}
            >
              Completed ({counts.completed})
            </button>
            {counts.locked > 0 && (
              <button
                onClick={() => setStatusFilter("locked")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  statusFilter === "locked"
                    ? "bg-red-500 text-white shadow-xs"
                    : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                }`}
              >
                Locked ({counts.locked})
              </button>
            )}
          </div>

          <div className="text-[11px] font-medium text-muted-foreground">
            Showing <span className="text-foreground font-bold">{filtered.length}</span> of {tournaments.length} tournaments · Sorted latest first
          </div>
        </div>

        {/* Table Header with strictly matched grid columns */}
        <AdminListHeader
          gridClassName={GRID_COLS}
          columns={[
            { label: "Tournament" },
            { label: "Organiser" },
            { label: "Status" },
            { label: "License" },
            { label: "Auction Date" },
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
                {search || statusFilter !== "all" || sportFilter !== "all"
                  ? "No tournaments match your search and filter criteria."
                  : "No tournaments registered yet."}
              </span>
              {!search && statusFilter === "all" && sportFilter === "all" ? (
                <Button size="sm" onClick={() => setCreateOpen(true)} className="mt-3 gap-1">
                  <Plus className="h-3.5 w-3.5" /> Create tournament
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
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
                return (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/admin/tournaments/${t.id}`)}
                    className={`block w-full border-b border-border px-4 py-3 text-left text-sm hover:bg-accent/40 transition-colors ${GRID_COLS} md:border-b-0`}
                  >
                    {/* Col 1: Tournament Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-foreground text-sm hover:text-primary transition-colors">
                          {t.name}
                        </span>
                        <Badge variant="outline" className={`text-[10px] gap-1 px-1.5 py-0 ${sport.color}`}>
                          <span>{sport.emoji}</span>
                          <span>{sport.label}</span>
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>ID #{t.id}</span>
                        {t.organizerId ? (
                          <Badge className="h-4 bg-emerald-500/15 px-1.5 text-[9px] text-emerald-400 font-semibold gap-0.5">
                            <UserCheck className="h-2.5 w-2.5" /> Linked
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    {/* Col 2: Organiser */}
                    <div className="min-w-0 mt-1 md:mt-0">
                      <span className="block truncate text-xs font-medium text-foreground/90">
                        {t.organizerName || <span className="text-muted-foreground italic">Unlinked Organiser</span>}
                      </span>
                      {t.organizerMobile && (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {t.organizerMobile}
                        </span>
                      )}
                    </div>

                    {/* Col 3: Status */}
                    <div className="mt-1.5 flex items-center gap-2 md:mt-0">
                      <StatusBadge status={t.status} />
                    </div>

                    {/* Col 4: License */}
                    <div className="mt-1.5 flex items-center gap-1.5 md:mt-0">
                      <LicenseBadge status={t.licenseStatus} />
                      {t.adminLocked && <LockBadge locked />}
                    </div>

                    {/* Col 5: Auction Date */}
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground md:mt-0">
                      <Calendar className="h-3 w-3 text-muted-foreground/60 hidden md:inline" />
                      <span>{t.auctionDate ? `${t.auctionDate}${t.auctionTime ? ` (${t.auctionTime})` : ''}` : "Not scheduled"}</span>
                    </div>

                    {/* Col 6: Action */}
                    <div className="mt-2 text-xs font-bold text-primary md:mt-0 md:text-right">
                      <span className="rounded-md bg-primary/10 px-2 py-1 hover:bg-primary/20 transition-colors">
                        Open →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </AdminScrollPanel>
      </div>

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
