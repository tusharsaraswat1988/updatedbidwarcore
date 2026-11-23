import { useState, useEffect, useCallback } from "react";
import {
  Trophy, Download, RefreshCw, Sparkles, TrendingUp, Wallet,
  Flame, Users, FileSpreadsheet, FileText, ArrowDownRight,
  ArrowUpRight, BarChart3, CheckCircle2, AlertTriangle, Layers,
  ExternalLink, ChevronRight, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatShortIndianRupee } from "@/lib/format";

export interface MoneyballTeamEfficiency {
  teamId: number;
  teamName: string;
  shortCode: string;
  color: string | null;
  startingPurse: number;
  totalSpent: number;
  remainingPurse: number;
  playersBought: number;
  targetSquadSize: number;
  squadCompletionRate: number;
  costPerPlayer: number;
  costPerPlayerDiff: number;
  costPerPlayerVariancePct: number;
  budgetDeploymentRate: number;
  efficiencyScore: number;
  rank: number;
  breakdown: {
    completionScore: number;
    deploymentScore: number;
    costEfficiencyScore: number;
  };
}

export interface CategoryInflationBreakdown {
  categoryId: number | null;
  categoryName: string;
  colorCode: string | null;
  lotCount: number;
  soldCount: number;
  unsoldCount: number;
  totalSpent: number;
  averageBasePrice: number;
  averageSoldPrice: number;
  inflationPct: number;
}

export interface TournamentMarketOverview {
  totalTurnover: number;
  averageInflationPct: number;
  lotCount: number;
  soldCount: number;
  unsoldCount: number;
  soldRatio: number;
  unsoldRatio: number;
  tournamentAvgCostPerPlayer: number;
  categoryBreakdown: CategoryInflationBreakdown[];
}

export interface BargainStealHighlight {
  playerId: number;
  playerName: string;
  role: string | null;
  categoryId: number | null;
  categoryName: string | null;
  teamId: number | null;
  teamName: string | null;
  basePrice: number;
  finalAmount: number;
  multiplier: number;
  totalBids: number;
  savings: number;
}

export interface RecordBreakerHighlight {
  playerId: number;
  playerName: string;
  role: string | null;
  categoryId: number | null;
  categoryName: string | null;
  teamId: number | null;
  teamName: string | null;
  basePrice: number;
  finalAmount: number;
  escalation: number;
  inflationPct: number;
  totalBids: number;
}

export interface UnsoldCategorySummary {
  categoryId: number | null;
  categoryName: string;
  colorCode: string | null;
  unsoldCount: number;
  totalBasePrice: number;
  samplePlayers: Array<{
    id: number;
    name: string;
    role: string | null;
    basePrice: number;
  }>;
}

export interface PostMortemReport {
  tournamentId: number;
  tournamentName: string;
  sport: string;
  status: string;
  generatedAt: string;
  moneyballIndex: MoneyballTeamEfficiency[];
  marketOverview: TournamentMarketOverview;
  highlights: {
    topBargainSteals: BargainStealHighlight[];
    topRecordBreakers: RecordBreakerHighlight[];
    unsoldByCategory: UnsoldCategorySummary[];
  };
}

export interface PostMortemDebriefProps {
  tournamentId: number;
  className?: string;
}

