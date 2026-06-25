import { useState, useEffect, useCallback, useRef } from "react";
import { useAdminAuth } from "@/hooks/use-auth";
import { AdminShell } from "@/components/admin-shell";
import { useLocation } from "wouter";
import { formatShortIndianRupee } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Search, Trophy, Users, Zap, TrendingUp,
  ChevronRight, ArrowLeft, Clock, Target, Flame, Award,
  RefreshCw, BarChart2, Gavel, Eye, Timer, X,
  PlayCircle, Radio, Brain, Layers, Filter, Database,
  AlertTriangle, Info, CheckCircle, ChevronLeft, ChevronDown,
  Radar, GitBranch, Tag, Download, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TournamentRow { id: number; name: string; sport: string; status: string }
interface TournamentIntel {
  totalBids: number; avgResponseMs: number | null;
  hottestPlayer: { player_id: number; player_name: string; bid_count: number } | null;
  fastestTeam: { team_id: number; team_name: string; team_color: string; avg_response_ms: number; total_bids: number } | null;
  biggestInflation: { player_name: string; final_amount: number; base_price: number; inflation_pct: number; sold_to_team_name: string } | null;
  outcomes: Record<string, number>; soldPct: number; unsoldPct: number; deferredPct: number; totalConcluded: number;
}
interface ReplayEvent {
  event_type: string; timestamp: string; player_id: number | null; player_name: string | null;
  team_id: number | null; team_name: string | null; team_color: string | null; short_code: string | null;
  bid_amount: number | null; bid_sequence_number: number | null; milliseconds_since_last_bid: number | null;
  outcome: string | null; category_name: string | null;
  timer_type?: string | null; timer_seconds?: number | null; triggered_by?: string | null;
}
interface ReplayResponse {
  events: ReplayEvent[];
  nextAfter: string | null;
  hasMore: boolean;
}
interface DemandRow {
  player_id: number; player_name: string; player_role: string | null;
  base_price: number | null; final_amount: number | null; outcome: string;
  total_bids: number; competition_score: number; duration_secs: number;
  avg_secs_between: number; inflation_pct: number | null; demand_score: number;
}
interface BehaviorRow {
  team_id: number; team_name: string; team_color: string | null; short_code: string | null;
  purse: number; purse_used: number; total_bids: number; unique_players: number;
  avg_response_ms: number | null; min_response_ms: number | null;
  purse_used_pct: number; bids_per_player: number;
  category_focus: Array<{ cat_name: string; color_code: string | null; cat_bids: number }>;
  top_category: { cat_name: string; color_code: string | null } | null;
  cat_concentration: number; behavior_labels: string[];
}
interface ObservationNote { type: string; headline: string; detail: string }
interface EventRow {
  event_type: string; timestamp: string; player_id: number | null; player_name: string | null;
  team_id: number | null; team_name: string | null; team_color: string | null;
  amount: number | null; bid_sequence_number: number | null; latency_ms: number | null;
  outcome: string | null; tournament_id: number;
}
interface PlayerRow {
  identity_key: string;
  global_player_id: string | null;
  player_id: number; player_name: string; player_role: string | null; sport: string;
  total_auctions: number; avg_sold_value: number | null; max_sold_value: number | null;
  total_bids_received: number | null; avg_bids_per_auction: number | null; tournament_count: number;
}
interface PlayerDetail {
  globalPlayerId: string | null;
  playerId: number | null;
  auctions: Array<{ id: number; tournament_id: number; tournament_name: string; outcome: string; final_amount: number | null; total_bids_received: number | null; base_price: number | null; sold_to_team_name: string | null; auction_duration_seconds: number | null; player_name: string }>;
  bidTimeline: Array<{ bid_amount: number; bid_sequence_number: number; milliseconds_since_last_bid: number | null; timer_remaining_seconds: number | null; timestamp: string; tournament_id: number; tournament_name?: string | null; team_name: string | null; team_color: string | null; short_code: string | null }>;
  interestedTeams: Array<{ team_name: string; team_color: string | null; bid_count: number }>;
}
interface IntelFilters {
  tournamentId: string;
  categoryId: string;
  teamId: string;
}
interface FilterOptions {
  categories: Array<{ id: number; name: string; color_code: string | null }>;
  teams: Array<{ id: number; name: string; color: string | null; short_code: string | null }>;
}
interface IntensityPlayer {
  player_id: number; player_name: string; total_bids: number; team_count: number;
  escalation_curve: number[]; escalation_pct: number; intensity_score: number;
  early_avg_ms: number | null; mid_avg_ms: number | null; late_avg_ms: number | null;
  outcome: string | null; final_amount: number | null; base_price: number | null;
  badges: string[];
}
interface IntensityResponse {
  players: IntensityPlayer[];
  maxIntensity: number;
  spotlight: {
    mostWanted: IntensityPlayer | null;
    fastestEscalation: IntensityPlayer | null;
    biggestSurprise: IntensityPlayer | null;
  };
}
interface LiveIntel {
  latestTimestamp: string | null;
  windowMinutes: number;
  bidsInWindow: number;
  bidsLastMinute: number;
  bidsPerMinute: number;
  intensityLevel: "idle" | "low" | "warm" | "hot";
  activeTeams: Array<{ team_id: number; team_name: string; team_color: string | null; short_code: string | null; recent_bids: number; avg_response_ms: number | null }>;
  lastBid: { bid_amount: number; timestamp: string; player_name: string | null; team_name: string | null; team_color: string | null; short_code: string | null; milliseconds_since_last_bid: number | null } | null;
  hottestPlayer: { player_id: number; player_name: string; recent_bids: number } | null;
}
interface IntelArchive {
  id: number;
  sourceTournamentId: number;
  tournamentName: string;
  tournamentSport: string;
  archivedAt: string;
  bidEventCount: number;
  playerEventCount: number;
  timerEventCount: number;
}
interface CrossSportRow {
  sport: string;
  totalBids: number;
  tournaments: number;
  avgResponseMs: number | null;
  sold: number;
  unsold: number;
  avgSold: number | null;
  avgBidsPerPlayer: number | null;
  archivedTournaments: number;
}
interface IntelligenceBriefing {
  summary: string;
  sections: Array<{ title: string; body: string }>;
  observations: ObservationNote[];
  generatedBy: "template" | "llm";
  disclaimer: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
function fms(ms: number | null | undefined): string {
  if (ms == null) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
function fCr(v: number | null | undefined): string {
  if (v == null) return "—";
  return formatShortIndianRupee(v);
}
function relTime(ts: string): string {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}
function clockTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function labelColor(label: string): string {
  if (label.includes("Aggressive")) return "#ef4444";
  if (label.includes("Patient")) return "#22c55e";
  if (label.includes("Strategic")) return "#3b82f6";
  if (label.includes("Persistent")) return "#f97316";
  if (label.includes("Selective")) return "#8b5cf6";
  if (label.includes("Early")) return "#f59e0b";
  if (label.includes("Late")) return "#06b6d4";
  if (label.includes("Hunter")) return "#ec4899";
  if (label.includes("Spender")) return "#dc2626";
  if (label.includes("Conserver")) return "#16a34a";
  return "#64748b";
}
function obsIcon(type: string) {
  if (type === "warning") return AlertTriangle;
  if (type === "strategy") return Target;
  if (type === "pattern") return GitBranch;
  return Info;
}
function obsColor(type: string): string {
  if (type === "warning") return "#f59e0b";
  if (type === "strategy") return "#3b82f6";
  if (type === "pattern") return "#8b5cf6";
  return "#22d3ee";
}
function intelQueryParams(filters: IntelFilters): string {
  const qs = new URLSearchParams();
  if (filters.categoryId) qs.set("categoryId", filters.categoryId);
  if (filters.teamId) qs.set("teamId", filters.teamId);
  const s = qs.toString();
  return s ? `?${s}` : "";
}
function liveIntensityColor(level: LiveIntel["intensityLevel"]): string {
  if (level === "hot") return "#ef4444";
  if (level === "warm") return "#f97316";
  if (level === "low") return "#22c55e";
  return "#64748b";
}
async function downloadCsv(path: string): Promise<void> {
  const res = await fetch(`/api${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? "intelligence-export.csv";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function ColorDot({ color, size = 8 }: { color: string | null | undefined; size?: number }) {
  return (
    <span className="inline-block rounded-full flex-shrink-0 border border-white/10"
      style={{ width: size, height: size, background: color ?? "#555" }} />
  );
}

function MetricCard({ label, value, sub, icon: Icon, accent = "cyan" }: {
  label: string; value: string | number; sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "cyan" | "green" | "amber" | "red" | "purple" | "blue";
}) {
  const colors: Record<string, string> = {
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    green: "text-green-400 bg-green-500/10 border-green-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  };
  return (
    <div className={`rounded-xl border p-3.5 flex flex-col gap-1.5 ${colors[accent] ?? colors.cyan}`}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 opacity-70" />}
        <span className="text-[10px] uppercase tracking-widest opacity-70 font-medium">{label}</span>
      </div>
      <span className="text-xl font-black leading-none">{value}</span>
      {sub && <span className="text-[10px] opacity-60">{sub}</span>}
    </div>
  );
}

function SpotlightCard({ title, icon: Icon, accentColor = "#22d3ee", children, empty }: {
  title: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accentColor?: string; children?: React.ReactNode; empty?: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-card/60 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">{title}</span>
      </div>
      {children ?? <p className="text-xs text-muted-foreground/50">{empty ?? "No data yet"}</p>}
    </div>
  );
}

function OutcomePill({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-xs text-muted-foreground w-20">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono font-bold" style={{ color }}>{pct}%</span>
      <span className="text-[10px] text-muted-foreground/50">({count})</span>
    </div>
  );
}

function TournamentSelector({ tournaments, value, onChange, placeholder = "Select tournament..." }: {
  tournaments: TournamentRow[]; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-72 h-9 text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {tournaments.map(t => (
          <SelectItem key={t.id} value={String(t.id)}>
            <span>{t.name}</span>
            <Badge variant="outline" className="ml-2 text-[9px] uppercase h-4">{t.status}</Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function GlobalFilterBar({
  tournaments,
  filters,
  filterOptions,
  optionsLoading,
  onChange,
  onRefresh,
  refreshing,
  onExport,
  exporting,
}: {
  tournaments: TournamentRow[];
  filters: IntelFilters;
  filterOptions: FilterOptions | null;
  optionsLoading: boolean;
  onChange: (next: Partial<IntelFilters>) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  onExport: (dataset: "all" | "bids" | "players" | "timers") => void;
  exporting?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap rounded-xl border border-white/8 bg-card/40 px-4 py-3">
      <Filter className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
      <TournamentSelector
        tournaments={tournaments}
        value={filters.tournamentId}
        onChange={v => onChange({ tournamentId: v, categoryId: "", teamId: "" })}
        placeholder="Select tournament..."
      />
      <Select
        value={filters.categoryId || "all"}
        onValueChange={v => onChange({ categoryId: v === "all" ? "" : v })}
        disabled={!filters.tournamentId || optionsLoading}
      >
        <SelectTrigger className="w-44 h-9 text-sm">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {(filterOptions?.categories ?? []).map(c => (
            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.teamId || "all"}
        onValueChange={v => onChange({ teamId: v === "all" ? "" : v })}
        disabled={!filters.tournamentId || optionsLoading}
      >
        <SelectTrigger className="w-44 h-9 text-sm">
          <SelectValue placeholder="All teams" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All teams</SelectItem>
          {(filterOptions?.teams ?? []).map(t => (
            <SelectItem key={t.id} value={String(t.id)}>{t.short_code ?? t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {filters.tournamentId && (
        <>
          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={onRefresh}>
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Select onValueChange={v => onExport(v as "all" | "bids" | "players" | "timers")} disabled={exporting}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <Download className="w-3.5 h-3.5 mr-1.5 opacity-60" />
              <SelectValue placeholder="Export CSV" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All datasets</SelectItem>
              <SelectItem value="bids">Bids only</SelectItem>
              <SelectItem value="players">Players only</SelectItem>
              <SelectItem value="timers">Timers only</SelectItem>
            </SelectContent>
          </Select>
        </>
      )}
    </div>
  );
}

function EscalationSparkline({ values, color = "#22d3ee" }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible flex-shrink-0">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SkeletonRows({ n = 5 }: { n?: number }) {
  return <div className="flex flex-col gap-2">{Array.from({ length: n }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>;
}

function EmptyState({ icon: Icon, msg }: { icon?: React.ComponentType<{ className?: string }>; msg: string }) {
  const I = Icon ?? BarChart2;
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
      <I className="w-10 h-10 opacity-15" />
      <p className="text-sm">{msg}</p>
    </div>
  );
}

// ─── Inline Sparkline (CSS only) ──────────────────────────────────────────────

function IntensityBar({ score, max, color = "#22d3ee" }: { score: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((score / max) * 100, 100) : 0;
  const glow = pct > 70;
  return (
    <div className="h-1.5 rounded-full bg-white/5 overflow-visible relative">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`, background: color,
          boxShadow: glow ? `0 0 6px ${color}60` : undefined,
        }}
      />
    </div>
  );
}

