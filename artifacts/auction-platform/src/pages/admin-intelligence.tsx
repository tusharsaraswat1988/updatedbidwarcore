import { useState, useEffect, useCallback, useRef } from "react";
import { useAdminAuth } from "@/hooks/use-auth";
import { FullscreenLayout } from "@/components/layout";
import { useLocation } from "wouter";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Search, Trophy, Users, Zap, TrendingUp,
  ChevronRight, ArrowLeft, Clock, Target, Flame, Award,
  RefreshCw, BarChart2, Gavel, Eye, Timer, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TournamentRow { id: number; name: string; sport: string; status: string; }

interface TournamentIntel {
  totalBids: number;
  avgResponseMs: number | null;
  hottestPlayer: { player_id: number; player_name: string; bid_count: number } | null;
  fastestTeam: { team_id: number; team_name: string; team_color: string; avg_response_ms: number; total_bids: number } | null;
  biggestInflation: { player_name: string; final_amount: number; base_price: number; inflation_pct: number; sold_to_team_name: string } | null;
  outcomes: Record<string, number>;
  soldPct: number;
  unsoldPct: number;
  deferredPct: number;
  totalConcluded: number;
}

interface PlayerRow {
  player_id: number;
  player_name: string;
  player_role: string | null;
  sport: string;
  total_auctions: number;
  avg_sold_value: number | null;
  max_sold_value: number | null;
  total_bids_received: number | null;
  avg_bids_per_auction: number | null;
  tournament_count: number;
}

interface PlayerDetail {
  auctions: Array<{
    id: number; tournament_id: number; tournament_name: string;
    outcome: string; final_amount: number | null; total_bids_received: number | null;
    base_price: number | null; sold_to_team_name: string | null;
    auction_duration_seconds: number | null; player_name: string;
  }>;
  bidTimeline: Array<{
    bid_amount: number; bid_sequence_number: number;
    milliseconds_since_last_bid: number | null;
    timer_remaining_seconds: number | null;
    timestamp: string; tournament_id: number;
    team_name: string | null; team_color: string | null; short_code: string | null;
  }>;
  interestedTeams: Array<{ team_name: string; team_color: string | null; bid_count: number }>;
}

interface TeamRow {
  team_id: number; team_name: string; team_color: string | null;
  short_code: string | null; owner_name?: string | null;
  total_bids: number; avg_response_ms?: number | null;
  unique_players_bid?: number;
}

interface TeamDetail {
  bidStats: {
    total_bids: number; avg_response_ms: number | null;
    fastest_response_ms: number | null; tournaments_active: number;
    unique_players_bid: number;
  } | null;
  categoryBreakdown: Array<{
    category_id: number | null; category_name: string | null;
    color_code: string | null; bid_count: number; players_contested: number;
  }>;
  aggressionHighlights: Array<{
    player_id: number; player_name: string | null;
    team_bids: number; total_bids: number; aggression_pct: number;
  }>;
  recentActivity: Array<{
    player_id: number; bid_amount: number; timestamp: string;
    milliseconds_since_last_bid: number | null;
    player_name: string | null; outcome: string | null; tournament_name: string | null;
  }>;
}

// ─── Data helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDuration(secs: number | null | undefined): string {
  if (secs == null) return "—";
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Shared atoms ──────────────────────────────────────────────────────────────

function ColorDot({ color, size = 8 }: { color: string | null | undefined; size?: number }) {
  return (
    <span
      className="inline-block rounded-full flex-shrink-0 border border-white/10"
      style={{ width: size, height: size, background: color ?? "#555" }}
    />
  );
}