export function PostMortemDebrief({ tournamentId, className = "" }: PostMortemDebriefProps) {
  const { toast } = useToast();
  const [report, setReport] = useState<PostMortemReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"moneyball" | "highlights" | "categories">("moneyball");
  const [downloading, setDownloading] = useState<"csv" | "pdf" | "json" | null>(null);

  const fetchDebrief = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/intelligence/post-mortem/${tournamentId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        // Fallback to alternate route if needed
        const altRes = await fetch(`/api/tournaments/${tournamentId}/intelligence/post-mortem`, {
          credentials: "include",
        });
        if (!altRes.ok) {
          throw new Error(`Failed to load post-auction debrief (${res.status})`);
        }
        const data = await altRes.json();
        setReport(data);
        return;
      }
      const data = await res.json();
      setReport(data);
    } catch (e: any) {
      setError(e?.message || "Could not load post-auction debrief");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchDebrief();
  }, [fetchDebrief]);

  const handleDownload = async (format: "csv" | "pdf" | "json") => {
    if (!tournamentId) return;
    setDownloading(format);
    try {
      const url = `/api/intelligence/post-mortem/${tournamentId}/export?format=${format}`;
      let res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        // Fallback to alternate route if needed
        const altUrl = `/api/tournaments/${tournamentId}/intelligence/post-mortem/export?format=${format}`;
        const altRes = await fetch(altUrl, { credentials: "include" });
        if (altRes.ok) {
          res = altRes;
        } else {
          throw new Error(`Export failed (${res.status})`);
        }
      }

      const blob = await res.blob();
      const filename = `post-mortem-${tournamentId}-${Date.now()}.${format}`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err: any) {
      toast({
        title: "Export Failed",
        description: err?.message || "Failed to download export",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  if (loading && !report) {
    return (
      <div className={`p-6 rounded-xl border border-border bg-card shadow-xs space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className={`p-6 rounded-xl border border-destructive/20 bg-destructive/5 space-y-3 ${className}`}>
        <div className="flex items-center gap-2 text-destructive font-semibold">
          <AlertTriangle className="w-5 h-5" />
          <span>Post-Auction Intelligence Unavailable</span>
        </div>
        <p className="text-xs text-muted-foreground">{error}</p>
        <Button size="sm" variant="outline" onClick={fetchDebrief} className="gap-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Retry Intelligence Sync
        </Button>
      </div>
    );
  }

  if (!report) return null;

  const { marketOverview, moneyballIndex, highlights } = report;

  return (
    <div
      className={`rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden transition-all duration-200 ${className}`}
      data-testid="post-mortem-debrief"
    >
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-border/70 bg-gradient-to-r from-card via-card to-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="w-3.5 h-3.5" /> AI Post-Auction Debrief
            </span>
            <span className="text-xs text-muted-foreground">• Moneyball Efficiency Engine</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Moneyball Squad Efficiency Index & Market Overview
          </h3>
          <p className="text-xs text-muted-foreground">
            Franchise capital deployment, roster completion, market inflation dynamics, and value steals.
          </p>
        </div>

        {/* 1-Click Download Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 flex-1 sm:flex-none border-border"
            onClick={fetchDebrief}
            disabled={loading}
            title="Refresh Debrief Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            variant="default"
            className="h-8 text-xs gap-1.5 flex-1 sm:flex-none bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-xs"
            onClick={() => handleDownload("csv")}
            disabled={downloading !== null}
            data-testid="download-report-btn"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {downloading === "csv" ? "Exporting CSV…" : "Download Report (CSV)"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 hidden md:flex border-border"
            onClick={() => handleDownload("pdf")}
            disabled={downloading !== null}
          >
            <FileText className="w-3.5 h-3.5 text-rose-500" />
            {downloading === "pdf" ? "Rendering PDF…" : "Executive PDF"}
          </Button>
        </div>
      </div>

      {/* Market Overview KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border/60 border-b border-border/70">
        <div className="p-3.5 sm:p-4 bg-card space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-blue-500" /> Total Market Turnover
          </span>
          <p className="text-lg sm:text-xl font-bold text-foreground">
            {formatShortIndianRupee(marketOverview.totalTurnover)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Across {marketOverview.soldCount} concluded sales
          </p>
        </div>

        <div className="p-3.5 sm:p-4 bg-card space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-amber-500" /> Average Inflation
          </span>
          <p className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400">
            +{marketOverview.averageInflationPct}%
          </p>
          <p className="text-[10px] text-muted-foreground">Vs baseline reserve price</p>
        </div>

        <div className="p-3.5 sm:p-4 bg-card space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Clearance Rate
          </span>
          <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {(marketOverview.soldRatio * 100).toFixed(0)}%
          </p>
          <p className="text-[10px] text-muted-foreground">
            {marketOverview.soldCount} sold · {marketOverview.unsoldCount} unsold
          </p>
        </div>

        <div className="p-3.5 sm:p-4 bg-card space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-purple-500" /> Market Cost / Player
          </span>
          <p className="text-lg sm:text-xl font-bold text-foreground">
            {formatShortIndianRupee(marketOverview.tournamentAvgCostPerPlayer)}
          </p>
          <p className="text-[10px] text-muted-foreground">Benchmark player average</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 pt-3 border-b border-border/70 flex items-center gap-2 bg-muted/10">
        <button
          onClick={() => setActiveTab("moneyball")}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "moneyball"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          Moneyball Leaderboard ({moneyballIndex.length} Teams)
        </button>

        <button
          onClick={() => setActiveTab("highlights")}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "highlights"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-rose-500" />
          Marquee Steals & Wars
        </button>

        <button
          onClick={() => setActiveTab("categories")}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "categories"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-blue-500" />
          Category Market Analysis
        </button>
      </div>

      {/* Tab 1: Moneyball Leaderboard Table */}
      {activeTab === "moneyball" && (
        <div className="p-4 sm:p-5 space-y-4" data-testid="moneyball-leaderboard">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" /> Squad Efficiency Rankings
              </h4>
              <p className="text-xs text-muted-foreground">
                Evaluated on cost-per-player discipline (30%), squad completion (40%), and budget deployment (30%).
              </p>
            </div>
            <span className="text-[11px] font-mono font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border">
              Target: {moneyballIndex[0]?.targetSquadSize ?? 11} players
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">Rank</th>
                  <th className="py-2.5 px-3">Franchise</th>
                  <th className="py-2.5 px-3">Squad Progress</th>
                  <th className="py-2.5 px-3">Purse Spent</th>
                  <th className="py-2.5 px-3">Cost / Player</th>
                  <th className="py-2.5 px-3">Budget Deployed</th>
                  <th className="py-2.5 px-3 text-right">Moneyball Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {moneyballIndex.map((team) => {
                  const isLeader = team.rank === 1;
                  const scoreColor =
                    team.efficiencyScore >= 80
                      ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                      : team.efficiencyScore >= 60
                        ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
                        : "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800";

                  const varianceBadge =
                    team.costPerPlayerDiff <= 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
                        <ArrowDownRight className="w-3 h-3" />
                        {Math.abs(team.costPerPlayerVariancePct)}% below avg
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-600 font-medium">
                        <ArrowUpRight className="w-3 h-3" />
                        +{team.costPerPlayerVariancePct}% above avg
                      </span>
                    );

                  return (
                    <tr
                      key={team.teamId}
                      className={`hover:bg-muted/30 transition-colors ${isLeader ? "bg-amber-500/5 font-medium" : ""}`}
                    >
                      <td className="py-3 px-3 text-center">
                        {isLeader ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white font-bold text-[11px] shadow-xs">
                            #1
                          </span>
                        ) : (
                          <span className="font-mono font-semibold text-muted-foreground">
                            #{team.rank}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: team.color || "#64748b" }}
                          />
                          <div>
                            <span className="font-semibold text-foreground text-xs">{team.teamName}</span>
                            <span className="ml-1.5 text-[10px] font-mono text-muted-foreground uppercase">
                              [{team.shortCode}]
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono font-semibold text-foreground">
                              {team.playersBought} / {team.targetSquadSize}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {(team.squadCompletionRate * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                team.squadCompletionRate >= 1
                                  ? "bg-emerald-500"
                                  : team.squadCompletionRate >= 0.7
                                    ? "bg-blue-500"
                                    : "bg-amber-500"
                              }`}
                              style={{ width: `${Math.min(100, team.squadCompletionRate * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono text-xs text-foreground">
                          {formatShortIndianRupee(team.totalSpent)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatShortIndianRupee(team.remainingPurse)} left
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono text-xs font-semibold text-foreground">
                          {formatShortIndianRupee(team.costPerPlayer)}
                        </div>
                        {team.playersBought > 0 && varianceBadge}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {(team.budgetDeploymentRate * 100).toFixed(1)}%
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                              team.budgetDeploymentRate >= 0.8 && team.budgetDeploymentRate <= 1.0
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : team.budgetDeploymentRate > 1.0
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {team.budgetDeploymentRate >= 0.8 && team.budgetDeploymentRate <= 1.0
                              ? "Optimal"
                              : team.budgetDeploymentRate > 1.0
                                ? "Deficit"
                                : "Hoarded"}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-bold font-mono ${scoreColor}`}
                        >
                          {team.efficiencyScore}
                          <span className="text-[10px] font-normal opacity-80">/100</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Marquee Steals & Record Breakers */}
      {activeTab === "highlights" && (
        <div className="p-4 sm:p-5 space-y-6">
          {/* Top 5 Bargain Steals */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-500" /> Top 5 Bargain Steals (Lowest Multiplier with High Bids)
              </h4>
              <span className="text-[11px] text-muted-foreground">High-value acquisitions at low escalation</span>
            </div>

            {highlights.topBargainSteals.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 border border-border rounded-lg bg-muted/20">
                No bargain steals recorded yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {highlights.topBargainSteals.map((b, idx) => (
                  <div
                    key={b.playerId}
                    className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-300">
                          Steal #{idx + 1} · {b.multiplier}x Base
                        </span>
                        <h5 className="text-sm font-bold text-foreground mt-1">{b.playerName}</h5>
                        <p className="text-[11px] text-muted-foreground">
                          {b.role || "Player"} · {b.categoryName || "General"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-400">
                          {formatShortIndianRupee(b.finalAmount)}
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          Base: {formatShortIndianRupee(b.basePrice)}
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-emerald-500/10 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        Won by: <strong className="text-foreground">{b.teamName || "Unassigned"}</strong>
                      </span>
                      <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400">
                        {b.totalBids} bids contested
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top 5 Record Breakers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-rose-500" /> Top 5 Record Breakers & Fiercest Bidding Wars
              </h4>
              <span className="text-[11px] text-muted-foreground">Highest auction price points & escalation</span>
            </div>

            {highlights.topRecordBreakers.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 border border-border rounded-lg bg-muted/20">
                No record breakers recorded yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {highlights.topRecordBreakers.map((w, idx) => (
                  <div
                    key={w.playerId}
                    className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-2 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-300">
                          Top Lot #{idx + 1} · +{w.inflationPct}% Escalation
                        </span>
                        <h5 className="text-sm font-bold text-foreground mt-1">{w.playerName}</h5>
                        <p className="text-[11px] text-muted-foreground">
                          {w.role || "Player"} · {w.categoryName || "General"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold font-mono text-rose-700 dark:text-rose-400">
                          {formatShortIndianRupee(w.finalAmount)}
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          +{formatShortIndianRupee(w.escalation)} above base
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-rose-500/10 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        Acquired by: <strong className="text-foreground">{w.teamName || "Unassigned"}</strong>
                      </span>
                      <span className="font-mono font-medium text-rose-700 dark:text-rose-400">
                        {w.totalBids} furious bids
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Category Market Analysis & Unsold Breakdown */}
      {activeTab === "categories" && (
        <div className="p-4 sm:p-5 space-y-6">
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-500" /> Category Spend & Inflation Dynamics
            </h4>

            <div className="overflow-x-auto rounded-xl border border-border/80 bg-card">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Lots</th>
                    <th className="py-2 px-3">Sold</th>
                    <th className="py-2 px-3">Unsold</th>
                    <th className="py-2 px-3">Total Spend</th>
                    <th className="py-2 px-3">Avg Sold Price</th>
                    <th className="py-2 px-3 text-right">Inflation %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {marketOverview.categoryBreakdown.map((cat, i) => (
                    <tr key={cat.categoryId ?? i} className="hover:bg-muted/30">
                      <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: cat.colorCode || "#3b82f6" }}
                        />
                        {cat.categoryName}
                      </td>
                      <td className="py-2.5 px-3 font-mono">{cat.lotCount}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-600 font-semibold">{cat.soldCount}</td>
                      <td className="py-2.5 px-3 font-mono text-rose-600">{cat.unsoldCount}</td>
                      <td className="py-2.5 px-3 font-mono">{formatShortIndianRupee(cat.totalSpent)}</td>
                      <td className="py-2.5 px-3 font-mono">{formatShortIndianRupee(cat.averageSoldPrice)}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-right text-amber-600">
                        +{cat.inflationPct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unsold Lots Summary */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Unsold Lots by Category
            </h4>

            {highlights.unsoldByCategory.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 border border-border rounded-lg bg-muted/20">
                100% clearance achieved — zero unsold players!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {highlights.unsoldByCategory.map((u, i) => (
                  <div
                    key={u.categoryId ?? i}
                    className="p-3.5 rounded-xl border border-border bg-muted/10 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: u.colorCode || "#64748b" }}
                        />
                        {u.categoryName}
                      </span>
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded border border-rose-200">
                        {u.unsoldCount} Unsold
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Unallocated Reserve Value:{" "}
                      <strong className="text-foreground font-mono">
                        {formatShortIndianRupee(u.totalBasePrice)}
                      </strong>
                    </div>

                    <div className="pt-2 border-t border-border/60">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">Sample Lots:</p>
                      <div className="flex flex-wrap gap-1">
                        {u.samplePlayers.map((p) => (
                          <span
                            key={p.id}
                            className="text-[10px] px-2 py-0.5 rounded bg-card border border-border text-foreground"
                          >
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