function HeatDot({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? score / max : 0;
  const color = pct > 0.7 ? "#ef4444" : pct > 0.4 ? "#f97316" : pct > 0.15 ? "#f59e0b" : "#64748b";
  const label = pct > 0.7 ? "HOT" : pct > 0.4 ? "WARM" : pct > 0.15 ? "MILD" : "LOW";
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
      style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────

function OverviewTab({ filters, refreshKey }: { filters: IntelFilters; refreshKey: number }) {
  const tid = filters.tournamentId;
  const [data, setData] = useState<TournamentIntel | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!tid) return;
    setLoading(true);
    try { setData(await apiFetch(`/intelligence/tournament/${tid}${intelQueryParams(filters)}`)); }
    catch { setData(null); }
    finally { setLoading(false); }
  }, [tid, filters.categoryId, filters.teamId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <div className="flex flex-col gap-5">
      {!tid && <EmptyState icon={BarChart2} msg="Select a tournament to load intelligence" />}
      {tid && loading && <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>}
      {tid && !loading && data && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="Total Bids" value={data.totalBids.toLocaleString("en-IN")} icon={Gavel} accent="cyan" />
            <MetricCard label="Avg Response" value={fms(data.avgResponseMs)} icon={Clock} accent="purple" sub="between bids" />
            <MetricCard label="Sold" value={`${data.soldPct}%`} icon={Award} accent="green" sub={`${data.outcomes.sold ?? 0} players`} />
            <MetricCard label="Unsold" value={`${data.unsoldPct}%`} icon={X} accent="red" sub={`${data.outcomes.unsold ?? 0} players`} />
            <MetricCard label="Deferred" value={`${data.deferredPct}%`} icon={Timer} accent="amber" sub={`${data.outcomes.deferred ?? 0} players`} />
            <MetricCard label="Concluded" value={data.totalConcluded.toLocaleString("en-IN")} icon={Trophy} accent="cyan" sub="players" />
          </div>
          <div className="rounded-xl border border-white/8 bg-card/60 p-4 flex flex-col gap-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Outcome Breakdown</p>
            <OutcomePill label="Sold" count={data.outcomes.sold ?? 0} pct={data.soldPct} color="#22c55e" />
            <OutcomePill label="Unsold" count={data.outcomes.unsold ?? 0} pct={data.unsoldPct} color="#ef4444" />
            <OutcomePill label="Deferred" count={data.outcomes.deferred ?? 0} pct={data.deferredPct} color="#f59e0b" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SpotlightCard title="Most Contested Player" icon={Flame} accentColor="#f97316">
              {data.hottestPlayer ? (
                <div className="flex flex-col gap-1">
                  <p className="text-base font-bold text-white">{data.hottestPlayer.player_name}</p>
                  <p className="text-xs text-muted-foreground">{data.hottestPlayer.bid_count.toLocaleString("en-IN")} bids received</p>
                  <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-orange-500 w-full" />
                  </div>
                </div>
              ) : null}
            </SpotlightCard>
            <SpotlightCard title="Fastest Bidding Team" icon={Zap} accentColor="#a855f7">
              {data.fastestTeam ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <ColorDot color={data.fastestTeam.team_color} size={10} />
                    <p className="text-base font-bold text-white">{data.fastestTeam.team_name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Avg: <span className="text-purple-400 font-mono font-bold">{fms(data.fastestTeam.avg_response_ms)}</span></p>
                  <p className="text-xs text-muted-foreground">{data.fastestTeam.total_bids.toLocaleString("en-IN")} bids placed</p>
                </div>
              ) : null}
            </SpotlightCard>
            <SpotlightCard title="Biggest Inflation Sale" icon={TrendingUp} accentColor="#22d3ee">
              {data.biggestInflation ? (
                <div className="flex flex-col gap-1">
                  <p className="text-base font-bold text-white">{data.biggestInflation.player_name}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>{fCr(data.biggestInflation.base_price)}</span>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-green-400 font-bold">{fCr(data.biggestInflation.final_amount)}</span>
                  </div>
                  <Badge className="w-fit mt-1 text-[10px] bg-cyan-500/15 text-cyan-400 border-cyan-500/30">
                    +{data.biggestInflation.inflation_pct}% above base
                  </Badge>
                </div>
              ) : null}
            </SpotlightCard>
          </div>
        </motion.div>
      )}
      {tid && !loading && !data && <EmptyState msg="No intelligence data for this tournament yet." />}
    </div>
  );
}