function MetricCard({
  label, value, sub, icon: Icon, accent = "cyan",
}: {
  label: string; value: string | number; sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "cyan" | "green" | "amber" | "red" | "purple";
}) {
  const colors: Record<string, string> = {
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    green: "text-green-400 bg-green-500/10 border-green-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  };
  const cls = colors[accent] ?? colors.cyan;
  return (
    <div className={`rounded-xl border p-3.5 flex flex-col gap-1.5 ${cls}`}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 opacity-70" />}
        <span className="text-[10px] uppercase tracking-widest opacity-70 font-medium">{label}</span>
      </div>
      <span className="text-xl font-black font-display leading-none">{value}</span>
      {sub && <span className="text-[10px] opacity-60">{sub}</span>}
    </div>
  );
}

function SpotlightCard({
  title, icon: Icon, accentColor = "#22d3ee", children, empty,
}: {
  title: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accentColor?: string; children?: React.ReactNode; empty?: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-card/60 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">{title}</span>
      </div>
      {children ?? (
        <p className="text-xs text-muted-foreground/50">{empty ?? "No data yet"}</p>
      )}
    </div>
  );
}

function OutcomePill({ label, count, pct, color }: {
  label: string; count: number; pct: number; color: string;
}) {
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

function SkeletonGrid({ n = 6 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: n }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
    </div>
  );
}

// ─── Tournament Tab ────────────────────────────────────────────────────────────

function TournamentTab({ tournaments }: { tournaments: TournamentRow[] }) {
  const [tid, setTid] = useState<string>("");
  const [data, setData] = useState<TournamentIntel | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const d = await apiFetch<TournamentIntel>(`/intelligence/tournament/${id}`);
      setData(d);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, []);

  const handleSelect = (v: string) => { setTid(v); load(v); };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Select value={tid} onValueChange={handleSelect}>
          <SelectTrigger className="w-72 h-9 text-sm">
            <SelectValue placeholder="Select a tournament..." />
          </SelectTrigger>
          <SelectContent>
            {tournaments.map(t => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name}
                <Badge variant="outline" className="ml-2 text-[9px] uppercase h-4">{t.sport}</Badge>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tid && (
          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => load(tid)}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>

      {!tid && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <BarChart2 className="w-10 h-10 opacity-20" />
          <p className="text-sm">Select a tournament to load intelligence</p>
        </div>
      )}

      {tid && loading && <SkeletonGrid n={6} />}

      {tid && !loading && data && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
          {/* Metric strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="Total Bids" value={data.totalBids.toLocaleString("en-IN")} icon={Gavel} accent="cyan" />
            <MetricCard label="Avg Response" value={formatMs(data.avgResponseMs)} icon={Clock} accent="purple" sub="between bids" />
            <MetricCard label="Sold" value={`${data.soldPct}%`} icon={Award} accent="green" sub={`${data.outcomes.sold ?? 0} players`} />
            <MetricCard label="Unsold" value={`${data.unsoldPct}%`} icon={X} accent="red" sub={`${data.outcomes.unsold ?? 0} players`} />
            <MetricCard label="Deferred" value={`${data.deferredPct}%`} icon={Timer} accent="amber" sub={`${data.outcomes.deferred ?? 0} players`} />
            <MetricCard label="Concluded" value={data.totalConcluded.toLocaleString("en-IN")} icon={Trophy} accent="cyan" sub="players auctioned" />
          </div>

          {/* Outcome breakdown */}
          <div className="rounded-xl border border-white/8 bg-card/60 p-4 flex flex-col gap-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Outcome Breakdown</p>
            <OutcomePill label="Sold" count={data.outcomes.sold ?? 0} pct={data.soldPct} color="#22c55e" />
            <OutcomePill label="Unsold" count={data.outcomes.unsold ?? 0} pct={data.unsoldPct} color="#ef4444" />
            <OutcomePill label="Deferred" count={data.outcomes.deferred ?? 0} pct={data.deferredPct} color="#f59e0b" />
          </div>

          {/* Spotlight trio */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SpotlightCard title="Most Contested Player" icon={Flame} accentColor="#f97316" empty="No bid data yet">
              {data.hottestPlayer ? (
                <div className="flex flex-col gap-1">
                  <p className="text-base font-bold text-white leading-tight">{data.hottestPlayer.player_name}</p>
                  <p className="text-xs text-muted-foreground">{data.hottestPlayer.bid_count.toLocaleString("en-IN")} bids received</p>
                  <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-orange-500" style={{ width: "100%" }} />
                  </div>
                </div>
              ) : <p className="text-xs text-muted-foreground/50">No bid data yet</p>}
            </SpotlightCard>

            <SpotlightCard title="Fastest Bidding Team" icon={Zap} accentColor="#a855f7" empty="No response data yet">
              {data.fastestTeam ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <ColorDot color={data.fastestTeam.team_color} size={10} />
                    <p className="text-base font-bold text-white leading-tight">{data.fastestTeam.team_name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Avg response: <span className="text-purple-400 font-mono font-bold">{formatMs(data.fastestTeam.avg_response_ms)}</span></p>
                  <p className="text-xs text-muted-foreground">{data.fastestTeam.total_bids.toLocaleString("en-IN")} bids placed</p>
                </div>
              ) : <p className="text-xs text-muted-foreground/50">No response data yet</p>}
            </SpotlightCard>

            <SpotlightCard title="Biggest Inflation Sale" icon={TrendingUp} accentColor="#22d3ee" empty="No sold data yet">
              {data.biggestInflation ? (
                <div className="flex flex-col gap-1">
                  <p className="text-base font-bold text-white leading-tight">{data.biggestInflation.player_name}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>{formatShortIndianRupee(data.biggestInflation.base_price)}</span>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-green-400 font-bold">{formatShortIndianRupee(data.biggestInflation.final_amount)}</span>
                  </div>
                  <Badge className="w-fit mt-1 text-[10px] bg-cyan-500/15 text-cyan-400 border-cyan-500/30">
                    +{data.biggestInflation.inflation_pct}% above base
                  </Badge>
                  {data.biggestInflation.sold_to_team_name && (
                    <p className="text-[10px] text-muted-foreground/60">Sold to {data.biggestInflation.sold_to_team_name}</p>
                  )}
                </div>
              ) : <p className="text-xs text-muted-foreground/50">No sold data yet</p>}
            </SpotlightCard>
          </div>
        </motion.div>
      )}

      {tid && !loading && !data && (
        <p className="text-sm text-muted-foreground text-center py-12">No intelligence data available for this tournament yet.</p>
      )}
    </div>
  );
}

