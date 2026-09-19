import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-auth";
import { listAdminTournaments, AdminTournamentRow } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { motion } from "framer-motion";
import {
  ShieldCheck, FileText, FileSpreadsheet, FileType, Printer, RefreshCw,
  Search, Users, TrendingUp, Wallet, Award, Phone, MapPin, Trophy, Filter,
  ListChecks, FileBarChart, Table2, BadgeCheck, X, ChevronDown, Check,
  Crown, Sparkles, ImageDown, User, Flame, LayoutGrid, TableProperties, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { IndianAmountHint } from "@/components/ui/indian-amount-hint";
import { ADMIN_FLEX_SCROLL_CLASS } from "@/components/admin/admin-scroll-panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cldUrl } from "@/lib/cloudinary";
import { useBranding } from "@/hooks/use-branding";
import { getObsBroadcastLogoSrc, getObsBrandMarkSrc, OBS_BROADCAST_LOGO_FALLBACK } from "@/lib/brand-assets";
import { formatAuctionAmount, type AuctionUnit } from "@/lib/format";

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
  tournament: { id: number; name: string; sport: string; auctionUnit?: "rupee" | "points" };
  teams: { id: number; name: string; shortCode: string; color: string | null }[];
  categories: { id: number; name: string; colorCode: string | null }[];
  roles: string[];
  cities: string[];
  jerseySizes: string[];
  jerseySizeOptions: string[];
  playerCount: number;
};

type Filters = {
  categoryIds?: number[];
  teamIds?: number[];
  statuses?: string[];
  roles?: string[];
  city?: string;
  jerseySizes?: string[];
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
  auctionUnit?: "rupee" | "points";
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
  top_5_showcase: Crown,
  team_showcase: Sparkles,
  master_catalogue: Users,
  jersey_sizing: Users,
  contact_directory: Phone,
  sold_players: BadgeCheck,
  unsold_players: X,
  top_sold: Award,
  team_purse: Wallet,
};