// ─── REPLAY TAB ───────────────────────────────────────────────────────────────

type ReplayGroup =
  | { kind: "start"; ts: string; playerName: string; categoryName: string | null; playerId: number | null }
  | { kind: "bid"; ts: string; teamName: string | null; teamColor: string | null; shortCode: string | null; amount: number; seq: number; latencyMs: number | null }
  | { kind: "burst"; ts: string; bids: ReplayEvent[] }
  | { kind: "timer"; ts: string; action: string; playerName: string | null; timerSeconds: number | null; timerType: string | null; triggeredBy: string | null }
  | { kind: "outcome"; ts: string; outcome: string; playerName: string; amount: number | null; teamName: string | null };

function groupReplay(events: ReplayEvent[]): ReplayGroup[] {
  const groups: ReplayGroup[] = [];
  let i = 0;
  while (i < events.length) {
    const ev = events[i]!;
    if (ev.event_type === "player_start") {
      groups.push({ kind: "start", ts: ev.timestamp, playerName: ev.player_name ?? "?", categoryName: ev.category_name, playerId: ev.player_id });
      i++;
    } else if (ev.event_type?.startsWith("timer_")) {
      groups.push({
        kind: "timer",
        ts: ev.timestamp,
        action: ev.event_type.replace("timer_", ""),
        playerName: ev.player_name,
        timerSeconds: ev.timer_seconds ?? null,
        timerType: ev.timer_type ?? null,
        triggeredBy: ev.triggered_by ?? null,
      });
      i++;
    } else if (ev.event_type === "bid") {
      // Collect consecutive rapid bids (< 3s apart) on the same player
      const burstBids: ReplayEvent[] = [ev];
      let j = i + 1;
      while (j < events.length) {
        const next = events[j]!;
        if (next.event_type !== "bid" || next.player_id !== ev.player_id) break;
        if ((next.milliseconds_since_last_bid ?? 99999) > 3000) break;
        burstBids.push(next);
        j++;
      }
      if (burstBids.length >= 4) {
        groups.push({ kind: "burst", ts: ev.timestamp, bids: burstBids });
        i = j;
      } else {
        groups.push({ kind: "bid", ts: ev.timestamp, teamName: ev.team_name, teamColor: ev.team_color, shortCode: ev.short_code, amount: ev.bid_amount ?? 0, seq: ev.bid_sequence_number ?? 0, latencyMs: ev.milliseconds_since_last_bid });
        i++;
      }
    } else if (ev.event_type?.startsWith("player_")) {
      const outcome = ev.outcome ?? ev.event_type.replace("player_", "");
      groups.push({ kind: "outcome", ts: ev.timestamp, outcome, playerName: ev.player_name ?? "?", amount: ev.bid_amount, teamName: ev.team_name });
      i++;
    } else {
      i++;
    }
  }
  return groups;
}

function ReplayDot({ kind, outcome, color }: { kind: string; outcome?: string; color?: string | null }) {
  const c = kind === "start" ? "#22d3ee"
    : kind === "burst" ? "#f97316"
    : kind === "timer" ? "#a855f7"
    : kind === "outcome" ? (outcome === "sold" ? "#22c55e" : outcome === "unsold" ? "#ef4444" : "#f59e0b")
    : color ?? "#64748b";
  return (
    <div className="w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 mt-1"
      style={{ borderColor: c, background: `${c}30`, boxShadow: `0 0 6px ${c}50` }} />
  );
}