// ─── Player Tab ────────────────────────────────────────────────────────────────

function PlayerTab({ tournaments }: { tournaments: TournamentRow[] }) {
  const [q, setQ] = useState("");
  const [tid, setTid] = useState<string>("all");
  const [results, setResults] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null);
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (query: string, tournamentId: string) => {
    setLoading(true);
    try {
      const tidParam = tournamentId !== "all" ? `&tournamentId=${tournamentId}` : "";
      const rows = await apiFetch<PlayerRow[]>(`/intelligence/players/search?q=${encodeURIComponent(query)}${tidParam}`);
      setResults(rows);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  const handleQueryChange = (v: string) => {
    setQ(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(v, tid), 350);
  };

  const handleTidChange = (v: string) => {
    setTid(v);
    search(q, v);
  };

  const selectPlayer = async (row: PlayerRow) => {
    setSelectedPlayer(row);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await apiFetch<PlayerDetail>(`/intelligence/players/${row.player_id}`);
      setDetail(d);
    } catch { setDetail(null); }
    finally { setDetailLoading(false); }
  };

  const maxBids = Math.max(...results.map(r => r.total_bids_received ?? 0), 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Search players by name..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={tid} onValueChange={handleTidChange}>
          <SelectTrigger className="w-52 h-9 text-sm">
            <SelectValue placeholder="All tournaments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tournaments</SelectItem>
            {tournaments.map(t => (
              <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-4 min-h-0">
        {/* Results list */}
        <div className={`flex flex-col gap-1 ${selectedPlayer ? "w-96 flex-shrink-0" : "flex-1"}`}>
          {loading && Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
          {!loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Users className="w-8 h-8 opacity-20" />
              <p className="text-sm">{q ? "No players found" : "Start typing to search players"}</p>
            </div>
          )}
          {!loading && results.map(row => (
            <motion.button
              key={row.player_id}
              onClick={() => selectPlayer(row)}
              className={`w-full text-left rounded-xl border p-3 transition-all hover:border-cyan-500/40 hover:bg-cyan-500/5 ${
                selectedPlayer?.player_id === row.player_id
                  ? "border-cyan-500/50 bg-cyan-500/8"
                  : "border-white/6 bg-card/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">{row.player_name}</p>
                    {row.player_role && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1 flex-shrink-0">{row.player_role}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-muted-foreground">{row.tournament_count} tournament{row.tournament_count !== 1 ? "s" : ""}</span>
                    <span className="text-[10px] text-muted-foreground">{row.total_auctions} auction{row.total_auctions !== 1 ? "s" : ""}</span>
                    {row.avg_sold_value != null && (
                      <span className="text-[10px] text-green-400 font-mono">{formatShortIndianRupee(row.avg_sold_value)} avg</span>
                    )}
                  </div>
                  {/* Bid intensity bar */}
                  {row.total_bids_received != null && row.total_bids_received > 0 && (
                    <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-cyan-500/60"
                        style={{ width: `${(row.total_bids_received / maxBids) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0 mt-1" />
              </div>
            </motion.button>
          ))}
        </div>

        {/* Player Detail Panel */}
        <AnimatePresence>
          {selectedPlayer && (
            <motion.div
              key={selectedPlayer.player_id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 min-w-0 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white">{selectedPlayer.player_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedPlayer.player_role} · {selectedPlayer.sport}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelectedPlayer(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              {detailLoading && <SkeletonGrid n={4} />}

              {!detailLoading && detail && (
                <ScrollArea className="h-[calc(100vh-260px)]">
                  <div className="flex flex-col gap-4 pr-2">
                    {/* Quick stats */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <MetricCard
                        label="Auctions" value={selectedPlayer.total_auctions}
                        icon={Gavel} accent="cyan"
                      />
                      <MetricCard
                        label="Avg Sold" value={selectedPlayer.avg_sold_value != null ? formatShortIndianRupee(selectedPlayer.avg_sold_value) : "—"}
                        icon={TrendingUp} accent="green"
                      />
                      <MetricCard
                        label="Highest Sold" value={selectedPlayer.max_sold_value != null ? formatShortIndianRupee(selectedPlayer.max_sold_value) : "—"}
                        icon={Award} accent="amber"
                      />
                      <MetricCard
                        label="Total Bids" value={selectedPlayer.total_bids_received?.toLocaleString("en-IN") ?? "—"}
                        icon={BarChart2} accent="purple"
                      />
                    </div>

                    {/* Interested teams */}
                    {detail.interestedTeams.length > 0 && (
                      <div className="rounded-xl border border-white/8 bg-card/60 p-4 flex flex-col gap-3">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                          Interested Teams ({detail.interestedTeams.length})
                        </p>
                        <div className="flex flex-col gap-2">
                          {detail.interestedTeams.map(t => {
                            const maxBid = detail.interestedTeams[0]?.bid_count ?? 1;
                            return (
                              <div key={t.team_name} className="flex items-center gap-2">
                                <ColorDot color={t.team_color} size={8} />
                                <span className="text-xs text-white w-32 truncate">{t.team_name}</span>
                                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${(t.bid_count / maxBid) * 100}%`,
                                      background: t.team_color ?? "#22d3ee",
                                    }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground">{t.bid_count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Auction history */}
                    {detail.auctions.length > 0 && (
                      <div className="rounded-xl border border-white/8 bg-card/60 p-4 flex flex-col gap-3">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Auction History</p>
                        <div className="flex flex-col gap-2">
                          {detail.auctions.map(a => (
                            <div key={a.id} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white truncate">{a.tournament_name}</p>
                                {a.sold_to_team_name && (
                                  <p className="text-[10px] text-muted-foreground">Sold to {a.sold_to_team_name}</p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                {a.final_amount != null ? (
                                  <p className="text-xs font-bold text-green-400">{formatShortIndianRupee(a.final_amount)}</p>
                                ) : null}
                                <Badge
                                  className={`text-[9px] h-4 mt-0.5 ${
                                    a.outcome === "sold" ? "bg-green-500/15 text-green-400 border-green-500/20"
                                      : a.outcome === "unsold" ? "bg-red-500/15 text-red-400 border-red-500/20"
                                      : "bg-amber-500/15 text-amber-400 border-amber-500/20"
                                  }`}
                                >
                                  {a.outcome}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bid timeline */}
                    {detail.bidTimeline.length > 0 && (
                      <div className="rounded-xl border border-white/8 bg-card/60 p-4 flex flex-col gap-3">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                          Recent Bid Timeline ({detail.bidTimeline.length})
                        </p>
                        <div className="flex flex-col">
                          {detail.bidTimeline.slice(0, 30).map((b, i) => (
                            <div key={i} className="flex items-center gap-3 py-1.5 border-l-2 border-white/5 pl-3 relative">
                              <div className="absolute left-0 -translate-x-[5px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                                style={{ background: b.team_color ?? "#555" }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white font-mono">{formatShortIndianRupee(b.bid_amount)}</span>
                                  {b.short_code && (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1">{b.short_code}</Badge>
                                  )}
                                  <span className="text-[10px] text-muted-foreground/50">#{b.bid_sequence_number}</span>
                                </div>
                                {b.milliseconds_since_last_bid != null && (
                                  <p className="text-[10px] text-muted-foreground/50">+{formatMs(b.milliseconds_since_last_bid)}</p>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground/40 flex-shrink-0">
                                {relativeTime(b.timestamp)}
                              </span>
                            </div>
                          ))}
                        </div>
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

// ─── Team Tab ──────────────────────────────────────────────────────────────────

function TeamTab({ tournaments }: { tournaments: TournamentRow[] }) {
  const [tid, setTid] = useState<string>("all");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamRow | null>(null);
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadTeams = useCallback(async (tournamentId: string) => {
    setTeamsLoading(true);
    setSelectedTeam(null);
    setDetail(null);
    try {
      const param = tournamentId !== "all" ? `?tournamentId=${tournamentId}` : "";
      const rows = await apiFetch<TeamRow[]>(`/intelligence/teams${param}`);
      setTeams(rows);
    } catch { setTeams([]); }
    finally { setTeamsLoading(false); }
  }, []);

  const handleTidChange = (v: string) => { setTid(v); loadTeams(v); };

  const selectTeam = async (team: TeamRow) => {
    setSelectedTeam(team);
    setDetail(null);
    setDetailLoading(true);
    try {
      const tidParam = tid !== "all" ? `?tournamentId=${tid}` : "";
      const d = await apiFetch<TeamDetail>(`/intelligence/team/${team.team_id}${tidParam}`);
      setDetail(d);
    } catch { setDetail(null); }
    finally { setDetailLoading(false); }
  };

  const maxTeamBids = Math.max(...teams.map(t => t.total_bids), 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Select value={tid} onValueChange={handleTidChange}>
          <SelectTrigger className="w-72 h-9 text-sm">
            <SelectValue placeholder="All tournaments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tournaments</SelectItem>
            {tournaments.map(t => (
              <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tid !== "all" && teams.length === 0 && !teamsLoading && (
          <p className="text-xs text-muted-foreground">No bid data found for this tournament yet.</p>
        )}
      </div>

      <div className="flex gap-4 min-h-0">
        {/* Team list */}
        <div className={`flex flex-col gap-2 ${selectedTeam ? "w-80 flex-shrink-0" : "flex-1 max-w-xl"}`}>
          {tid === "all" && teams.length === 0 && !teamsLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Users className="w-8 h-8 opacity-20" />
              <p className="text-sm">Select a tournament or run a live auction first to see team data</p>
            </div>
          )}
          {teamsLoading && Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
          {!teamsLoading && teams.map(team => (
            <motion.button
              key={team.team_id}
              onClick={() => selectTeam(team)}
              className={`w-full text-left rounded-xl border p-3.5 transition-all hover:border-white/20 ${
                selectedTeam?.team_id === team.team_id
                  ? "border-white/25 bg-white/5"
                  : "border-white/6 bg-card/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                  style={{ background: `${team.team_color ?? "#555"}25`, color: team.team_color ?? "#888" }}
                >
                  {team.short_code ?? "—"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white truncate">{team.team_name}</p>
                    <span className="text-xs font-mono font-bold text-muted-foreground flex-shrink-0">
                      {team.total_bids.toLocaleString("en-IN")} bids
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(team.total_bids / maxTeamBids) * 100}%`,
                        background: team.team_color ?? "#22d3ee",
                      }}
                    />
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Team Detail Panel */}
        <AnimatePresence>
          {selectedTeam && (
            <motion.div
              key={selectedTeam.team_id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 min-w-0 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black"
                    style={{ background: `${selectedTeam.team_color ?? "#555"}25`, color: selectedTeam.team_color ?? "#888" }}
                  >
                    {selectedTeam.short_code ?? "—"}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">{selectedTeam.team_name}</h3>
                    {selectedTeam.owner_name && (
                      <p className="text-xs text-muted-foreground">{selectedTeam.owner_name}</p>
                    )}
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelectedTeam(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              {detailLoading && <SkeletonGrid n={4} />}

              {!detailLoading && detail && (
                <ScrollArea className="h-[calc(100vh-260px)]">
                  <div className="flex flex-col gap-4 pr-2">
                    {/* Stats */}
                    {detail.bidStats && (
                      <div className="grid grid-cols-2 gap-2.5">
                        <MetricCard label="Total Bids" value={detail.bidStats.total_bids.toLocaleString("en-IN")} icon={Gavel} accent="cyan" />
                        <MetricCard label="Avg Reaction" value={formatMs(detail.bidStats.avg_response_ms)} icon={Clock} accent="purple" />
                        <MetricCard label="Fastest Bid" value={formatMs(detail.bidStats.fastest_response_ms)} icon={Zap} accent="amber" />
                        <MetricCard label="Players Bid On" value={detail.bidStats.unique_players_bid} icon={Target} accent="green" />
                      </div>
                    )}

                    {/* Category breakdown */}
                    {detail.categoryBreakdown.length > 0 && (
                      <div className="rounded-xl border border-white/8 bg-card/60 p-4 flex flex-col gap-3">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Favorite Categories</p>
                        <div className="flex flex-col gap-2.5">
                          {detail.categoryBreakdown.map(cat => {
                            const max = detail.categoryBreakdown[0]?.bid_count ?? 1;
                            return (
                              <div key={cat.category_id ?? "unknown"} className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ background: cat.color_code ?? "#555" }}
                                />
                                <span className="text-xs text-white w-24 truncate">
                                  {cat.category_name ?? "Unknown"}
                                </span>
                                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${(cat.bid_count / max) * 100}%`,
                                      background: cat.color_code ?? "#22d3ee",
                                    }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground w-12 text-right">
                                  {cat.bid_count} bids
                                </span>
                                <span className="text-[10px] text-muted-foreground/50 w-20">
                                  {cat.players_contested} players
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Aggression highlights */}
                    {detail.aggressionHighlights.length > 0 && (
                      <div className="rounded-xl border border-white/8 bg-card/60 p-4 flex flex-col gap-3">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                          Highest Aggression Moments
                        </p>
                        <div className="flex flex-col gap-2">
                          {detail.aggressionHighlights.map((h, i) => (
                            <div key={i} className="flex items-center gap-3 py-1 border-b border-white/5 last:border-0">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white truncate">{h.player_name ?? `Player #${h.player_id}`}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {h.team_bids} of {h.total_bids} total bids
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span
                                  className="text-sm font-black"
                                  style={{
                                    color: h.aggression_pct >= 60 ? "#ef4444"
                                      : h.aggression_pct >= 40 ? "#f97316"
                                      : "#f59e0b",
                                  }}
                                >
                                  {h.aggression_pct}%
                                </span>
                                <p className="text-[9px] text-muted-foreground/50">ownership</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent activity */}
                    {detail.recentActivity.length > 0 && (
                      <div className="rounded-xl border border-white/8 bg-card/60 p-4 flex flex-col gap-3">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Recent Bid Activity</p>
                        <div className="flex flex-col">
                          {detail.recentActivity.map((a, i) => (
                            <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white truncate">{a.player_name ?? `Player #${a.player_id}`}</p>
                                <p className="text-[10px] text-muted-foreground/60">{a.tournament_name}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-xs font-bold font-mono text-white">
                                  {formatShortIndianRupee(a.bid_amount)}
                                </p>
                                <p className="text-[10px] text-muted-foreground/50">{relativeTime(a.timestamp)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminIntelligence() {
  const { isLoggedIn, isLoading } = useAdminAuth();
  const [, navigate] = useLocation();
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) navigate("/admin/login");
  }, [isLoggedIn, isLoading, navigate]);

  useEffect(() => {
    if (!isLoggedIn) return;
    apiFetch<TournamentRow[]>("/intelligence/tournaments")
      .then(setTournaments)
      .catch(() => setTournaments([]));
  }, [isLoggedIn]);

  if (isLoading) {
    return (
      <FullscreenLayout>
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading...</div>
      </FullscreenLayout>
    );
  }
  if (!isLoggedIn) return null;

  return (
    <FullscreenLayout>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground h-8" onClick={() => navigate("/admin")}>
              <ArrowLeft className="w-3.5 h-3.5" /> Admin
            </Button>
            <div className="h-4 w-px bg-border/60" />
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Activity className="w-4.5 h-4.5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-black text-xl text-white">Auction Intelligence</h1>
                <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 text-[10px] gap-1">
                  <Eye className="w-2.5 h-2.5" /> Observation
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Behavioral logs · Event data · AI prep layer</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <Tabs defaultValue="tournament" className="h-full flex flex-col">
            <div className="flex-shrink-0 px-6 pt-4 pb-0 border-b border-border/40">
              <TabsList className="h-9 bg-muted/20">
                <TabsTrigger value="tournament" className="gap-1.5 text-xs">
                  <Trophy className="w-3.5 h-3.5" /> Tournament
                </TabsTrigger>
                <TabsTrigger value="player" className="gap-1.5 text-xs">
                  <Users className="w-3.5 h-3.5" /> Player
                </TabsTrigger>
                <TabsTrigger value="team" className="gap-1.5 text-xs">
                  <Target className="w-3.5 h-3.5" /> Team
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <TabsContent value="tournament" className="p-6 mt-0 h-full">
                <TournamentTab tournaments={tournaments} />
              </TabsContent>
              <TabsContent value="player" className="p-6 mt-0 h-full">
                <PlayerTab tournaments={tournaments} />
              </TabsContent>
              <TabsContent value="team" className="p-6 mt-0 h-full">
                <TeamTab tournaments={tournaments} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </FullscreenLayout>
  );
}
