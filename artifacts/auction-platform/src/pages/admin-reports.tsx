import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-auth";
import { listAdminTournaments, AdminTournamentRow } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { motion } from "framer-motion";
import {
  ShieldCheck, FileText, FileSpreadsheet, FileType, Download, RefreshCw,
  Search, Users, TrendingUp, Wallet, Award, Phone, MapPin, Trophy, Filter,
  ChevronLeft, ListChecks, FileBarChart, Table2, BadgeCheck, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const API = "/api";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${r.status})`);
  }
  return r.json();
}

type ReportType = {
  id: string;
  title: string;
  description: string;
  category: "pre" | "live" | "post" | "directory";
};

type ReportContext = {
  tournament: { id: number; name: string; sport: string };
  teams: { id: number; name: string; shortCode: string; color: string | null }[];
  categories: { id: number; name: string; colorCode: string | null }[];
  roles: string[];
  cities: string[];
  playerCount: number;
};

type Filters = {
  categoryIds?: number[];
  teamIds?: number[];
  statuses?: string[];
  roles?: string[];
  city?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
};

type Column = { key: string; label: string; width?: number };
type Section = { heading?: string; columns: Column[]; rows: Record<string, unknown>[] };
type ReportData = {
  reportTitle: string;
  tournamentName: string;
  tournamentSport: string;
  generatedAt: string;
  filtersApplied: string[];
  summary?: { label: string; value: string }[];
  sections: Section[];
};

const STATUSES = ["available", "sold", "unsold", "retained"] as const;

const CATEGORY_META: Record<ReportType["category"], { label: string; color: string; icon: typeof FileText }> = {
  pre: { label: "Pre-Auction", color: "text-blue-400 border-blue-500/30 bg-blue-500/10", icon: ListChecks },
  live: { label: "Live Auction", color: "text-amber-400 border-amber-500/30 bg-amber-500/10", icon: TrendingUp },
  post: { label: "Post-Auction", color: "text-green-400 border-green-500/30 bg-green-500/10", icon: Trophy },
  directory: { label: "Directory", color: "text-purple-400 border-purple-500/30 bg-purple-500/10", icon: Phone },
};

const REPORT_ICON: Record<string, typeof FileText> = {
  master_catalogue: Users,
  category_wise: ListChecks,
  city_wise: MapPin,
  contact_directory: Phone,
  sold_players: BadgeCheck,
  unsold_players: X,
  top_sold: Award,
  team_squad: Trophy,
  team_purse: Wallet,
  financial_summary: FileBarChart,
};

export default function AdminReports() {
  const { isLoading, isLoggedIn: isAdmin } = useAdminAuth();
  const [, navigate] = useLocation();
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [reportTypes, setReportTypes] = useState<ReportType[]>([]);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [ctx, setCtx] = useState<ReportContext | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [data, setData] = useState<ReportData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | "csv" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Auth gate
  useEffect(() => {
    if (!isLoading && !isAdmin) navigate("/admin/login");
  }, [isLoading, isAdmin, navigate]);

  // Load tournaments + report types on mount
  useEffect(() => {
    let cancel = false;
    async function load() {
      try {
        const [t, types] = await Promise.all([
          listAdminTournaments(),
          api<{ reports: ReportType[] }>("/auth/admin/reports/types"),
        ]);
        if (cancel) return;
        setTournaments(t);
        setReportTypes(types.reports);
        if (t.length && tournamentId === null) setTournamentId(t[0].id);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "Failed to load");
      }
    }
    if (isAdmin) load();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Load context whenever tournament changes
  useEffect(() => {
    if (!tournamentId) { setCtx(null); return; }
    let cancel = false;
    async function load() {
      try {
        const c = await api<ReportContext>(`/auth/admin/reports/${tournamentId}/context`);
        if (!cancel) { setCtx(c); setFilters({}); setData(null); }
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "Failed to load context");
      }
    }
    load();
    return () => { cancel = true; };
  }, [tournamentId]);

  const runPreview = useCallback(async () => {
    if (!tournamentId || !activeReport) return;
    setLoadingPreview(true);
    setError(null);
    try {
      const d = await api<ReportData>(`/auth/admin/reports/${tournamentId}/preview`, {
        method: "POST",
        body: JSON.stringify({ type: activeReport, filters }),
      });
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoadingPreview(false);
    }
  }, [tournamentId, activeReport, filters]);

  // Auto-preview when report selected or filters change
  useEffect(() => { if (activeReport && tournamentId) runPreview(); }, [activeReport, tournamentId, runPreview]);

  async function runExport(format: "pdf" | "xlsx" | "csv") {
    if (!tournamentId || !activeReport) return;
    setExporting(format);
    setError(null);
    try {
      const r = await fetch(`${API}/auth/admin/reports/${tournamentId}/export`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: activeReport, filters, format }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `Export failed (${r.status})`);
      }
      const blob = await r.blob();
      const cd = r.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="?([^"]+)"?/);
      const filename = m?.[1] || `report.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  const grouped = useMemo(() => {
    const filtered = reportTypes.filter(r =>
      !search.trim() ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase()),
    );
    const out: Record<ReportType["category"], ReportType[]> = { pre: [], live: [], post: [], directory: [] };
    for (const r of filtered) out[r.category].push(r);
    return out;
  }, [reportTypes, search]);

  if (isLoading) {
    return (
      <AdminShell title="Report Center" eyebrow="Platform Settings">
        <div className="flex h-48 items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AdminShell>
    );
  }

  if (!isAdmin) return null;

  return (
    <AdminShell
      title="Report Center"
      eyebrow="Platform Settings"
      actions={
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Tournament</Label>
          <Select value={tournamentId ? String(tournamentId) : ""} onValueChange={v => setTournamentId(parseInt(v))}>
            <SelectTrigger className="h-8 w-72 text-sm"><SelectValue placeholder="Select tournament..." /></SelectTrigger>
            <SelectContent>
              {tournaments.map(t => (
                <SelectItem key={t.id} value={String(t.id)}>
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] uppercase text-muted-foreground">{t.sport}</span>
                    <span>{t.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="flex min-h-[calc(100vh-240px)] flex-col overflow-hidden rounded-xl border border-border bg-card/70">
        <div className="flex min-h-0 flex-1">
          {/* Left sidebar - report list */}
          <aside className="w-72 border-r border-border/40 flex flex-col flex-shrink-0 bg-muted/10">
            <div className="p-3 border-b border-border/40 flex-shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search reports..." className="h-8 pl-8 text-sm"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-4">
                {(Object.keys(grouped) as ReportType["category"][]).map(cat => {
                  const items = grouped[cat];
                  if (!items.length) return null;
                  const meta = CATEGORY_META[cat];
                  const Icon = meta.icon;
                  return (
                    <div key={cat}>
                      <div className="flex items-center gap-1.5 px-1 mb-1.5">
                        <Icon className="w-3 h-3 text-muted-foreground" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{meta.label}</p>
                      </div>
                      <div className="space-y-1">
                        {items.map(r => {
                          const RIcon = REPORT_ICON[r.id] ?? FileText;
                          const active = activeReport === r.id;
                          return (
                            <button
                              key={r.id}
                              onClick={() => setActiveReport(r.id)}
                              className={`w-full text-left rounded-md p-2 transition border ${
                                active
                                  ? "bg-primary/15 border-primary/40"
                                  : "border-transparent hover:bg-muted/40"
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <RIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                                <div className="min-w-0">
                                  <p className={`text-xs font-semibold leading-tight ${active ? "text-primary" : "text-foreground"}`}>{r.title}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{r.description}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </aside>

          {/* Main content */}
          <main className="flex-1 flex flex-col min-w-0">
            {!activeReport ? (
              <EmptyState />
            ) : (
              <>
                {/* Filter bar */}
                <FilterBar ctx={ctx} filters={filters} setFilters={setFilters} onRun={runPreview} loading={loadingPreview} />

                {/* Action bar */}
                <div className="px-5 py-2.5 border-b border-border/40 flex items-center gap-2 flex-shrink-0 bg-muted/10">
                  <p className="text-xs text-muted-foreground">
                    {data ? `${data.sections.reduce((s, x) => s + x.rows.length, 0)} rows in ${data.sections.length} section(s)` : "Loading..."}
                  </p>
                  <div className="ml-auto flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={!data || exporting !== null} onClick={() => runExport("pdf")}>
                      {exporting === "pdf" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileType className="w-3.5 h-3.5" />}
                      PDF
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={!data || exporting !== null} onClick={() => runExport("xlsx")}>
                      {exporting === "xlsx" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                      Excel
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={!data || exporting !== null} onClick={() => runExport("csv")}>
                      {exporting === "csv" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                      CSV
                    </Button>
                  </div>
                </div>

                {error && (
                  <div className="mx-5 mt-3 rounded px-3 py-2 text-sm bg-destructive/10 text-destructive flex-shrink-0">{error}</div>
                )}

                <ScrollArea className="flex-1">
                  <div className="p-5 space-y-5">
                    {loadingPreview && !data && (
                      <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                      </div>
                    )}
                    {data && (
                      <>
                        {/* Summary cards */}
                        {data.summary && data.summary.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {data.summary.map((s, i) => (
                              <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                                <Card className="p-3 bg-card border-border/50">
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</p>
                                  <p className="text-xl font-bold font-display mt-1">{s.value}</p>
                                </Card>
                              </motion.div>
                            ))}
                          </div>
                        )}

                        {data.filtersApplied.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                            {data.filtersApplied.map(f => (
                              <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>
                            ))}
                          </div>
                        )}

                        {/* Sections */}
                        {data.sections.map((section, i) => (
                          <SectionTable key={i} section={section} />
                        ))}
                        {data.sections.every(s => s.rows.length === 0) && (
                          <div className="text-center py-12 text-muted-foreground">
                            <Table2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">No data matches the current filters.</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </main>
        </div>
      </div>
    </AdminShell>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <ShieldCheck className="w-12 h-12 text-primary mx-auto mb-3 opacity-50" />
        <h2 className="font-display font-bold text-xl mb-1">Select a Report</h2>
        <p className="text-sm text-muted-foreground max-w-sm">Pick a report from the left sidebar. Apply filters, preview the data, and export to PDF, Excel or CSV.</p>
      </div>
    </div>
  );
}

function SectionTable({ section }: { section: Section }) {
  if (!section.rows.length) {
    if (!section.heading) return null;
    return (
      <div>
        <p className="font-display font-semibold text-sm mb-1.5">{section.heading}</p>
        <p className="text-xs text-muted-foreground italic">No rows</p>
      </div>
    );
  }
  return (
    <div>
      {section.heading && <p className="font-display font-semibold text-sm mb-2">{section.heading}</p>}
      <div className="border border-border/50 rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 border-b border-border/50">
              <tr>
                <th className="text-left px-2.5 py-2 font-semibold text-muted-foreground w-10">#</th>
                {section.columns.map(c => (
                  <th key={c.key} className="text-left px-2.5 py-2 font-semibold text-muted-foreground whitespace-nowrap">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.slice(0, 200).map((row, i) => (
                <tr key={i} className={`border-b border-border/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                  <td className="px-2.5 py-1.5 text-muted-foreground">{i + 1}</td>
                  {section.columns.map(c => (
                    <td key={c.key} className="px-2.5 py-1.5 whitespace-nowrap">{renderCell(row, c.key)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {section.rows.length > 200 && (
          <div className="text-[11px] text-muted-foreground bg-muted/30 px-3 py-1.5 border-t border-border/30">
            Showing first 200 of {section.rows.length} rows. Export to see all.
          </div>
        )}
      </div>
    </div>
  );
}

function renderCell(row: Record<string, unknown>, key: string) {
  const v = row[key];
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">-</span>;
  if (typeof v === "number") {
    if (key.toLowerCase().includes("price") || key === "purse" || key === "purseUsed" || key === "purseRemaining") {
      return formatShortRupee(v);
    }
    if (key === "utilization") return `${v.toFixed(1)}%`;
    return String(v);
  }
  if (key === "status") {
    const s = String(v).toLowerCase();
    const cls =
      s === "sold" ? "bg-green-500/15 text-green-400 border-green-500/30"
      : s === "unsold" ? "bg-red-500/15 text-red-400 border-red-500/30"
      : s === "retained" ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
      : "bg-muted/30 text-muted-foreground";
    return <Badge className={`text-[9px] uppercase ${cls}`}>{s}</Badge>;
  }
  return String(v);
}

function formatShortRupee(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)} K`;
  return `₹${n}`;
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar({
  ctx, filters, setFilters, onRun, loading,
}: {
  ctx: ReportContext | null; filters: Filters;
  setFilters: (f: Filters | ((prev: Filters) => Filters)) => void;
  onRun: () => void; loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!ctx) {
    return (
      <div className="px-5 py-3 border-b border-border/40 flex-shrink-0">
        <Skeleton className="h-8 w-64" />
      </div>
    );
  }
  function toggle<T>(key: keyof Filters, value: T, current: T[] | undefined) {
    const list = current ?? [];
    const next = list.includes(value) ? list.filter(x => x !== value) : [...list, value];
    setFilters(prev => ({ ...prev, [key]: next.length ? next : undefined }));
  }
  const activeCount = (
    (filters.categoryIds?.length ?? 0) +
    (filters.teamIds?.length ?? 0) +
    (filters.statuses?.length ?? 0) +
    (filters.roles?.length ?? 0) +
    (filters.city ? 1 : 0) +
    (filters.search ? 1 : 0) +
    (filters.minPrice !== undefined ? 1 : 0) +
    (filters.maxPrice !== undefined ? 1 : 0)
  );
  return (
    <div className="border-b border-border/40 flex-shrink-0 bg-card/30">
      <div className="px-5 py-2.5 flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setOpen(o => !o)}>
          <Filter className="w-3.5 h-3.5" /> Filters
          {activeCount > 0 && <Badge className="ml-1 h-4 px-1.5 text-[10px] bg-primary/20 text-primary">{activeCount}</Badge>}
        </Button>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            value={filters.search ?? ""}
            onChange={e => setFilters(p => ({ ...p, search: e.target.value || undefined }))}
            placeholder="Search by player name..."
            className="h-8 w-64 pl-8 text-sm"
          />
        </div>
        {activeCount > 0 && (
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => setFilters({})}>
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
        <Button size="sm" className="h-8 gap-1.5 ml-auto" onClick={onRun} disabled={loading}>
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </Button>
      </div>
      {open && (
        <div className="px-5 pb-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <FilterMulti
            label="Categories"
            options={ctx.categories.map(c => ({ id: c.id, label: c.name }))}
            selected={filters.categoryIds ?? []}
            onToggle={id => toggle("categoryIds", id, filters.categoryIds)}
          />
          <FilterMulti
            label="Teams"
            options={ctx.teams.map(t => ({ id: t.id, label: t.name }))}
            selected={filters.teamIds ?? []}
            onToggle={id => toggle("teamIds", id, filters.teamIds)}
          />
          <FilterMultiText
            label="Status"
            options={STATUSES.map(s => ({ id: s, label: s.toUpperCase() }))}
            selected={filters.statuses ?? []}
            onToggle={s => toggle("statuses", s, filters.statuses)}
          />
          <FilterMultiText
            label="Role"
            options={ctx.roles.map(r => ({ id: r, label: r.replace(/_/g, " ") }))}
            selected={filters.roles ?? []}
            onToggle={r => toggle("roles", r, filters.roles)}
          />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">City contains</Label>
            <Input
              value={filters.city ?? ""}
              onChange={e => setFilters(p => ({ ...p, city: e.target.value || undefined }))}
              className="h-8 text-sm" placeholder="e.g. Mumbai"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Min sold price (₹)</Label>
            <Input type="number"
              value={filters.minPrice ?? ""}
              onChange={e => setFilters(p => ({ ...p, minPrice: e.target.value ? Number(e.target.value) : undefined }))}
              className="h-8 text-sm" placeholder="e.g. 100000"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Max sold price (₹)</Label>
            <Input type="number"
              value={filters.maxPrice ?? ""}
              onChange={e => setFilters(p => ({ ...p, maxPrice: e.target.value ? Number(e.target.value) : undefined }))}
              className="h-8 text-sm" placeholder="e.g. 5000000"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FilterMulti({
  label, options, selected, onToggle,
}: {
  label: string;
  options: { id: number; label: string }[];
  selected: number[];
  onToggle: (id: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="border border-border/50 rounded p-2 max-h-32 overflow-y-auto space-y-1 bg-background">
        {options.length === 0 && <p className="text-[11px] text-muted-foreground">None</p>}
        {options.map(o => (
          <label key={o.id} className="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox checked={selected.includes(o.id)} onCheckedChange={() => onToggle(o.id)} />
            <span className="truncate">{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function FilterMultiText({
  label, options, selected, onToggle,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="border border-border/50 rounded p-2 max-h-32 overflow-y-auto space-y-1 bg-background">
        {options.length === 0 && <p className="text-[11px] text-muted-foreground">None</p>}
        {options.map(o => (
          <label key={o.id} className="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox checked={selected.includes(o.id)} onCheckedChange={() => onToggle(o.id)} />
            <span className="truncate">{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