function ReplayTab({ filters, refreshKey }: { filters: IntelFilters; refreshKey: number }) {
  const tid = filters.tournamentId;
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextAfter, setNextAfter] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (after?: string | null) => {
    if (!tid) return;
    const isMore = !!after;
    if (isMore) setLoadingMore(true);
    else setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "400" });
      if (after) qs.set("after", after);
      const data = await apiFetch<ReplayResponse>(`/intelligence/replay/${tid}?${qs}`);
      setEvents(prev => (isMore ? [...prev, ...data.events] : data.events));
      setNextAfter(data.nextAfter);
      setHasMore(data.hasMore);
    } catch {
      if (!isMore) setEvents([]);
      setNextAfter(null);
      setHasMore(false);
    } finally {
      if (isMore) setLoadingMore(false);
      else setLoading(false);
    }
  }, [tid]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const groups = groupReplay(events);

  return (
    <div className="flex flex-col gap-4">
      {events.length > 0 && (
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
          {events.length} events · {groups.length} segments
        </span>
      )}

      {!tid && <EmptyState icon={PlayCircle} msg="Select a tournament to replay the auction" />}
      {tid && loading && <SkeletonRows n={8} />}
      {tid && !loading && events.length === 0 && <EmptyState msg="No auction events recorded for this tournament yet." />}

      {tid && !loading && groups.length > 0 && (
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="flex flex-col pr-2 pb-4">
            {groups.map((g, idx) => (
              <div key={idx} className="flex gap-3 min-h-0">
                {/* Timeline line */}
                <div className="flex flex-col items-center flex-shrink-0" style={{ width: 20 }}>
                  <ReplayDot kind={g.kind} outcome={g.kind === "outcome" ? g.outcome : undefined} color={g.kind === "bid" ? g.teamColor : undefined} />
                  {idx < groups.length - 1 && (
                    <div className="w-px flex-1 bg-white/5 mt-0.5 mb-0" />
                  )}
                </div>

                {/* Event content */}
                <div className="flex-1 pb-3">
                  {g.kind === "start" && (
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[10px] font-mono text-muted-foreground/50 flex-shrink-0">{clockTime(g.ts)}</span>
                      <span className="text-xs font-bold text-cyan-400">{g.playerName}</span>
                      <span className="text-[10px] text-muted-foreground">entered the block</span>
                      {g.categoryName && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground/60 uppercase tracking-widest">{g.categoryName}</span>
                      )}
                    </div>
                  )}

                  {g.kind === "bid" && (
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[10px] font-mono text-muted-foreground/50 flex-shrink-0">{clockTime(g.ts)}</span>
                      <span className="text-[10px] text-muted-foreground/40">#{g.seq}</span>
                      <span className="text-xs font-semibold" style={{ color: g.teamColor ?? "#fff" }}>
                        {g.shortCode ?? g.teamName}
                      </span>
                      <span className="text-xs text-white font-mono">{fCr(g.amount)}</span>
                      {g.latencyMs != null && (
                        <span className={`text-[10px] font-mono ${g.latencyMs < 2000 ? "text-red-400" : g.latencyMs < 5000 ? "text-amber-400" : "text-muted-foreground/40"}`}>
                          +{fms(g.latencyMs)}
                        </span>
                      )}
                    </div>
                  )}

                  {g.kind === "burst" && (
                    <div className="flex items-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-1.5 flex-wrap">
                      <Zap className="w-3 h-3 text-orange-400 flex-shrink-0" />
                      <span className="text-[10px] text-orange-400 font-bold uppercase tracking-widest">Bid War Burst</span>
                      <span className="text-[10px] text-muted-foreground">{g.bids.length} bids —</span>
                      <div className="flex gap-1 flex-wrap">
                        {Array.from(new Set(g.bids.map(b => b.team_name))).map(n => (
                          <span key={n} className="text-[10px] font-mono text-white/70">{n ?? "?"}</span>
                        ))}
                      </div>
                      <span className="text-[10px] font-mono text-white ml-auto">{fCr(g.bids[g.bids.length - 1]?.bid_amount)}</span>
                    </div>
                  )}

                  {g.kind === "timer" && (
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[10px] font-mono text-muted-foreground/50 flex-shrink-0">{clockTime(g.ts)}</span>
                      <Timer className="w-3 h-3 text-purple-400" />
                      <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">
                        Timer {g.action.replace("_", " ")}
                      </span>
                      {g.timerSeconds != null && (
                        <span className="text-[10px] font-mono text-white/80">{g.timerSeconds}s</span>
                      )}
                      {g.timerType && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground/60 uppercase">{g.timerType}</span>
                      )}
                      {g.playerName && g.playerName !== "?" && (
                        <span className="text-[10px] text-muted-foreground">· {g.playerName}</span>
                      )}
                      {g.triggeredBy && (
                        <span className="text-[9px] text-muted-foreground/40">({g.triggeredBy})</span>
                      )}
                    </div>
                  )}

                  {g.kind === "outcome" && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono text-muted-foreground/50">{clockTime(g.ts)}</span>
                      <span className={`text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                        g.outcome === "sold" ? "bg-green-500/15 text-green-400 border border-green-500/30"
                        : g.outcome === "unsold" ? "bg-red-500/15 text-red-400 border border-red-500/30"
                        : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      }`}>
                        {g.outcome.toUpperCase()}
                      </span>
                      {g.outcome === "sold" && g.amount != null && (
                        <span className="text-xs text-green-400 font-mono font-bold">{fCr(g.amount)}</span>
                      )}
                      {g.outcome === "sold" && g.teamName && (
                        <span className="text-[10px] text-muted-foreground">to {g.teamName}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {hasMore && (
              <div className="flex justify-center pt-4 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loadingMore}
                  onClick={() => load(nextAfter)}
                  className="text-xs"
                >
                  {loadingMore ? "Loading…" : "Load more events"}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ─── DEMAND TAB ───────────────────────────────────────────────────────────────

function DemandTab({ filters, refreshKey }: { filters: IntelFilters; refreshKey: number }) {
  const tid = filters.tournamentId;
  const [rows, setRows] = useState<DemandRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!tid) return;
    setLoading(true);
    try { setRows(await apiFetch(`/intelligence/demand/${tid}${intelQueryParams(filters)}`)); }
    catch { setRows([]); }
    finally { setLoading(false); }
  }, [tid, filters.categoryId, filters.teamId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const maxScore = Math.max(...rows.map(r => r.demand_score), 1);
  const mostWanted = rows[0] ?? null;
  const mostContested = [...rows].sort((a, b) => b.competition_score - a.competition_score)[0] ?? null;
  const fastestEsc = [...rows].filter(r => r.duration_secs > 0).sort((a, b) => (a.duration_secs / Math.max(a.total_bids, 1)) - (b.duration_secs / Math.max(b.total_bids, 1)))[0] ?? null;
  const biggestSurprise = [...rows].filter(r => r.inflation_pct != null).sort((a, b) => (b.inflation_pct ?? 0) - (a.inflation_pct ?? 0))[0] ?? null;

  return (
    <div className="flex flex-col gap-5">
      {!tid && <EmptyState icon={Radar} msg="Select a tournament to analyze player demand" />}
      {tid && loading && <SkeletonRows n={8} />}
      {tid && !loading && rows.length === 0 && <EmptyState msg="No concluded players yet — run an auction first." />}

      {tid && !loading && rows.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
          {/* Award banners */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Most Wanted", row: mostWanted, icon: Trophy, color: "#f59e0b", sub: mostWanted ? `Score ${mostWanted.demand_score}` : "—" },
              { label: "Most Contested", row: mostContested, icon: Users, color: "#ef4444", sub: mostContested ? `${mostContested.competition_score} teams` : "—" },
              { label: "Fastest Escalation", row: fastestEsc, icon: Zap, color: "#22d3ee", sub: fastestEsc ? `${fastestEsc.duration_secs}s auction` : "—" },
              { label: "Biggest Surprise", row: biggestSurprise, icon: TrendingUp, color: "#a855f7", sub: biggestSurprise ? `+${biggestSurprise.inflation_pct}% inflation` : "—" },
            ].map(({ label, row, icon: Icon, color, sub }) => (
              <div key={label} className="rounded-xl border p-3.5 flex flex-col gap-2"
                style={{ borderColor: `${color}25`, background: `${color}08` }}>
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                  <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color }}>{label}</span>
                </div>
                <p className="text-sm font-bold text-white truncate">{row?.player_name ?? "—"}</p>
                <p className="text-[10px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>

          {/* Ranked player list */}
          <div className="rounded-xl border border-white/8 bg-card/60 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-white/5 bg-white/2">
              <span className="col-span-1 text-[9px] uppercase tracking-widest text-muted-foreground/50">#</span>
              <span className="col-span-4 text-[9px] uppercase tracking-widest text-muted-foreground/50">Player</span>
              <span className="col-span-3 text-[9px] uppercase tracking-widest text-muted-foreground/50">Demand</span>
              <span className="col-span-2 text-[9px] uppercase tracking-widest text-muted-foreground/50 text-right">Bids</span>
              <span className="col-span-2 text-[9px] uppercase tracking-widest text-muted-foreground/50 text-right">Sold</span>
            </div>
            <ScrollArea className="h-[calc(100vh-400px)]">
              <div className="divide-y divide-white/4">
                {rows.map((row, idx) => (
                  <div key={row.player_id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-white/2 transition-colors">
                    <span className="col-span-1 text-[10px] font-mono text-muted-foreground/40">{idx + 1}</span>
                    <div className="col-span-4 flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-white truncate">{row.player_name}</span>
                      <div className="flex items-center gap-1.5">
                        {row.player_role && <span className="text-[9px] text-muted-foreground/50">{row.player_role}</span>}
                        <HeatDot score={row.demand_score} max={maxScore} />
                      </div>
                    </div>
                    <div className="col-span-3 flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-cyan-400 font-bold">{row.demand_score}</span>
                      <IntensityBar score={row.demand_score} max={maxScore} color={row.outcome === "sold" ? "#22c55e" : "#64748b"} />
                    </div>
                    <span className="col-span-2 text-[10px] font-mono text-right text-muted-foreground">{row.total_bids}</span>
                    <div className="col-span-2 text-right">
                      {row.final_amount != null
                        ? <span className="text-[10px] font-mono text-green-400">{fCr(row.final_amount)}</span>
                        : <span className="text-[10px] text-muted-foreground/40 uppercase">{row.outcome}</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── BEHAVIOR TAB ─────────────────────────────────────────────────────────────

function BehaviorTab({ filters, refreshKey }: { filters: IntelFilters; refreshKey: number }) {
  const tid = filters.tournamentId;
  const [profiles, setProfiles] = useState<BehaviorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<BehaviorRow | null>(null);

  const load = useCallback(async () => {
    if (!tid) return;
    setLoading(true);
    setSelected(null);
    try { setProfiles(await apiFetch(`/intelligence/behavior/${tid}${intelQueryParams(filters)}`)); }
    catch { setProfiles([]); }
    finally { setLoading(false); }
  }, [tid, filters.categoryId, filters.teamId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const maxBids = Math.max(...profiles.map(p => p.total_bids), 1);

  return (
    <div className="flex flex-col gap-4">
      {!tid && <EmptyState icon={Brain} msg="Select a tournament to profile team behavior" />}
      {tid && loading && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>}
      {tid && !loading && profiles.length === 0 && <EmptyState msg="No team bidding activity recorded yet." />}

      {tid && !loading && profiles.length > 0 && (
        <div className="flex gap-4">
          {/* Team grid */}
          <div className={`grid gap-3 flex-shrink-0 ${selected ? "grid-cols-1 w-80" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 flex-1"}`}>
            {profiles.map(p => (
              <motion.button
                key={p.team_id}
                onClick={() => setSelected(s => s?.team_id === p.team_id ? null : p)}
                className={`text-left rounded-xl border p-4 transition-all hover:border-white/20 ${
                  selected?.team_id === p.team_id ? "border-white/25 bg-white/4" : "border-white/8 bg-card/50"
                }`}
              >
                {/* Team header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: p.team_color ?? "#555", boxShadow: `0 0 8px ${p.team_color ?? "#555"}60` }} />
                  <span className="text-xs font-bold text-white truncate flex-1">{p.team_name}</span>
                  {p.short_code && <span className="text-[9px] font-mono text-muted-foreground/50">{p.short_code}</span>}
                </div>

                {/* Behavior labels */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {p.behavior_labels.map(label => (
                    <span key={label} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ color: labelColor(label), background: `${labelColor(label)}15`, border: `1px solid ${labelColor(label)}30` }}>
                      {label}
                    </span>
                  ))}
                  {p.behavior_labels.length === 0 && (
                    <span className="text-[9px] text-muted-foreground/40">Insufficient data</span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground/50">Bids</span>
                    <span className="font-mono text-white">{p.total_bids}</span>
                  </div>
                  <IntensityBar score={p.total_bids} max={maxBids} color={p.team_color ?? "#22d3ee"} />
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className="text-muted-foreground/50">Avg speed</span>
                    <span className={`font-mono ${p.avg_response_ms != null && p.avg_response_ms < 3000 ? "text-red-400" : "text-muted-foreground"}`}>
                      {fms(p.avg_response_ms)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground/50">Purse used</span>
                    <span className="font-mono text-amber-400">{p.purse_used_pct}%</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Detail panel */}
          <AnimatePresence>
            {selected && (
              <motion.div
                key={selected.team_id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                className="flex-1 min-w-0"
              >
                <div className="rounded-xl border border-white/10 bg-card/60 p-5 flex flex-col gap-5 h-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                        style={{ background: `${selected.team_color ?? "#555"}20`, color: selected.team_color ?? "#fff", border: `1px solid ${selected.team_color ?? "#555"}40` }}>
                        {selected.short_code ?? "?"}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">{selected.team_name}</h3>
                        <p className="text-[10px] text-muted-foreground">{selected.total_bids} total bids · {selected.unique_players} players</p>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelected(null)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {selected.behavior_labels.map(l => (
                      <span key={l} className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ color: labelColor(l), background: `${labelColor(l)}15`, border: `1px solid ${labelColor(l)}30` }}>
                        {l}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <MetricCard label="Total Bids" value={selected.total_bids} icon={Gavel} accent="cyan" />
                    <MetricCard label="Avg Response" value={fms(selected.avg_response_ms)} icon={Clock} accent="purple" />
                    <MetricCard label="Fastest" value={fms(selected.min_response_ms)} icon={Zap} accent="amber" />
                    <MetricCard label="Purse Used" value={`${selected.purse_used_pct}%`} icon={Target} accent="red" />
                  </div>

                  {selected.category_focus.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">Category Focus</p>
                      {selected.category_focus.map(c => {
                        const totalCat = selected.category_focus.reduce((s, x) => s + x.cat_bids, 0);
                        const pct = totalCat > 0 ? Math.round((c.cat_bids / totalCat) * 100) : 0;
                        return (
                          <div key={c.cat_name} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color_code ?? "#555" }} />
                            <span className="text-[10px] text-muted-foreground w-24">{c.cat_name}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color_code ?? "#555" }} />
                            </div>
                            <span className="text-[10px] font-mono text-white">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ─── OBSERVATIONS TAB ─────────────────────────────────────────────────────────

function ObservationsTab({ filters, refreshKey }: { filters: IntelFilters; refreshKey: number }) {
  const tid = filters.tournamentId;
  const [notes, setNotes] = useState<ObservationNote[]>([]);
  const [briefing, setBriefing] = useState<IntelligenceBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);

  const load = useCallback(async () => {
    if (!tid) return;
    setLoading(true);
    setBriefing(null);
    try { setNotes(await apiFetch(`/intelligence/observations/${tid}${intelQueryParams(filters)}`)); }
    catch { setNotes([]); }
    finally { setLoading(false); }
  }, [tid, filters.categoryId, filters.teamId]);

  const loadBriefing = useCallback(async () => {
    if (!tid) return;
    setBriefingLoading(true);
    try { setBriefing(await apiFetch(`/intelligence/briefing/${tid}${intelQueryParams(filters)}`)); }
    catch { setBriefing(null); }
    finally { setBriefingLoading(false); }
  }, [tid, filters.categoryId, filters.teamId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <div className="flex flex-col gap-4">
      {tid && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Observational · Rule-based · No AI predictions
          </span>
          <Button size="sm" variant="outline" className="h-8 text-xs ml-auto" disabled={briefingLoading || loading} onClick={loadBriefing}>
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            {briefingLoading ? "Generating briefing…" : "Generate AI Briefing"}
          </Button>
        </div>
      )}

      {!tid && <EmptyState icon={Brain} msg="Select a tournament to generate behavioral observations" />}
      {tid && loading && <SkeletonRows n={5} />}
      {tid && !loading && notes.length === 0 && <EmptyState msg="No observations available — run an auction first." />}

      {tid && !loading && notes.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
          {briefing && (
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="text-[10px] uppercase tracking-widest text-purple-400 font-medium">
                  Executive Briefing · {briefing.generatedBy === "llm" ? "LLM narrative" : "Template summary"}
                </span>
              </div>
              <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{briefing.summary}</p>
              <p className="text-[10px] text-muted-foreground/50">{briefing.disclaimer}</p>
            </div>
          )}

          {/* Briefing header */}
          <div className="flex items-center gap-2 rounded-lg border border-cyan-500/15 bg-cyan-500/5 px-4 py-2.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-medium">
              Intelligence Briefing — {notes.length} observation{notes.length !== 1 ? "s" : ""} computed
            </span>
          </div>

          {notes.map((note, idx) => {
            const Icon = obsIcon(note.type);
            const color = obsColor(note.type);
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
                className="rounded-xl border p-4 flex gap-3"
                style={{ borderColor: `${color}20`, background: `${color}06` }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-widest font-medium" style={{ color }}>{note.type}</span>
                  </div>
                  <p className="text-sm font-bold text-white leading-snug">{note.headline}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{note.detail}</p>
                </div>
              </motion.div>
            );
          })}

          <div className="mt-2 rounded-lg border border-white/5 bg-white/2 p-3">
            <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
              These insights are computed from auction event data using rule-based pattern detection.
              No ML models, no predictions, no recommendations — observational only.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── EVENTS TAB ───────────────────────────────────────────────────────────────

function EventsTab({ filters, refreshKey }: { filters: IntelFilters; refreshKey: number }) {
  const tid = filters.tournamentId;
  const [eventType, setEventType] = useState("all");
  const [playerSearch, setPlayerSearch] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const LIMIT = 50;

  const buildUrl = useCallback((off: number) => {
    const params = new URLSearchParams();
    if (tid) params.set("tournamentId", tid);
    if (filters.teamId) params.set("teamId", filters.teamId);
    if (eventType !== "all") params.set("eventType", eventType);
    params.set("limit", String(LIMIT));
    params.set("offset", String(off));
    return `/intelligence/events?${params.toString()}`;
  }, [tid, filters.teamId, eventType]);

  const load = useCallback(async (off: number) => {
    if (!tid) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ events: EventRow[]; total: number }>(buildUrl(off));
      setEvents(data.events);
      setTotal(data.total);
      setOffset(off);
    } catch { setEvents([]); setTotal(0); }
    finally { setLoading(false); }
  }, [buildUrl, tid]);

  useEffect(() => { if (tid) load(0); }, [tid, eventType, filters.teamId, refreshKey, load]);

  const filtered = playerSearch
    ? events.filter(e => e.player_name?.toLowerCase().includes(playerSearch.toLowerCase()))
    : events;

  function eventTypeBadge(type: string) {
    if (type === "bid") return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 uppercase">BID</span>;
    if (type === "player_sold") return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20 uppercase">SOLD</span>;
    if (type === "player_unsold") return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 uppercase">UNSOLD</span>;
    if (type === "player_deferred") return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 uppercase">DEFER</span>;
    if (type === "player_start" || type === "player_in_progress") return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 uppercase">START</span>;
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground border border-white/10 uppercase">{type}</span>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Event type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            <SelectItem value="bid">Bids only</SelectItem>
            <SelectItem value="player">Outcomes only</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
            placeholder="Filter by player..." className="pl-9 h-9 text-sm w-48" />
        </div>
        {tid && <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => load(offset)}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>}
        {total > 0 && (
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest ml-auto">
            {total.toLocaleString("en-IN")} events total
          </span>
        )}
      </div>

      {!tid && <EmptyState icon={Database} msg="Select a tournament to explore events" />}
      {tid && loading && <SkeletonRows n={8} />}
      {tid && !loading && events.length === 0 && <EmptyState msg="No events found with current filters." />}

      {tid && !loading && filtered.length > 0 && (
        <div className="flex flex-col gap-0 rounded-xl border border-white/8 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-white/5 bg-white/2">
            {["Time", "Type", "Player", "Team", "Amount", "Latency"].map((h, i) => (
              <span key={h} className={`text-[9px] uppercase tracking-widest text-muted-foreground/50 ${i === 0 ? "col-span-2" : i === 1 ? "col-span-1" : i === 2 ? "col-span-3" : i === 3 ? "col-span-3" : "col-span-2 text-right"}`}>{h}</span>
            ))}
          </div>
          <ScrollArea className="h-[calc(100vh-320px)]">
            <div className="divide-y divide-white/4">
              {filtered.map((ev, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-white/2 transition-colors">
                  <span className="col-span-2 text-[10px] font-mono text-muted-foreground/50">{clockTime(ev.timestamp)}</span>
                  <span className="col-span-1">{eventTypeBadge(ev.event_type)}</span>
                  <span className="col-span-3 text-[10px] text-white truncate">{ev.player_name ?? "—"}</span>
                  <div className="col-span-3 flex items-center gap-1.5">
                    {ev.team_color && <ColorDot color={ev.team_color} size={6} />}
                    <span className="text-[10px] text-muted-foreground truncate">{ev.team_name ?? "—"}</span>
                  </div>
                  <span className="col-span-2 text-[10px] font-mono text-right text-green-400">
                    {ev.amount != null ? fCr(ev.amount) : "—"}
                  </span>
                  <span className={`col-span-1 text-[10px] font-mono text-right ${ev.latency_ms != null && ev.latency_ms < 2000 ? "text-red-400" : ev.latency_ms != null && ev.latency_ms < 5000 ? "text-amber-400" : "text-muted-foreground/40"}`}>
                    {fms(ev.latency_ms)}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 bg-white/2">
            <span className="text-[10px] text-muted-foreground">
              Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
            </span>
            <div className="flex items-center gap-1.5">
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={offset === 0} onClick={() => load(Math.max(0, offset - LIMIT))}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={offset + LIMIT >= total} onClick={() => load(offset + LIMIT)}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PLAYERS TAB ──────────────────────────────────────────────────────────────

function PlayersTab({ filters }: { filters: IntelFilters }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null);
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scopeTid = filters.tournamentId;

  const search = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const tidParam = scopeTid ? `&tournamentId=${scopeTid}` : "";
      setResults(await apiFetch(`/intelligence/players/search?q=${encodeURIComponent(query)}${tidParam}`));
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, [scopeTid]);

  const handleQ = (v: string) => {
    setQ(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(v), 350);
  };

  useEffect(() => {
    if (q) search(q);
  }, [scopeTid, search]);

  const selectPlayer = async (row: PlayerRow) => {
    setSelectedPlayer(row);
    setDetail(null);
    setDetailLoading(true);
    try {
      const qs = row.global_player_id
        ? `globalPlayerId=${encodeURIComponent(row.global_player_id)}`
        : `playerId=${row.player_id}`;
      setDetail(await apiFetch(`/intelligence/players/detail?${qs}`));
    } catch { setDetail(null); }
    finally { setDetailLoading(false); }
  };

  const maxBids = Math.max(...results.map(r => r.total_bids_received ?? 0), 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => handleQ(e.target.value)} placeholder="Search players..."
            className="pl-9 h-9 text-sm" />
        </div>
        {scopeTid && (
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Scoped to selected tournament
          </span>
        )}
      </div>

      <div className="flex gap-4 min-h-0">
        <div className={`flex flex-col gap-1 ${selectedPlayer ? "w-80 flex-shrink-0" : "flex-1"}`}>
          {loading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          {!loading && results.length === 0 && (
            <EmptyState icon={Users} msg={q ? "No players found" : "Start typing to search players"} />
          )}
          {!loading && results.map(row => (
            <motion.button key={row.identity_key} onClick={() => selectPlayer(row)}
              className={`w-full text-left rounded-xl border p-3 transition-all hover:border-cyan-500/40 hover:bg-cyan-500/5 ${
                selectedPlayer?.identity_key === row.identity_key ? "border-cyan-500/50 bg-cyan-500/8" : "border-white/6 bg-card/40"
              }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">{row.player_name}</p>
                    {row.player_role && <Badge variant="outline" className="text-[9px] h-4 px-1 flex-shrink-0">{row.player_role}</Badge>}
                    {row.global_player_id && row.tournament_count > 1 && (
                      <Badge className="text-[9px] h-4 px-1 bg-purple-500/15 text-purple-300 border-purple-500/30">Cross-tournament</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-muted-foreground">{row.tournament_count} tournament{row.tournament_count !== 1 ? "s" : ""}</span>
                    <span className="text-[10px] text-muted-foreground">{row.total_auctions} auction{row.total_auctions !== 1 ? "s" : ""}</span>
                    {row.avg_sold_value != null && <span className="text-[10px] text-green-400 font-mono">{fCr(row.avg_sold_value)} avg</span>}
                  </div>
                  {row.total_bids_received != null && row.total_bids_received > 0 && (
                    <div className="mt-1.5">
                      <IntensityBar score={row.total_bids_received} max={maxBids} />
                    </div>
                  )}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0 mt-1" />
              </div>
            </motion.button>
          ))}
        </div>

        <AnimatePresence>
          {selectedPlayer && (
            <motion.div key={selectedPlayer.identity_key}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="flex-1 min-w-0 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white">{selectedPlayer.player_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedPlayer.player_role} · {selectedPlayer.sport}
                    {detail?.globalPlayerId ? " · linked identity" : ""}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelectedPlayer(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              {detailLoading && <SkeletonRows n={4} />}
              {!detailLoading && detail && (
                <ScrollArea className="h-[calc(100vh-260px)]">
                  <div className="flex flex-col gap-4 pr-2">
                    <div className="grid grid-cols-2 gap-2.5">
                      <MetricCard label="Auctions" value={selectedPlayer.total_auctions} icon={Gavel} accent="cyan" />
                      <MetricCard label="Avg Sold" value={fCr(selectedPlayer.avg_sold_value)} icon={TrendingUp} accent="green" />
                      <MetricCard label="Highest Sold" value={fCr(selectedPlayer.max_sold_value)} icon={Award} accent="amber" />
                      <MetricCard label="Total Bids" value={selectedPlayer.total_bids_received?.toLocaleString("en-IN") ?? "—"} icon={Activity} accent="purple" />
                    </div>

                    {detail.interestedTeams.length > 0 && (
                      <div className="rounded-xl border border-white/8 bg-card/60 p-4 flex flex-col gap-2">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">Interested Teams</p>
                        {detail.interestedTeams.map(t => {
                          const max = detail.interestedTeams[0]?.bid_count ?? 1;
                          return (
                            <div key={t.team_name} className="flex items-center gap-2">
                              <ColorDot color={t.team_color} size={7} />
                              <span className="text-xs text-muted-foreground w-32 truncate">{t.team_name}</span>
                              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${(t.bid_count / max) * 100}%`, background: t.team_color ?? "#22d3ee" }} />
                              </div>
                              <span className="text-[10px] font-mono text-white">{t.bid_count}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {detail.auctions.length > 0 && (
                      <div className="rounded-xl border border-white/8 bg-card/60 p-4 flex flex-col gap-2">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">Auction History</p>
                        {detail.auctions.map(a => (
                          <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-white/4 last:border-0">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-white">{a.tournament_name}</span>
                              <span className="text-[10px] text-muted-foreground">{a.total_bids_received ?? 0} bids</span>
                            </div>
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                a.outcome === "sold" ? "bg-green-500/15 text-green-400" : a.outcome === "unsold" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"
                              }`}>{a.outcome}</span>
                              {a.final_amount != null && <span className="text-[10px] font-mono text-green-400">{fCr(a.final_amount)}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {detail.bidTimeline.length > 0 && (
                      <div className="rounded-xl border border-white/8 bg-card/60 p-4 flex flex-col gap-1.5">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">Bid Timeline</p>
                        {detail.bidTimeline.slice(0, 20).map((b, i) => (
                          <div key={i} className="flex items-center gap-2 py-1 border-b border-white/4 last:border-0">
                            <span className="text-[10px] font-mono text-muted-foreground/40 w-6">{b.bid_sequence_number}</span>
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.team_color ?? "#555" }} />
                            <span className="text-[10px] text-muted-foreground flex-1 truncate">
                              {b.short_code ?? b.team_name}
                              {b.tournament_name ? ` · ${b.tournament_name}` : ""}
                            </span>
                            <span className="text-[10px] font-mono text-white">{fCr(b.bid_amount)}</span>
                            {b.milliseconds_since_last_bid != null && (
                              <span className={`text-[9px] font-mono ${b.milliseconds_since_last_bid < 2000 ? "text-red-400" : "text-muted-foreground/40"}`}>
                                +{fms(b.milliseconds_since_last_bid)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── LIVE TAB ─────────────────────────────────────────────────────────────────

function LiveTab({ filters }: { filters: IntelFilters }) {
  const tid = filters.tournamentId;
  const [data, setData] = useState<LiveIntel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const poll = useCallback(async () => {
    if (!tid) return;
    try {
      const next = await apiFetch<LiveIntel>(`/intelligence/live/${tid}`);
      setData(next);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tid]);

  useEffect(() => {
    if (!tid) {
      setData(null);
      return;
    }
    setLoading(true);
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [tid, poll]);

  const levelColor = liveIntensityColor(data?.intensityLevel ?? "idle");

  return (
    <div className="flex flex-col gap-5">
      {!tid && <EmptyState icon={Radio} msg="Select a tournament for live intel" />}
      {tid && loading && !data && <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>}
      {tid && error && !data && <EmptyState msg="Could not load live intel." />}
      {tid && data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
          <div className="flex items-center gap-2 rounded-lg border px-4 py-2.5"
            style={{ borderColor: `${levelColor}30`, background: `${levelColor}08` }}>
            <div className="h-2 w-2 rounded-full animate-pulse" style={{ background: levelColor }} />
            <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: levelColor }}>
              {data.intensityLevel} intensity · last {data.windowMinutes} min window
            </span>
            <span className="text-[10px] text-muted-foreground ml-auto">Auto-refresh 5s</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Bids / min" value={data.bidsPerMinute} icon={Activity} accent="cyan" sub={`${data.bidsInWindow} in window`} />
            <MetricCard label="Last minute" value={data.bidsLastMinute} icon={Zap} accent="amber" sub="recent pace" />
            <MetricCard label="Active teams" value={data.activeTeams.length} icon={Users} accent="purple" sub="in window" />
            <MetricCard label="Hottest player" value={data.hottestPlayer?.player_name?.split(" ")[0] ?? "—"} icon={Flame} accent="red" sub={data.hottestPlayer ? `${data.hottestPlayer.recent_bids} bids` : "none"} />
          </div>

          {data.lastBid && (
            <SpotlightCard title="Latest Bid" icon={Gavel} accentColor="#22d3ee">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-bold text-white">{data.lastBid.player_name ?? "Unknown"}</span>
                <ColorDot color={data.lastBid.team_color} />
                <span className="text-xs text-muted-foreground">{data.lastBid.short_code ?? data.lastBid.team_name}</span>
                <span className="text-sm font-mono text-green-400">{fCr(data.lastBid.bid_amount)}</span>
                <span className="text-[10px] font-mono text-muted-foreground/50 ml-auto">{clockTime(data.lastBid.timestamp)}</span>
              </div>
            </SpotlightCard>
          )}

          {data.activeTeams.length > 0 && (
            <div className="rounded-xl border border-white/8 bg-card/60 overflow-hidden">
              <div className="px-4 py-2 border-b border-white/5 bg-white/2">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50">Team activity (last 10 min)</span>
              </div>
              <div className="divide-y divide-white/4">
                {data.activeTeams.map(t => (
                  <div key={t.team_id} className="flex items-center gap-3 px-4 py-2.5">
                    <ColorDot color={t.team_color} size={10} />
                    <span className="text-xs font-semibold text-white flex-1 truncate">{t.team_name}</span>
                    <span className="text-[10px] font-mono text-cyan-400">{t.recent_bids} bids</span>
                    <span className="text-[10px] font-mono text-muted-foreground/50 w-16 text-right">{fms(t.avg_response_ms)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ─── INTENSITY TAB ────────────────────────────────────────────────────────────

function IntensityTab({ filters, refreshKey }: { filters: IntelFilters; refreshKey: number }) {
  const tid = filters.tournamentId;
  const [data, setData] = useState<IntensityResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!tid) return;
    setLoading(true);
    try { setData(await apiFetch(`/intelligence/intensity/${tid}${intelQueryParams(filters)}`)); }
    catch { setData(null); }
    finally { setLoading(false); }
  }, [tid, filters.categoryId, filters.teamId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const maxIntensity = data?.maxIntensity ?? 1;

  return (
    <div className="flex flex-col gap-5">
      {!tid && <EmptyState icon={Flame} msg="Select a tournament for bid intensity analysis" />}
      {tid && loading && <SkeletonRows n={8} />}
      {tid && !loading && !data?.players.length && <EmptyState msg="Need at least 2 bids per player for intensity curves." />}

      {tid && !loading && data && data.players.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: "Most Wanted", row: data.spotlight.mostWanted, icon: Trophy, color: "#f59e0b", sub: data.spotlight.mostWanted ? `${data.spotlight.mostWanted.total_bids} bids` : "—" },
              { label: "Fastest Escalation", row: data.spotlight.fastestEscalation, icon: Zap, color: "#22d3ee", sub: data.spotlight.fastestEscalation ? `+${data.spotlight.fastestEscalation.escalation_pct}%` : "—" },
              { label: "Biggest Surprise", row: data.spotlight.biggestSurprise, icon: TrendingUp, color: "#a855f7", sub: data.spotlight.biggestSurprise?.final_amount ? fCr(data.spotlight.biggestSurprise.final_amount) : "—" },
            ].map(({ label, row, icon: Icon, color, sub }) => (
              <div key={label} className="rounded-xl border p-3.5 flex flex-col gap-2"
                style={{ borderColor: `${color}25`, background: `${color}08` }}>
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                  <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color }}>{label}</span>
                </div>
                <p className="text-sm font-bold text-white truncate">{row?.player_name ?? "—"}</p>
                <p className="text-[10px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/8 bg-card/60 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-white/5 bg-white/2">
              <span className="col-span-3 text-[9px] uppercase tracking-widest text-muted-foreground/50">Player</span>
              <span className="col-span-3 text-[9px] uppercase tracking-widest text-muted-foreground/50">Escalation</span>
              <span className="col-span-2 text-[9px] uppercase tracking-widest text-muted-foreground/50">Intensity</span>
              <span className="col-span-2 text-[9px] uppercase tracking-widest text-muted-foreground/50 text-right">Response</span>
              <span className="col-span-2 text-[9px] uppercase tracking-widest text-muted-foreground/50">Badges</span>
            </div>
            <ScrollArea className="h-[calc(100vh-380px)]">
              <div className="divide-y divide-white/4">
                {data.players.map(row => (
                  <div key={row.player_id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-white/2">
                    <div className="col-span-3 flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs font-semibold text-white truncate">{row.player_name}</span>
                      <span className="text-[9px] text-muted-foreground/50">{row.total_bids} bids · {row.team_count} teams</span>
                    </div>
                    <div className="col-span-3 flex items-center gap-2">
                      <EscalationSparkline values={row.escalation_curve.slice(0, 20)} color={row.escalation_pct > 100 ? "#ef4444" : "#22d3ee"} />
                      <span className="text-[10px] font-mono text-muted-foreground">+{row.escalation_pct}%</span>
                    </div>
                    <div className="col-span-2 flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-cyan-400 font-bold">{row.intensity_score}</span>
                      <IntensityBar score={row.intensity_score} max={maxIntensity} />
                    </div>
                    <div className="col-span-2 text-right text-[9px] font-mono text-muted-foreground/60">
                      <div>E {fms(row.early_avg_ms)}</div>
                      <div>L {fms(row.late_avg_ms)}</div>
                    </div>
                    <div className="col-span-2 flex flex-wrap gap-1 justify-end">
                      {row.badges.slice(0, 2).map(b => (
                        <span key={b} className="text-[8px] font-bold uppercase px-1 py-0.5 rounded bg-white/5 text-muted-foreground">{b}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── ARCHIVE TAB ──────────────────────────────────────────────────────────────

function ArchiveTab() {
  const [archives, setArchives] = useState<IntelArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<IntelArchive[]>("/intelligence/archives")
      .then(setArchives)
      .catch(() => setArchives([]))
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async (archiveId: number, dataset: "all" | "bids" | "players" | "timers") => {
    setExportingId(archiveId);
    try {
      await downloadCsv(`/intelligence/export/archive/${archiveId}?dataset=${dataset}`);
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
        Preserved when admin deletes a tournament · not shown in live tournament list
      </p>
      {loading && <SkeletonRows n={5} />}
      {!loading && archives.length === 0 && (
        <EmptyState icon={Layers} msg="No archived intelligence yet — data is preserved when tournaments are admin-deleted." />
      )}
      {!loading && archives.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-card/60 overflow-hidden divide-y divide-white/4">
          {archives.map(a => (
            <div key={a.id} className="flex items-center gap-4 px-4 py-3 flex-wrap hover:bg-white/2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{a.tournamentName}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {a.tournamentSport} · deleted tournament #{a.sourceTournamentId} · {new Date(a.archivedAt).toLocaleString("en-IN")}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {a.bidEventCount.toLocaleString("en-IN")} bids · {a.playerEventCount.toLocaleString("en-IN")} player events · {a.timerEventCount.toLocaleString("en-IN")} timer events
                </p>
              </div>
              <Select onValueChange={v => handleExport(a.id, v as "all" | "bids" | "players" | "timers")} disabled={exportingId === a.id}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <Download className="w-3 h-3 mr-1 opacity-60" />
                  <SelectValue placeholder="Export" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All CSV</SelectItem>
                  <SelectItem value="bids">Bids</SelectItem>
                  <SelectItem value="players">Players</SelectItem>
                  <SelectItem value="timers">Timers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CROSS-SPORT TAB ──────────────────────────────────────────────────────────

function CrossSportTab() {
  const [data, setData] = useState<{ sports: CrossSportRow[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ sports: CrossSportRow[] }>("/intelligence/cross-sport")
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const maxBids = Math.max(...(data?.sports.map(s => s.totalBids) ?? [1]), 1);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
        Live + archived intelligence aggregated by sport
      </p>
      {loading && <SkeletonRows n={4} />}
      {!loading && !data?.sports.length && <EmptyState icon={Tag} msg="No cross-sport intelligence data yet." />}
      {!loading && data && data.sports.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.sports.map(s => (
            <div key={s.sport} className="rounded-xl border border-white/8 bg-card/60 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-white uppercase tracking-wider">{s.sport}</span>
                <Badge variant="outline" className="text-[9px] uppercase">{s.tournaments} tournaments</Badge>
              </div>
              <IntensityBar score={s.totalBids} max={maxBids} color="#22d3ee" />
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div><span className="text-muted-foreground/50">Total bids</span><p className="font-mono font-bold text-cyan-400">{s.totalBids.toLocaleString("en-IN")}</p></div>
                <div><span className="text-muted-foreground/50">Avg response</span><p className="font-mono text-white">{fms(s.avgResponseMs)}</p></div>
                <div><span className="text-muted-foreground/50">Sold / Unsold</span><p className="font-mono text-white">{s.sold} / {s.unsold}</p></div>
                <div><span className="text-muted-foreground/50">Avg sold</span><p className="font-mono text-green-400">{fCr(s.avgSold)}</p></div>
                <div><span className="text-muted-foreground/50">Avg bids/player</span><p className="font-mono text-white">{s.avgBidsPerPlayer?.toFixed(1) ?? "—"}</p></div>
                <div><span className="text-muted-foreground/50">Archived</span><p className="font-mono text-purple-400">{s.archivedTournaments}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart2 },
  { id: "live", label: "Live", icon: Radio },
  { id: "intensity", label: "Intensity", icon: Flame },
  { id: "replay", label: "Replay", icon: PlayCircle },
  { id: "demand", label: "Demand", icon: Radar },
  { id: "behavior", label: "Behavior", icon: Brain },
  { id: "players", label: "Players", icon: Users },
  { id: "observations", label: "Insights", icon: Eye },
  { id: "crosssport", label: "Cross-Sport", icon: Tag },
  { id: "archive", label: "Archive", icon: Layers },
  { id: "events", label: "Events", icon: Database },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminIntelligencePage() {
  const { isLoggedIn, isLoading: authLoading } = useAdminAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<TabId>("overview");
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);
  const [filters, setFilters] = useState<IntelFilters>({ tournamentId: "", categoryId: "", teamId: "" });
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (dataset: "all" | "bids" | "players" | "timers") => {
    if (!filters.tournamentId) return;
    setExporting(true);
    try {
      await downloadCsv(`/intelligence/export/live/${filters.tournamentId}?dataset=${dataset}`);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isLoggedIn) navigate("/admin");
  }, [authLoading, isLoggedIn, navigate]);

  useEffect(() => {
    apiFetch<TournamentRow[]>("/intelligence/tournaments")
      .then(setTournaments)
      .catch(() => setTournaments([]))
      .finally(() => setTournamentsLoading(false));
  }, []);

  useEffect(() => {
    if (!filters.tournamentId) {
      setFilterOptions(null);
      return;
    }
    setOptionsLoading(true);
    apiFetch<{ categories: FilterOptions["categories"]; teams: FilterOptions["teams"] }>(
      `/intelligence/filters/${filters.tournamentId}`,
    )
      .then(d => setFilterOptions({ categories: d.categories, teams: d.teams }))
      .catch(() => setFilterOptions(null))
      .finally(() => setOptionsLoading(false));
  }, [filters.tournamentId]);

  const handleFilterChange = (next: Partial<IntelFilters>) => {
    setFilters(prev => ({ ...prev, ...next }));
  };

  if (authLoading) return null;

  return (
    <AdminShell
      title="AI & Intelligence"
      eyebrow="Platform Settings"
      actions={
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
          Read-only analysis
        </div>
      }
    >
      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card/70">
        {/* Tab navigation */}
        <div className="border-b border-white/6 bg-card/20 px-5 flex-shrink-0 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-[11px] font-medium uppercase tracking-widest border-b-2 transition-all ${
                    active
                      ? "border-cyan-400 text-cyan-400"
                      : "border-transparent text-muted-foreground/50 hover:text-muted-foreground hover:border-white/20"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-[1400px] mx-auto px-5 py-5 flex flex-col gap-4">
            {!tournamentsLoading && (
              <GlobalFilterBar
                tournaments={tournaments}
                filters={filters}
                filterOptions={filterOptions}
                optionsLoading={optionsLoading}
                onChange={handleFilterChange}
                onRefresh={() => setRefreshKey(k => k + 1)}
                onExport={handleExport}
                exporting={exporting}
              />
            )}
            {tournamentsLoading ? (
              <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                  {tab === "overview" && <OverviewTab filters={filters} refreshKey={refreshKey} />}
                  {tab === "live" && <LiveTab filters={filters} />}
                  {tab === "intensity" && <IntensityTab filters={filters} refreshKey={refreshKey} />}
                  {tab === "replay" && <ReplayTab filters={filters} refreshKey={refreshKey} />}
                  {tab === "demand" && <DemandTab filters={filters} refreshKey={refreshKey} />}
                  {tab === "behavior" && <BehaviorTab filters={filters} refreshKey={refreshKey} />}
                  {tab === "players" && <PlayersTab filters={filters} />}
                  {tab === "observations" && <ObservationsTab filters={filters} refreshKey={refreshKey} />}
                  {tab === "crosssport" && <CrossSportTab />}
                  {tab === "archive" && <ArchiveTab />}
                  {tab === "events" && <EventsTab filters={filters} refreshKey={refreshKey} />}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