export default function AdminReports() {
  const { isLoading, isLoggedIn: isAdmin } = useAdminAuth();
  const [, navigate] = useLocation();
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [reportTypes, setReportTypes] = useState<ReportType[]>([]);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"visual" | "table">("visual");
  const [ctx, setCtx] = useState<ReportContext | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [data, setData] = useState<ReportData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | "csv" | null>(null);
  const [exportingImage, setExportingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const printAreaRef = useRef<HTMLDivElement | null>(null);

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
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "Failed to load");
      }
    }
    if (isAdmin) load();
    return () => { cancel = true; };
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

  // Auto-preview when report selected, tournament changes, or filters change (debounced)
  useEffect(() => {
    if (!activeReport || !tournamentId) return;
    const timer = setTimeout(() => {
      runPreview();
    }, 150);
    return () => clearTimeout(timer);
  }, [activeReport, tournamentId, filters, runPreview]);

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

  function handlePrint() {
    window.print();
  }

  async function downloadPosterAsPng() {
    if (!printAreaRef.current || !data) return;
    setExportingImage(true);
    setError(null);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const element = printAreaRef.current;
      await document.fonts.ready;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#030712",
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      const safeTitle = (data.reportTitle || "showcase").toLowerCase().replace(/[^a-z0-9]/g, "_");
      const safeTournament = (data.tournamentName || "tournament").toLowerCase().replace(/[^a-z0-9]/g, "_");
      a.download = `${safeTournament}_${safeTitle}.png`;
      a.href = url;
      a.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export image");
    } finally {
      setExportingImage(false);
    }
  }

  const selectedTournament = useMemo(() => {
    return tournaments.find(t => t.id === tournamentId) || null;
  }, [tournaments, tournamentId]);

  const currentReportMeta = useMemo(() => {
    return reportTypes.find(r => r.id === activeReport) || null;
  }, [reportTypes, activeReport]);

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
    <AdminShell title="Report Center" eyebrow="Platform Settings">
      {/* Print-only CSS stylesheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-report-area, #printable-report-area * {
            visibility: visible;
          }
          #printable-report-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            padding: 20px !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            background: #f8fafc !important;
            border: 1px solid #cbd5e1 !important;
            color: #0f172a !important;
            box-shadow: none !important;
          }
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            color: #0f172a !important;
          }
          .print-table th {
            background-color: #1e293b !important;
            color: #fbbf24 !important;
            font-size: 9pt !important;
            padding: 6px 8px !important;
            border: 1px solid #94a3b8 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-table td {
            font-size: 8.5pt !important;
            padding: 4px 6px !important;
            border: 1px solid #cbd5e1 !important;
            color: #0f172a !important;
          }
          .print-table tr:nth-child(even) td {
            background-color: #f1f5f9 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          thead {
            display: table-header-group;
          }
          tr {
            page-break-inside: avoid;
          }
          @page {
            size: A4 landscape;
            margin: 12mm 10mm;
          }
        }
      `}</style>

      <div className="flex h-auto lg:h-[calc(100vh-190px)] lg:max-h-[calc(100vh-190px)] min-h-[550px] flex-col lg:flex-row overflow-hidden rounded-xl border border-border bg-card/70 shadow-sm">
        {/* Left sidebar - Tournament Selection & Report List */}
        <aside className="no-print w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border/50 flex flex-col flex-shrink-0 bg-muted/20 max-h-[320px] lg:max-h-none h-auto lg:h-full overflow-hidden">
            {/* Step 1: Prominent Tournament Selector Card */}
            <div className="p-3.5 border-b border-border/50 bg-background/60">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-primary" /> Active Tournament
                </span>
                {ctx && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                    {ctx.playerCount} Players
                  </Badge>
                )}
              </div>
              
              <Select value={tournamentId ? String(tournamentId) : ""} onValueChange={v => {
                const id = parseInt(v);
                setTournamentId(id);
                if (!activeReport && reportTypes.length) {
                  setActiveReport(reportTypes[0].id);
                }
              }}>
                <SelectTrigger className="w-full text-left bg-background border-border/80 h-10 px-3 shadow-sm hover:border-primary/50 transition">
                  <SelectValue placeholder="Select tournament...">
                    {selectedTournament && (
                      <div className="flex items-center gap-2 truncate text-xs font-semibold">
                        <Badge variant="outline" className="text-[9px] uppercase px-1 py-0 bg-primary/10 text-primary border-primary/30">
                          {selectedTournament.sport}
                        </Badge>
                        <span className="truncate">{selectedTournament.name}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {tournaments.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      <div className="flex items-center gap-2 py-0.5">
                        <Badge variant="outline" className="text-[9px] uppercase font-mono px-1 py-0 text-muted-foreground">
                          {t.sport}
                        </Badge>
                        <span className="font-medium text-xs truncate">{t.name}</span>
                        {t.id === tournamentId && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: Search Report Catalogue */}
            <div className="p-3 border-b border-border/40 flex-shrink-0 bg-muted/10">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search reports..."
                  className="h-8 pl-8 text-xs bg-background"
                />
              </div>
            </div>

            {/* Reports Grouped Tree */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div className="p-3 space-y-4">
                {(Object.keys(grouped) as ReportType["category"][]).map(cat => {
                  const items = grouped[cat];
                  if (!items.length) return null;
                  const meta = CATEGORY_META[cat];
                  const Icon = meta.icon;
                  return (
                    <div key={cat}>
                      <div className="flex items-center gap-1.5 px-1 mb-1.5">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{meta.label}</p>
                      </div>
                      <div className="space-y-1">
                        {items.map(r => {
                          const RIcon = REPORT_ICON[r.id] ?? FileText;
                          const active = activeReport === r.id;
                          return (
                            <button
                              key={r.id}
                              onClick={() => setActiveReport(r.id)}
                              className={`w-full text-left rounded-lg p-2.5 transition border ${
                                active
                                  ? "bg-primary/15 border-primary/50 shadow-sm ring-1 ring-primary/30"
                                  : "border-transparent hover:bg-muted/50 hover:border-border/40"
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <div className={`p-1.5 rounded-md mt-0.5 ${active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                                  <RIcon className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={`text-xs font-semibold leading-tight ${active ? "text-primary font-bold" : "text-foreground"}`}>
                                    {r.title}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                                    {r.description}
                                  </p>
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
            </div>
          </aside>

          {/* Main content Area */}
          <main className="flex-1 flex flex-col min-w-0 bg-background/50 h-full overflow-hidden">
            {!tournamentId ? (
              <NoTournamentState />
            ) : !activeReport ? (
              <EmptyState />
            ) : (
              <>
                {/* Active Context Bar */}
                <div className="no-print px-5 py-3 border-b border-border/50 bg-card/40 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary border-primary/30">
                      {selectedTournament?.sport || "Sport"}
                    </Badge>
                    <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">/</span>
                    <h2 className="text-sm font-bold text-foreground truncate max-w-xs sm:max-w-md">
                      {selectedTournament?.name || "Tournament"}
                    </h2>
                    <span className="text-xs font-semibold text-muted-foreground">→</span>
                    <Badge variant="secondary" className="text-xs font-bold text-foreground">
                      {currentReportMeta?.title || "Report"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    {data && (
                      <span className="text-[11px] text-muted-foreground hidden md:inline">
                        Generated: {new Date(data.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Filter bar */}
                <div className="no-print">
                  <FilterBar ctx={ctx} filters={filters} setFilters={setFilters} onRun={runPreview} loading={loadingPreview} />
                </div>

                {/* Action bar: Print, Save PNG, PDF, Excel, CSV */}
                <div className="no-print px-5 py-2.5 border-b border-border/50 flex items-center justify-between gap-3 flex-wrap bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-normal">
                      {data ? `${data.sections.reduce((s, x) => s + x.rows.length, 0)} rows in ${data.sections.length} section(s)` : "Loading..."}
                    </Badge>

                    {(activeReport === "top_5_showcase" || activeReport === "team_showcase") && (
                      <div className="flex items-center border border-border/80 rounded-lg p-0.5 bg-background shadow-sm ml-2">
                        <Button
                          size="sm"
                          variant={viewMode === "visual" ? "secondary" : "ghost"}
                          className="h-6 px-2 text-[11px] gap-1 font-semibold"
                          onClick={() => setViewMode("visual")}
                        >
                          <LayoutGrid className="w-3 h-3" />
                          Poster View
                        </Button>
                        <Button
                          size="sm"
                          variant={viewMode === "table" ? "secondary" : "ghost"}
                          className="h-6 px-2 text-[11px] gap-1 font-semibold"
                          onClick={() => setViewMode("table")}
                        >
                          <TableProperties className="w-3 h-3" />
                          Table View
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 📸 Download Poster as High-Res PNG Image (Social sharing) */}
                    {(activeReport === "top_5_showcase" || activeReport === "team_showcase") && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-sm"
                        disabled={!data || loadingPreview || exportingImage}
                        onClick={downloadPosterAsPng}
                      >
                        {exportingImage ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                        ) : (
                          <ImageDown className="w-3.5 h-3.5" />
                        )}
                        Save Poster (PNG)
                      </Button>
                    )}

                    {/* 🖨️ Direct Print Report */}
                    <Button
                      size="sm"
                      variant="default"
                      className="h-8 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm"
                      disabled={!data || loadingPreview}
                      onClick={handlePrint}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Report
                    </Button>

                    {/* 📄 PDF Download */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 font-medium border-border/70 hover:bg-muted"
                      disabled={!data || exporting !== null}
                      onClick={() => runExport("pdf")}
                    >
                      {exporting === "pdf" ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" /> : <FileType className="w-3.5 h-3.5 text-red-400" />}
                      PDF
                    </Button>

                    {/* 📊 Excel Download */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 font-medium border-border/70 hover:bg-muted"
                      disabled={!data || exporting !== null}
                      onClick={() => runExport("xlsx")}
                    >
                      {exporting === "xlsx" ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-green-400" />}
                      Excel
                    </Button>

                    {/* 📝 CSV Download */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 font-medium border-border/70 hover:bg-muted"
                      disabled={!data || exporting !== null}
                      onClick={() => runExport("csv")}
                    >
                      {exporting === "csv" ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" /> : <FileText className="w-3.5 h-3.5 text-blue-400" />}
                      CSV
                    </Button>
                  </div>
                </div>

                {error && (
                  <div className="no-print mx-5 mt-3 rounded-lg px-4 py-2.5 text-sm bg-destructive/15 text-destructive border border-destructive/30 flex items-center justify-between flex-shrink-0">
                    <span>{error}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setError(null)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}

                {/* Printable Report Canvas */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                  <div id="printable-report-area" ref={printAreaRef} className="p-5 space-y-6">
                    {/* Header exclusively styled for Print or top of canvas */}
                    {data && (
                      <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{data.reportTitle}</h1>
                            <p className="text-sm font-semibold text-slate-700 mt-0.5">
                              {data.tournamentSport.toUpperCase()} · {data.tournamentName}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-900">BidWar Platform Report</p>
                            <p className="text-[10px] text-slate-500">
                              Generated: {new Date(data.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
                            </p>
                          </div>
                        </div>
                        {data.filtersApplied.length > 0 && (
                          <p className="text-[10px] text-slate-600 mt-2 italic">
                            Filters applied: {data.filtersApplied.join(" | ")}
                          </p>
                        )}
                      </div>
                    )}

                    {loadingPreview && !data && (
                      <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                      </div>
                    )}

                    {data && (
                      <>
                        {/* Summary KPI Cards */}
                        {data.summary && data.summary.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {data.summary.map((s, i) => (
                              <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                                <Card className="p-3 bg-card/80 border-border/60 print-card shadow-sm">
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</p>
                                  <p className="text-xl font-bold font-display mt-1 text-foreground">{s.value}</p>
                                </Card>
                              </motion.div>
                            ))}
                          </div>
                        )}

                        {/* Active Filter Badges */}
                        {data.filtersApplied.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap no-print">
                            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                            {data.filtersApplied.map(f => (
                              <Badge key={f} variant="outline" className="text-[10px] bg-muted/40">{f}</Badge>
                            ))}
                          </div>
                        )}

                        {/* Render Visual Showcase Posters or Section Tables */}
                        {activeReport === "top_5_showcase" && viewMode === "visual" ? (
                          <Top5ShowcasePoster data={data} tournament={selectedTournament} />
                        ) : activeReport === "team_showcase" && viewMode === "visual" ? (
                          <TeamSoldSquadShowcase data={data} />
                        ) : (
                          <>
                            {data.sections.map((section, i) => (
                              <SectionTable key={i} section={section} />
                            ))}
                          </>
                        )}

                        {data.sections.every(s => s.rows.length === 0) && (
                          <div className="text-center py-16 text-muted-foreground">
                            <Table2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                            <p className="text-sm font-medium">No data matches the selected criteria.</p>
                            <p className="text-xs text-muted-foreground mt-1">Try clearing some filters or changing the tournament.</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </main>
      </div>
    </AdminShell>
  );
}

function NoTournamentState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <Trophy className="w-14 h-14 text-primary mx-auto mb-3 opacity-60" />
        <h2 className="font-display font-bold text-xl mb-1 text-foreground">Select a Tournament</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Please pick a tournament from the dropdown in the left sidebar to load its reports, stats, and player data.
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <ShieldCheck className="w-14 h-14 text-primary mx-auto mb-3 opacity-60" />
        <h2 className="font-display font-bold text-xl mb-1 text-foreground">Select a Report</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Choose a report from the catalog on the left to view real-time data, apply filters, print official sheets, or export to PDF, Excel, and CSV.
        </p>
      </div>
    </div>
  );
}

function usePosterBranding() {
  const { logos, brandName, iconVersion } = useBranding();
  const logoSrc =
    getObsBroadcastLogoSrc(logos, iconVersion) ||
    getObsBrandMarkSrc(logos, iconVersion) ||
    OBS_BROADCAST_LOGO_FALLBACK;
  return { logoSrc, brandName: brandName || "BidWar" };
}

async function captureAndDownloadElement(element: HTMLElement, filename: string) {
  const html2canvas = (await import("html2canvas-pro")).default;
  await document.fonts.ready;
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: "#030712",
  });
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.download = `${filename}.png`;
  a.href = url;
  a.click();
}

function Top5ShowcasePoster({ data, tournament }: { data: ReportData; tournament: AdminTournamentRow | null }) {
  const { logoSrc, brandName } = usePosterBranding();
  const unit: AuctionUnit = data.auctionUnit ?? "rupee";
  const posterRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  const rows = data.sections[0]?.rows ?? [];
  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground bg-card/40 rounded-xl border border-border/50 p-8 max-w-lg mx-auto">
        <Crown className="w-12 h-12 mx-auto mb-3 text-amber-400/40" />
        <p className="text-sm font-semibold text-foreground">No sold players found for this tournament.</p>
        <p className="text-xs text-muted-foreground mt-1">Once players are marked as sold, the top 5 highest bids will appear here automatically.</p>
      </div>
    );
  }

  const top1 = rows[0];
  const others = rows.slice(1, 5);
  const totalSpend = rows.reduce((s, p) => s + ((p.soldPrice ?? p.retainedPrice ?? 0) as number), 0);

  const handleDownload = async () => {
    if (!posterRef.current) return;
    setDownloading(true);
    try {
      const safeTournament = (data.tournamentName || "tournament").toLowerCase().replace(/[^a-z0-9]/g, "_");
      await captureAndDownloadElement(posterRef.current, `${safeTournament}_top_5_sold_players_poster`);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Individual Action Header */}
      <div className="flex items-center justify-between gap-3 max-w-[580px] mx-auto no-print px-1">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Instagram Portrait (4:5 / Story Ready)
        </span>
        <Button
          size="sm"
          className="h-8 gap-1.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-bold text-xs shadow-md"
          disabled={downloading}
          onClick={handleDownload}
        >
          {downloading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ImageDown className="w-3.5 h-3.5" />}
          Save Top 5 Poster (PNG)
        </Button>
      </div>

      {/* Portrait Poster Canvas */}
      <div
        ref={posterRef}
        className="w-full max-w-[580px] mx-auto rounded-3xl border border-amber-500/40 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-5 sm:p-7 text-white shadow-2xl relative overflow-hidden space-y-5"
      >
        {/* Glow backdrop decorations */}
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -z-0" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-0" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            {logoSrc && (
              <img
                src={logoSrc}
                alt={brandName}
                className="h-9 sm:h-11 w-auto max-w-[140px] object-contain shrink-0"
                crossOrigin="anonymous"
              />
            )}
            <div className="h-6 w-[1px] bg-white/20" />
            <div className="min-w-0">
              <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                {data.tournamentSport}
              </span>
              <p className="text-xs sm:text-sm font-bold text-slate-200 leading-tight">
                {data.tournamentName}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[9px] font-mono font-bold uppercase bg-amber-500/15 text-amber-300 border-amber-500/40 px-2 py-0.5">
            AUCTION HIGHLIGHTS
          </Badge>
        </div>

        {/* Title Banner */}
        <div className="relative z-10 text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-500/30">
            <Crown className="w-3 h-3 text-amber-400 fill-amber-400" /> TOP 5 MOST EXPENSIVE BUYS
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-display">
            HIGHEST SOLD PLAYERS
          </h1>
          <p className="text-xs text-slate-400">
            Combined Top 5 Spend: <span className="font-bold text-amber-300">{formatAuctionAmount(totalSpend, unit)}</span>
          </p>
        </div>

        {/* Rank #1 Most Expensive Player - Hero Gold Card */}
        {top1 && (
          <div className="relative z-10 rounded-2xl border-2 border-amber-400/80 bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-amber-950/30 p-4 sm:p-5 shadow-xl shadow-amber-500/10">
            <div className="absolute -top-3 left-4 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[10px] px-3 py-0.5 rounded-full shadow flex items-center gap-1 uppercase tracking-wider">
              <Crown className="w-3 h-3 fill-slate-950" /> #1 HIGHEST BID
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 mt-1">
              {/* Player Photo */}
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-amber-400/70 bg-slate-800 shadow-md flex items-center justify-center">
                  {top1.photoUrl ? (
                    <img
                      src={cldUrl(top1.photoUrl as string, "soldCard")}
                      alt={String(top1.name)}
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <User className="w-14 h-14 text-slate-600" />
                  )}
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 bg-amber-400 text-slate-950 text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow">
                  1
                </div>
              </div>

              {/* Player Details - Full names & roles (NO TRUNCATION) */}
              <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white leading-tight break-words">
                    {String(top1.name)}
                  </h2>
                  {top1.role && (
                    <p className="text-xs font-bold text-amber-300 uppercase mt-0.5 break-words">
                      {String(top1.role).replace(/_/g, " ")}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 text-[11px] text-slate-300">
                  {top1.categoryName && (
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {String(top1.categoryName)}
                    </span>
                  )}
                  {top1.city && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <MapPin className="w-3 h-3 text-slate-400" /> {String(top1.city)}
                    </span>
                  )}
                </div>

                {/* Team Info */}
                <div className="pt-1 flex items-center justify-center sm:justify-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {top1.teamLogoUrl ? (
                      <img
                        src={cldUrl(top1.teamLogoUrl as string, "teamLogo")}
                        alt={String(top1.teamName)}
                        className="w-full h-full object-contain p-0.5"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <span className="text-[10px] font-black text-amber-400">{String(top1.teamShortCode || "TM")}</span>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] uppercase font-bold text-slate-400">Acquired By</p>
                    <p className="text-xs font-bold text-white leading-none break-words">{String(top1.teamName || "Team")}</p>
                  </div>
                </div>
              </div>

              {/* Full Sold Price Tag (No "K" abbreviations) */}
              <div className="flex-shrink-0 text-center sm:text-right bg-amber-500/10 border border-amber-500/40 rounded-xl px-4 py-2.5">
                <p className="text-[9px] font-extrabold uppercase tracking-widest text-amber-400">Winning Bid</p>
                <p className="text-xl sm:text-2xl font-black font-display text-amber-300">
                  {formatAuctionAmount((top1.soldPrice ?? top1.retainedPrice ?? 0) as number, unit)}
                </p>
                <span className="inline-block mt-0.5 text-[8px] font-black uppercase px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                  SOLD
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Rank 2 to 5 Cards (2-Column Grid for clean Instagram layout) */}
        {others.length > 0 && (
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {others.map((p, idx) => {
              const rank = idx + 2;
              const rankBadgeColor =
                rank === 2
                  ? "bg-gradient-to-r from-sky-400 to-blue-500 text-slate-950"
                  : rank === 3
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950"
                  : "bg-slate-700 text-slate-200";

              return (
                <div
                  key={idx}
                  className="relative rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5 flex flex-col justify-between space-y-3"
                >
                  <div className="absolute top-2.5 right-2.5">
                    <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${rankBadgeColor}`}>
                      #{rank}
                    </span>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-slate-700 bg-slate-800 flex-shrink-0 flex items-center justify-center">
                      {p.photoUrl ? (
                        <img
                          src={cldUrl(p.photoUrl as string, "avatar")}
                          alt={String(p.name)}
                          className="w-full h-full object-cover"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <User className="w-7 h-7 text-slate-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pr-6">
                      <p className="font-bold text-xs sm:text-sm text-white leading-snug break-words">{String(p.name)}</p>
                      <p className="text-[10px] font-semibold text-amber-300 uppercase leading-snug mt-0.5 break-words">
                        {String(p.role || "").replace(/_/g, " ")}
                      </p>
                      {p.categoryName && (
                        <span className="text-[9px] text-slate-400 block mt-0.5 break-words">
                          {String(p.categoryName)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {p.teamLogoUrl ? (
                        <img
                          src={cldUrl(p.teamLogoUrl as string, "teamLogo")}
                          alt={String(p.teamName)}
                          className="w-5 h-5 object-contain rounded shrink-0"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-300 shrink-0">
                          {String(p.teamShortCode || "T")}
                        </div>
                      )}
                      <span className="text-[10px] font-medium text-slate-300 break-words leading-tight">
                        {String(p.teamName || "Team")}
                      </span>
                    </div>

                    <span className="text-xs font-black font-display text-emerald-400 whitespace-nowrap">
                      {formatAuctionAmount((p.soldPrice ?? p.retainedPrice ?? 0) as number, unit)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Watermark */}
        <div className="relative z-10 pt-3 border-t border-slate-800 flex items-center justify-between text-[9px] text-slate-500">
          <span>Verified by BidWar Engine</span>
          <span>Generated {new Date(data.generatedAt).toLocaleDateString("en-IN")}</span>
        </div>
      </div>
    </div>
  );
}

function TeamSoldSquadShowcase({ data }: { data: ReportData }) {
  const { logoSrc, brandName } = usePosterBranding();
  const unit: AuctionUnit = data.auctionUnit ?? "rupee";
  const [selectedTeamTab, setSelectedTeamTab] = useState<string>("all");
  const [downloadingTeam, setDownloadingTeam] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const teamCardsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  if (data.sections.length === 0 || data.sections.every(s => s.rows.length === 0)) {
    return (
      <div className="text-center py-16 text-muted-foreground bg-card/40 rounded-xl border border-border/50 p-8 max-w-lg mx-auto">
        <Trophy className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-sm font-semibold text-foreground">No sold/retained squad members found.</p>
        <p className="text-xs text-muted-foreground mt-1">Once players are sold or retained by teams, their squad rosters will appear here.</p>
      </div>
    );
  }

  const handleDownloadSingleTeam = async (teamName: string) => {
    const el = teamCardsRef.current.get(teamName);
    if (!el) return;
    setDownloadingTeam(teamName);
    try {
      const safeTournament = (data.tournamentName || "tournament").toLowerCase().replace(/[^a-z0-9]/g, "_");
      const safeTeam = teamName.toLowerCase().replace(/[^a-z0-9]/g, "_");
      await captureAndDownloadElement(el, `${safeTournament}_${safeTeam}_squad_poster`);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloadingTeam(null);
    }
  };

  const handleDownloadAllTeams = async () => {
    setDownloadingAll(true);
    try {
      const safeTournament = (data.tournamentName || "tournament").toLowerCase().replace(/[^a-z0-9]/g, "_");
      for (const section of data.sections) {
        if (!section.rows.length) continue;
        const firstRow = section.rows[0];
        const teamName = String(firstRow.teamName || section.heading?.split("(")[0]?.trim() || "Team");
        const el = teamCardsRef.current.get(teamName);
        if (el) {
          const safeTeam = teamName.toLowerCase().replace(/[^a-z0-9]/g, "_");
          await captureAndDownloadElement(el, `${safeTournament}_${safeTeam}_squad_poster`);
          // slight delay between downloads
          await new Promise(r => setTimeout(r, 400));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDownloadingAll(false);
    }
  };

  const visibleSections = selectedTeamTab === "all"
    ? data.sections
    : data.sections.filter(s => {
        const firstRow = s.rows[0];
        const teamName = String(firstRow?.teamName || s.heading?.split("(")[0]?.trim() || "");
        return teamName === selectedTeamTab;
      });

  return (
    <div className="space-y-6">
      {/* Team Tabs Selector & Batch Action Bar */}
      <div className="no-print bg-card/60 p-3.5 rounded-2xl border border-border/60 max-w-[580px] mx-auto flex flex-col gap-3 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-foreground">Select Team Poster</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] gap-1 font-semibold border-border/80"
            disabled={downloadingAll}
            onClick={handleDownloadAllTeams}
          >
            {downloadingAll ? <RefreshCw className="w-3 h-3 animate-spin text-primary" /> : <Download className="w-3 h-3 text-primary" />}
            Download All Teams ({data.sections.length})
          </Button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant={selectedTeamTab === "all" ? "default" : "secondary"}
            className="h-7 px-2.5 text-xs font-semibold rounded-lg"
            onClick={() => setSelectedTeamTab("all")}
          >
            All Teams ({data.sections.length})
          </Button>
          {data.sections.map((section, idx) => {
            const firstRow = section.rows[0];
            const teamName = String(firstRow?.teamName || section.heading?.split("(")[0]?.trim() || `Team ${idx + 1}`);
            const isActive = selectedTeamTab === teamName;
            return (
              <Button
                key={idx}
                size="sm"
                variant={isActive ? "default" : "outline"}
                className={`h-7 px-2.5 text-xs font-semibold rounded-lg ${isActive ? "bg-primary text-primary-foreground" : "border-border/70"}`}
                onClick={() => setSelectedTeamTab(teamName)}
              >
                {teamName}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Render Individual Instagram Portrait Posters for Each Team */}
      <div className="space-y-8">
        {visibleSections.map((section, sIdx) => {
          if (!section.rows.length) return null;
          const firstRow = section.rows[0];
          const teamName = String(firstRow.teamName || section.heading?.split("(")[0]?.trim() || "Team");
          const teamLogoUrl = firstRow.teamLogoUrl as string | null;
          const teamShortCode = firstRow.teamShortCode as string | null;
          const totalSpent = section.rows.reduce((sum, p) => sum + ((p.soldPrice ?? p.retainedPrice ?? 0) as number), 0);
          const isDownloadingThis = downloadingTeam === teamName;

          return (
            <div key={sIdx} className="space-y-3 max-w-[580px] mx-auto">
              {/* Individual Team Download Bar */}
              <div className="flex items-center justify-between gap-2 px-1 no-print">
                <span className="text-xs font-bold text-foreground truncate">{teamName} Squad Poster</span>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md"
                  disabled={isDownloadingThis}
                  onClick={() => handleDownloadSingleTeam(teamName)}
                >
                  {isDownloadingThis ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  ) : (
                    <ImageDown className="w-3.5 h-3.5" />
                  )}
                  Save {teamName} Poster (PNG)
                </Button>
              </div>

              {/* Instagram Portrait Card */}
              <div
                ref={(el) => {
                  if (el) teamCardsRef.current.set(teamName, el);
                  else teamCardsRef.current.delete(teamName);
                }}
                className="w-full rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-5 sm:p-7 text-white shadow-2xl relative overflow-hidden space-y-5"
              >
                {/* Brand Header */}
                <div className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    {logoSrc && (
                      <img
                        src={logoSrc}
                        alt={brandName}
                        className="h-9 sm:h-11 w-auto max-w-[140px] object-contain shrink-0"
                        crossOrigin="anonymous"
                      />
                    )}
                    <div className="h-6 w-[1px] bg-white/20" />
                    <div className="min-w-0">
                      <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                        {data.tournamentSport}
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-slate-200 leading-tight">
                        {data.tournamentName}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-mono font-bold uppercase bg-blue-500/15 text-blue-300 border-blue-500/40 px-2 py-0.5">
                    OFFICIAL SQUAD
                  </Badge>
                </div>

                {/* Team Banner Header */}
                <div className="relative z-10 flex items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-inner">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0 shadow">
                      {teamLogoUrl ? (
                        <img
                          src={cldUrl(teamLogoUrl, "teamLogo")}
                          alt={teamName}
                          className="w-full h-full object-contain p-1"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <span className="text-sm font-black text-amber-400">{teamShortCode || "TM"}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-black text-white tracking-tight break-words">{teamName}</h2>
                        {teamShortCode && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {teamShortCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Squad: <span className="font-bold text-white">{section.rows.length}</span> Acquired Players
                      </p>
                    </div>
                  </div>

                  {/* Total Spend (Full unit value e.g. ₹15,00,000) */}
                  <div className="text-right flex-shrink-0 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
                    <p className="text-[9px] uppercase font-bold text-slate-400">Total Spent</p>
                    <p className="text-sm sm:text-base font-black font-display text-emerald-400">
                      {formatAuctionAmount(totalSpent, unit)}
                    </p>
                  </div>
                </div>

                {/* Player Cards Grid - Clean 2-Column Layout (NO TRUNCATION) */}
                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {section.rows.map((p, pIdx) => {
                    const status = String(p.status || "sold").toLowerCase();
                    const isRetained = status === "retained";
                    const price = (p.soldPrice ?? p.retainedPrice ?? 0) as number;

                    return (
                      <div
                        key={pIdx}
                        className="rounded-2xl border border-slate-800 bg-slate-900/80 hover:border-slate-700 transition p-3 flex gap-3 items-start"
                      >
                        {/* Player Photo */}
                        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-slate-700 bg-slate-800 flex-shrink-0 flex items-center justify-center mt-0.5">
                          {p.photoUrl ? (
                            <img
                              src={cldUrl(p.photoUrl as string, "avatar")}
                              alt={String(p.name)}
                              className="w-full h-full object-cover"
                              crossOrigin="anonymous"
                            />
                          ) : (
                            <User className="w-7 h-7 text-slate-600" />
                          )}
                        </div>

                        {/* Full Player Details (NO TRUNCATION) */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-1">
                            <p className="font-bold text-xs sm:text-sm text-white leading-snug break-words">
                              {String(p.name)}
                            </p>
                            {p.jerseyNumber && (
                              <span className="text-[9px] font-mono font-bold text-slate-400 shrink-0">
                                #{p.jerseyNumber}
                              </span>
                            )}
                          </div>

                          <div className="space-y-0.5">
                            {p.role && (
                              <p className="text-[10px] font-semibold text-amber-300 uppercase leading-snug break-words">
                                {String(p.role).replace(/_/g, " ")}
                              </p>
                            )}
                            {p.categoryName && (
                              <p className="text-[9px] text-slate-400 break-words leading-tight">
                                {String(p.categoryName)}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 mt-1">
                            <span className="text-xs font-black font-display text-emerald-400 whitespace-nowrap">
                              {formatAuctionAmount(price, unit)}
                            </span>
                            <span
                              className={`text-[8px] uppercase font-black px-1.5 py-0.2 rounded ${
                                isRetained
                                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                  : "bg-green-500/20 text-green-300 border border-green-500/30"
                              }`}
                            >
                              {status}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Watermark */}
                <div className="relative z-10 pt-3 border-t border-slate-800 flex items-center justify-between text-[9px] text-slate-500">
                  <span>Verified by BidWar Engine</span>
                  <span>Generated {new Date(data.generatedAt).toLocaleDateString("en-IN")}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionTable({ section }: { section: Section }) {
  if (!section.rows.length) {
    if (!section.heading) return null;
    return (
      <div className="space-y-1">
        <p className="font-display font-semibold text-sm text-foreground">{section.heading}</p>
        <p className="text-xs text-muted-foreground italic">No rows</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {section.heading && (
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 bg-primary rounded-sm print:hidden" />
          <p className="font-display font-bold text-sm text-foreground">{section.heading}</p>
        </div>
      )}
      <div className="border border-border/60 rounded-lg overflow-hidden bg-card/60 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs print-table">
            <thead className="bg-muted/60 border-b border-border/60">
              <tr>
                <th className="text-left px-3 py-2 font-bold text-muted-foreground w-10">#</th>
                {section.columns.map(c => (
                  <th key={c.key} className="text-left px-3 py-2 font-bold text-muted-foreground whitespace-nowrap">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.slice(0, 300).map((row, i) => (
                <tr key={i} className={`border-b border-border/30 transition hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                  <td className="px-3 py-2 text-muted-foreground font-mono">{i + 1}</td>
                  {section.columns.map(c => (
                    <td key={c.key} className="px-3 py-2 whitespace-nowrap">{renderCell(row, c.key)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {section.rows.length > 300 && (
          <div className="no-print text-[11px] text-muted-foreground bg-muted/30 px-3 py-2 border-t border-border/30 flex items-center justify-between">
            <span>Showing first 300 of {section.rows.length} rows.</span>
            <span>Download PDF/Excel to view full dataset.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function renderCell(row: Record<string, unknown>, key: string) {
  const v = row[key];
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground/50">-</span>;
  if (typeof v === "number") {
    if (key.toLowerCase().includes("price") || key === "purse" || key === "purseUsed" || key === "purseRemaining") {
      return <span className="font-semibold text-foreground">{formatShortRupee(v)}</span>;
    }
    if (key === "utilization") return <span className="font-semibold">{v.toFixed(1)}%</span>;
    return String(v);
  }
  if (key === "status") {
    const s = String(v).toLowerCase();
    const cls =
      s === "sold" ? "bg-green-500/15 text-green-400 border-green-500/30"
      : s === "unsold" ? "bg-red-500/15 text-red-400 border-red-500/30"
      : s === "retained" ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
      : "bg-muted/40 text-muted-foreground";
    return <Badge className={`text-[9px] uppercase font-bold px-1.5 py-0 ${cls}`}>{s}</Badge>;
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
    (filters.jerseySizes?.length ?? 0) +
    (filters.search ? 1 : 0) +
    (filters.minPrice !== undefined ? 1 : 0) +
    (filters.maxPrice !== undefined ? 1 : 0)
  );
  return (
    <div className="border-b border-border/40 flex-shrink-0 bg-card/30">
      <div className="px-5 py-2.5 flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" className={`h-8 gap-1.5 ${open ? "bg-muted border-primary/50" : ""}`} onClick={() => setOpen(o => !o)}>
          <Filter className="w-3.5 h-3.5" /> Filters
          {activeCount > 0 && <Badge className="ml-1 h-4 px-1.5 text-[10px] bg-primary/20 text-primary">{activeCount}</Badge>}
          <ChevronDown className={`w-3 h-3 ml-0.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            value={filters.search ?? ""}
            onChange={e => setFilters(p => ({ ...p, search: e.target.value || undefined }))}
            placeholder="Search by player name..."
            className="h-8 w-64 pl-8 text-xs bg-background"
          />
        </div>
        {activeCount > 0 && (
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => setFilters({})}>
            <X className="w-3.5 h-3.5" /> Clear Filters
          </Button>
        )}
        <Button size="sm" variant="secondary" className="h-8 gap-1.5 ml-auto text-xs" onClick={onRun} disabled={loading}>
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh Preview
        </Button>
      </div>
      {open && (
        <div className="px-5 pb-3.5 pt-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-border/30 bg-muted/10">
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
          <FilterMultiText
            label="Jersey Size"
            options={(ctx.jerseySizeOptions.length ? ctx.jerseySizeOptions : ctx.jerseySizes).map(s => ({ id: s, label: s }))}
            selected={filters.jerseySizes ?? []}
            onToggle={s => toggle("jerseySizes", s, filters.jerseySizes)}
          />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">City contains</Label>
            <CityAutocomplete
              value={filters.city ?? ""}
              onChange={v => setFilters(p => ({ ...p, city: v || undefined }))}
              placeholder="e.g. Mumbai"
              className="h-8 text-xs"
              showHint={false}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Min sold price (₹)</Label>
            <Input type="number"
              value={filters.minPrice ?? ""}
              onChange={e => setFilters(p => ({ ...p, minPrice: e.target.value ? Number(e.target.value) : undefined }))}
              className="h-8 text-xs" placeholder="e.g. 100000"
            />
            <IndianAmountHint value={filters.minPrice} className="text-[10px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Max sold price (₹)</Label>
            <Input type="number"
              value={filters.maxPrice ?? ""}
              onChange={e => setFilters(p => ({ ...p, maxPrice: e.target.value ? Number(e.target.value) : undefined }))}
              className="h-8 text-xs" placeholder="e.g. 5000000"
            />
            <IndianAmountHint value={filters.maxPrice} className="text-[10px]" />
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
      <div className="border border-border/50 rounded-md p-2 max-h-32 overflow-y-auto space-y-1 bg-background shadow-inner">
        {options.length === 0 && <p className="text-[11px] text-muted-foreground">None</p>}
        {options.map(o => (
          <label key={o.id} className="flex items-center gap-2 cursor-pointer text-xs hover:text-foreground">
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
      <div className="border border-border/50 rounded-md p-2 max-h-32 overflow-y-auto space-y-1 bg-background shadow-inner">
        {options.length === 0 && <p className="text-[11px] text-muted-foreground">None</p>}
        {options.map(o => (
          <label key={o.id} className="flex items-center gap-2 cursor-pointer text-xs hover:text-foreground">
            <Checkbox checked={selected.includes(o.id)} onCheckedChange={() => onToggle(o.id)} />
            <span className="truncate">{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
