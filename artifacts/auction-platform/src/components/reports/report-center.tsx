import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { CityAutocomplete } from "@/components/city-autocomplete";
import {
  ShieldCheck, FileText, FileSpreadsheet, FileType, Printer, RefreshCw,
  Search, Users, TrendingUp, Wallet, Award, Phone, MapPin, Trophy, Filter,
  ListChecks, Table2, BadgeCheck, X, ChevronDown, Check,
  Crown, Sparkles, ImageDown, User, LayoutGrid, TableProperties, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { IndianAmountHint } from "@/components/ui/indian-amount-hint";
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

export type ReportType = {
  id: string;
  title: string;
  description: string;
  category: "pre" | "live" | "post" | "directory";
};

export type ReportContext = {
  tournament: { id: number; name: string; sport: string; auctionUnit?: "rupee" | "points" };
  teams: { id: number; name: string; shortCode: string; color: string | null }[];
  categories: { id: number; name: string; colorCode: string | null }[];
  roles: string[];
  cities: string[];
  jerseySizes: string[];
  jerseySizeOptions: string[];
  playerCount: number;
};

export type Filters = {
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

export type Column = { key: string; label: string; width?: number };
export type Section = { heading?: string; columns: Column[]; rows: Record<string, unknown>[] };
export type ReportData = {
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

export interface ReportCenterProps {
  tournamentId?: number | null;
  tournaments?: { id: number; name: string; sport?: string }[];
  onSelectTournament?: (id: number) => void;
  hideTournamentSelector?: boolean;
  className?: string;
}

export function ReportCenter({
  tournamentId: propTournamentId,
  tournaments = [],
  onSelectTournament,
  hideTournamentSelector = true,
  className = "",
}: ReportCenterProps) {
  const [internalTournamentId, setInternalTournamentId] = useState<number | null>(propTournamentId ?? null);
  const activeTournamentId = propTournamentId !== undefined ? propTournamentId : internalTournamentId;

  const [reportTypes, setReportTypes] = useState<ReportType[]>([]);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"visual" | "table">("visual");
  const [ctx, setCtx] = useState<ReportContext | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [data, setData] = useState<ReportData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | "csv" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const printAreaRef = useRef<HTMLDivElement | null>(null);

  // Sync prop changes
  useEffect(() => {
    if (propTournamentId !== undefined) {
      setInternalTournamentId(propTournamentId);
    }
  }, [propTournamentId]);

  // Load report types on mount
  useEffect(() => {
    let cancel = false;
    async function loadTypes() {
      try {
        const types = await api<{ reports: ReportType[] }>("/auth/admin/reports/types");
        if (cancel) return;
        setReportTypes(types.reports);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "Failed to load report types");
      }
    }
    loadTypes();
    return () => { cancel = true; };
  }, []);

  // Load tournament report context
  useEffect(() => {
    if (!activeTournamentId) {
      setCtx(null);
      setData(null);
      return;
    }
    let cancel = false;
    async function loadContext() {
      try {
        const c = await api<ReportContext>(`/auth/admin/reports/${activeTournamentId}/context`);
        if (cancel) return;
        setCtx(c);
        setError(null);
      } catch (e) {
        if (!cancel) {
          setCtx(null);
          setError(e instanceof Error ? e.message : "Failed to load tournament context");
        }
      }
    }
    loadContext();
    return () => { cancel = true; };
  }, [activeTournamentId]);

  // Auto-switch default view mode based on report type
  useEffect(() => {
    if (activeReport === "top_5_showcase" || activeReport === "team_showcase") {
      setViewMode("visual");
    } else {
      setViewMode("table");
    }
  }, [activeReport]);

  // Load preview data
  const loadPreview = useCallback(async (reportId: string, currentFilters: Filters) => {
    if (!activeTournamentId) return;
    setLoadingPreview(true);
    setError(null);
    try {
      const res = await api<ReportData>(`/auth/admin/reports/${activeTournamentId}/preview`, {
        method: "POST",
        body: JSON.stringify({ type: reportId, filters: currentFilters }),
      });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report preview");
      setData(null);
    } finally {
      setLoadingPreview(false);
    }
  }, [activeTournamentId]);

  // Run preview when active report or active tournament changes
  useEffect(() => {
    if (activeTournamentId && activeReport) {
      loadPreview(activeReport, filters);
    }
  }, [activeTournamentId, activeReport, loadPreview]);

  // Handle report selection
  const handleSelectReport = (reportId: string) => {
    setActiveReport(reportId);
    setFilters({});
  };

  // Filtered catalogue
  const filteredTypes = useMemo(() => {
    if (!search.trim()) return reportTypes;
    const q = search.toLowerCase();
    return reportTypes.filter(r => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  }, [reportTypes, search]);

  const groupedReports = useMemo(() => {
    const groups: Record<ReportType["category"], ReportType[]> = { pre: [], live: [], post: [], directory: [] };
    for (const r of filteredTypes) {
      if (groups[r.category]) groups[r.category].push(r);
    }
    return groups;
  }, [filteredTypes]);

  // Handle Export (PDF, Excel, CSV)
  const handleExport = async (format: "pdf" | "xlsx" | "csv") => {
    if (!activeTournamentId || !activeReport) return;
    setExporting(format);
    setError(null);
    try {
      const res = await fetch(`${API}/auth/admin/reports/${activeTournamentId}/export`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: activeReport, format, filters }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const contentDisp = res.headers.get("Content-Disposition") || "";
      const match = contentDisp.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `report.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`report-center-root space-y-4 ${className}`}>
      {/* Printable CSS override */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .report-printable-area, .report-printable-area * { visibility: visible; }
          .report-printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            padding: 20px !important;
            background: white !important;
            color: black !important;
          }
          .no-print { display: none !important; }
          .print-table {
            width: 100%;
            border-collapse: collapse;
          }
          .print-table th, .print-table td {
            border: 1px solid #ddd;
            padding: 6px 8px;
            font-size: 10pt;
            color: black !important;
          }
          .print-table th {
            background-color: #f2f2f2 !important;
            font-weight: bold;
          }
        }
      `}</style>

      {/* Main Layout: Split Catalogue & Viewer */}
      <div className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xl overflow-hidden flex flex-col lg:flex-row min-h-[700px]">
        {/* Left Sidebar: Catalogue */}
        <aside className="no-print w-full lg:w-80 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border/60 bg-muted/20 flex flex-col">
          {/* Header & Tournament selector (if not hidden) */}
          <div className="p-4 border-b border-border/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="font-display font-bold text-sm tracking-tight text-foreground">Report Catalogue</h3>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono">
                {reportTypes.length} Active
              </Badge>
            </div>

            {!hideTournamentSelector && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground font-semibold">Select Tournament</Label>
                <Select
                  value={activeTournamentId ? String(activeTournamentId) : ""}
                  onValueChange={v => {
                    const id = Number(v);
                    setInternalTournamentId(id);
                    onSelectTournament?.(id);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="-- Pick a tournament --" />
                  </SelectTrigger>
                  <SelectContent>
                    {tournaments.map(t => (
                      <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Catalogue Search */}
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

          {/* Catalogue Report List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 max-h-[600px]">
            {!activeTournamentId ? (
              <div className="text-center py-10 px-3 text-muted-foreground text-xs">
                <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50 text-primary" />
                Please select a tournament above to unlock reports.
              </div>
            ) : (
              (Object.keys(groupedReports) as ReportType["category"][]).map(catKey => {
                const list = groupedReports[catKey];
                if (list.length === 0) return null;
                const meta = CATEGORY_META[catKey];
                const CatIcon = meta.icon;

                return (
                  <div key={catKey} className="space-y-1.5">
                    <div className="flex items-center gap-1.5 px-2 py-1">
                      <CatIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {meta.label}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {list.map(r => {
                        const isSelected = activeReport === r.id;
                        const Icon = REPORT_ICON[r.id] || FileText;
                        const isVisual = r.id === "top_5_showcase" || r.id === "team_showcase";

                        return (
                          <button
                            key={r.id}
                            onClick={() => handleSelectReport(r.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border transition flex items-start gap-2.5 ${
                              isSelected
                                ? "bg-primary/10 border-primary/50 text-foreground shadow-sm ring-1 ring-primary/20"
                                : "border-border/40 bg-card/40 hover:bg-card/80 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <div className={`p-1.5 rounded-lg flex-shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <p className={`text-xs font-semibold truncate ${isSelected ? "text-primary font-bold" : ""}`}>
                                  {r.title}
                                </p>
                                {isVisual && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-amber-500/10 text-amber-400 border-amber-500/30">
                                    Poster
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                                {r.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Content Area: Filters, Action Bar, Preview */}
        <main className="flex-1 flex flex-col min-w-0 bg-background/50">
          {!activeTournamentId ? (
            <NoTournamentState />
          ) : !activeReport ? (
            <EmptyState />
          ) : (
            <>
              {/* Action Bar Header */}
              <div className="no-print p-3 sm:p-4 border-b border-border/60 bg-card/40 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 text-primary border-primary/30 bg-primary/5">
                      {reportTypes.find(r => r.id === activeReport)?.category.toUpperCase()} REPORT
                    </Badge>
                    <h2 className="text-sm sm:text-base font-bold text-foreground truncate">
                      {reportTypes.find(r => r.id === activeReport)?.title}
                    </h2>
                  </div>
                  {data && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Generated on {new Date(data.generatedAt).toLocaleString("en-IN")} · {ctx?.tournament.name}
                    </p>
                  )}
                </div>

                {/* View Mode & Export Actions */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  {/* View Mode Toggle (Visual vs Table) */}
                  {(activeReport === "top_5_showcase" || activeReport === "team_showcase") && (
                    <div className="flex items-center bg-muted/80 p-0.5 rounded-lg border border-border/60 mr-1">
                      <Button
                        size="sm"
                        variant={viewMode === "visual" ? "default" : "ghost"}
                        className="h-7 px-2 text-xs font-semibold gap-1 rounded-md"
                        onClick={() => setViewMode("visual")}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" /> Poster Visual
                      </Button>
                      <Button
                        size="sm"
                        variant={viewMode === "table" ? "default" : "ghost"}
                        className="h-7 px-2 text-xs font-semibold gap-1 rounded-md"
                        onClick={() => setViewMode("table")}
                      >
                        <TableProperties className="w-3.5 h-3.5" /> Data Table
                      </Button>
                    </div>
                  )}

                  {/* Print */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs font-semibold"
                    onClick={handlePrint}
                    disabled={loadingPreview || !data}
                  >
                    <Printer className="w-3.5 h-3.5 text-primary" /> Print
                  </Button>

                  {/* PDF Export */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs font-semibold"
                    onClick={() => handleExport("pdf")}
                    disabled={exporting !== null || loadingPreview || !data}
                  >
                    {exporting === "pdf" ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" /> : <FileType className="w-3.5 h-3.5 text-red-500" />}
                    PDF
                  </Button>

                  {/* Excel Export */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs font-semibold"
                    onClick={() => handleExport("xlsx")}
                    disabled={exporting !== null || loadingPreview || !data}
                  >
                    {exporting === "xlsx" ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />}
                    Excel
                  </Button>

                  {/* CSV Export */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs font-semibold"
                    onClick={() => handleExport("csv")}
                    disabled={exporting !== null || loadingPreview || !data}
                  >
                    {exporting === "csv" ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" /> : <FileText className="w-3.5 h-3.5 text-blue-400" />}
                    CSV
                  </Button>
                </div>
              </div>

              {/* Filter Bar */}
              <FilterBar
                ctx={ctx}
                filters={filters}
                setFilters={setFilters}
                onRun={() => activeReport && loadPreview(activeReport, filters)}
                loading={loadingPreview}
              />

              {/* Preview Container */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center justify-between gap-2">
                    <span>{error}</span>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => activeReport && loadPreview(activeReport, filters)}>
                      Retry
                    </Button>
                  </div>
                )}

                {loadingPreview ? (
                  <div className="space-y-4 py-8 max-w-4xl mx-auto">
                    <Skeleton className="h-10 w-3/4 rounded-xl" />
                    <Skeleton className="h-48 w-full rounded-2xl" />
                    <Skeleton className="h-64 w-full rounded-2xl" />
                  </div>
                ) : !data ? (
                  <div className="text-center py-16 text-muted-foreground text-sm">
                    No preview data generated yet. Click Refresh Preview.
                  </div>
                ) : (
                  <div ref={printAreaRef} className="report-printable-area space-y-6 max-w-5xl mx-auto">
                    {/* Header with Official Branding */}
                    <ReportBrandingHeader data={data} />

                    {/* Summary Metrics Cards */}
                    {data.summary && data.summary.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
                        {data.summary.map((item, idx) => (
                          <div key={idx} className="p-3 bg-card/80 border border-border/60 rounded-xl shadow-sm">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase">{item.label}</p>
                            <p className="text-base font-bold text-foreground mt-0.5">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Report Specific Visual or Table Presentation */}
                    {viewMode === "visual" && activeReport === "top_5_showcase" ? (
                      <div className="poster-capture-canvas">
                        <Top5ShowcasePoster data={data} tournament={ctx?.tournament || null} />
                      </div>
                    ) : viewMode === "visual" && activeReport === "team_showcase" ? (
                      <div className="poster-capture-canvas">
                        <TeamSoldSquadShowcase data={data} />
                      </div>
                    ) : (
                      /* Standard Tabular Presentation for All Reports */
                      <div className="space-y-6">
                        {data.sections.map((section, idx) => (
                          <SectionTable key={idx} section={section} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Sub-Components & Posters ──────────────────────────────────────────────────

function ReportBrandingHeader({ data }: { data: ReportData }) {
  const { logoSrc, brandName } = usePosterBranding();
  return (
    <div className="border-b border-border/70 pb-4 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {logoSrc && (
          <img
            src={logoSrc}
            alt={brandName}
            className="h-10 sm:h-12 w-auto max-w-[150px] object-contain"
            crossOrigin="anonymous"
          />
        )}
        <div className="h-8 w-[1px] bg-border/80" />
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-primary">
            {data.tournamentSport} · Official Tournament Report
          </span>
          <h1 className="text-lg sm:text-xl font-black font-display text-foreground leading-tight">
            {data.reportTitle}
          </h1>
          <p className="text-xs font-semibold text-muted-foreground">
            Tournament: <span className="text-foreground">{data.tournamentName}</span>
          </p>
        </div>
      </div>
      <div className="text-right text-[11px] text-muted-foreground flex-shrink-0">
        <Badge variant="outline" className="font-mono text-[9px] uppercase border-border/80">
          Verified by BidWar
        </Badge>
        <p className="mt-1 font-mono text-[10px]">
          {new Date(data.generatedAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>
    </div>
  );
}

function NoTournamentState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <Trophy className="w-14 h-14 text-primary mx-auto mb-3 opacity-60" />
        <h2 className="font-display font-bold text-xl mb-1 text-foreground">Select a Tournament</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Please select a tournament to view its detailed report catalogue.
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
          Choose a report from the catalogue on the left to view data, apply filters, print sheets, or export to PDF, Excel, and CSV.
        </p>
      </div>
    </div>
  );
}

export function usePosterBranding() {
  const { logos, brandName, iconVersion } = useBranding();
  const logoSrc =
    getObsBroadcastLogoSrc(logos, iconVersion) ||
    getObsBrandMarkSrc(logos, iconVersion) ||
    OBS_BROADCAST_LOGO_FALLBACK;
  return { logoSrc, brandName: brandName || "BidWar" };
}

export async function captureAndDownloadElement(element: HTMLElement, filename: string) {
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

export function Top5ShowcasePoster({ data, tournament }: { data: ReportData; tournament: { name?: string; sport?: string } | null }) {
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

export function TeamSoldSquadShowcase({ data }: { data: ReportData }) {
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

export function SectionTable({ section }: { section: Section }) {
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

export function FilterBar({
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
      <div className="px-4 sm:px-5 py-2.5 flex items-center gap-2 flex-wrap">
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
            placeholder="Search player name..."
            className="h-8 w-48 sm:w-64 pl-8 text-xs bg-background"
          />
        </div>
        {activeCount > 0 && (
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => setFilters({})}>
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
        <Button size="sm" variant="secondary" className="h-8 gap-1.5 ml-auto text-xs" onClick={onRun} disabled={loading}>
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh Preview
        </Button>
      </div>
      {open && (
        <div className="px-4 sm:px-5 pb-3.5 pt-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-border/30 bg-muted/10">
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
            options={(ctx.jerseySizeOptions?.length ? ctx.jerseySizeOptions : ctx.jerseySizes).map(s => ({ id: s, label: s }))}
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
