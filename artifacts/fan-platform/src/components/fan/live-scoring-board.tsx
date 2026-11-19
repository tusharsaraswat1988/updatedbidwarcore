import React, { useState, useEffect, useMemo } from "react";
import { Radio, Trophy, Activity, Calendar, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BadmintonGameScore {
  gameNumber?: number;
  leftScore?: number;
  rightScore?: number;
  winner?: "left" | "right" | string | null;
}

export interface BadmintonMatchState {
  matchStatus?: string;
  leftScore?: number;
  rightScore?: number;
  gamesLeft?: number;
  gamesRight?: number;
  currentGame?: number;
  servingSide?: "left" | "right" | string | null;
  winnerSide?: "left" | "right" | string | null;
  games?: BadmintonGameScore[];
}

export interface BadmintonMatchItem {
  id: number;
  tournamentId: number;
  matchLabel?: string | null;
  roundName?: string | null;
  scheduledAt?: string | null;
  status: string;
  venue?: string | null;
  resultSummary?: string | null;
  homeSideJson?: {
    displayName?: string;
    playerIds?: number[];
  } | null;
  awaySideJson?: {
    displayName?: string;
    playerIds?: number[];
  } | null;
  detail?: {
    courtNumber?: string | null;
    courtId?: number | null;
    matchType?: string | null;
    matchLabel?: string | null;
  } | null;
  state?: BadmintonMatchState | null;
}

export interface BadmintonDashboardData {
  totalPlayers?: number;
  totalCourts?: number;
  totalCategories?: number;
  matchesLive?: number;
  matchesCompleted?: number;
  matchesScheduled?: number;
}

type BadmintonSubTab = "live_courts" | "results" | "schedule" | "dashboard";

function isLive(status?: string | null) {
  const s = (status || "").toLowerCase();
  return s === "live" || s === "in_progress";
}

function isCompleted(status?: string | null) {
  const s = (status || "").toLowerCase();
  return s === "completed" || s === "abandoned" || s === "walkover";
}

function formatSideName(side?: { displayName?: string } | null, fallback = "Player / Pair") {
  if (!side?.displayName) return fallback;
  return side.displayName.replace(/\s*\/\s*/g, " & ");
}

export function LiveScoringBoard({
  tournamentId,
  sportLabel = "Badminton live",
}: {
  tournamentId: number;
  sportLabel?: string;
}) {
  const [matches, setMatches] = useState<BadmintonMatchItem[]>([]);
  const [dashboard, setDashboard] = useState<BadmintonDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<BadmintonSubTab>("live_courts");

  // Fetch matches & dashboard from API
  useEffect(() => {
    if (!tournamentId || tournamentId <= 0) return;
    let cancelled = false;

    const fetchBadmintonData = async () => {
      try {
        const [matchesRes, dashRes] = await Promise.all([
          fetch(`/api/tournaments/${tournamentId}/badminton/matches`).then((r) =>
            r.ok ? r.json() : []
          ),
          fetch(`/api/tournaments/${tournamentId}/badminton/dashboard`).then((r) =>
            r.ok ? r.json() : null
          ),
        ]);
        if (!cancelled) {
          setMatches(Array.isArray(matchesRes) ? matchesRes : []);
          setDashboard(dashRes);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBadmintonData();

    // Determine polling frequency based on whether live matches are active
    const interval = setInterval(fetchBadmintonData, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tournamentId]);

  // Derive partitioned match lists
  const liveMatches = useMemo(() => matches.filter((m) => isLive(m.status)), [matches]);
  const completedMatches = useMemo(
    () => matches.filter((m) => isCompleted(m.status)),
    [matches]
  );
  const upcomingMatches = useMemo(
    () => matches.filter((m) => !isLive(m.status) && !isCompleted(m.status)),
    [matches]
  );

  // Auto-switch to live_courts if live matches exist and user is on default
  useEffect(() => {
    if (liveMatches.length > 0 && activeTab !== "live_courts") {
      setActiveTab("live_courts");
    } else if (liveMatches.length === 0 && completedMatches.length > 0 && activeTab === "live_courts") {
      setActiveTab("results");
    }
  }, [liveMatches.length]);

  if (loading && matches.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-[#131B2E]">
        Loading {sportLabel}…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 w-full" data-testid="live-scoring-board">
      {/* ── Sub Navigation & Live Status Pill ──────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#131B2E]">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
            <Radio className="h-3.5 w-3.5" />
            {sportLabel}
          </div>
          {liveMatches.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              {liveMatches.length} LIVE
            </span>
          )}
        </div>

        {/* Tab Pills */}
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("live_courts")}
            className={cn(
              "rounded-xl px-3 py-1.5 transition-colors cursor-pointer",
              activeTab === "live_courts"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300"
            )}
          >
            Courts {liveMatches.length > 0 && `(${liveMatches.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("results")}
            className={cn(
              "rounded-xl px-3 py-1.5 transition-colors cursor-pointer",
              activeTab === "results"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300"
            )}
          >
            Results ({completedMatches.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("schedule")}
            className={cn(
              "rounded-xl px-3 py-1.5 transition-colors cursor-pointer",
              activeTab === "schedule"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300"
            )}
          >
            Upcoming ({upcomingMatches.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={cn(
              "rounded-xl px-3 py-1.5 transition-colors cursor-pointer",
              activeTab === "dashboard"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300"
            )}
          >
            Overview
          </button>
        </div>
      </div>

      {/* ── Active Tab View ─────────────────────────────────────────────── */}
      {activeTab === "live_courts" && (
        <section className="space-y-4">
          {liveMatches.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-[#131B2E]">
              <Trophy className="mx-auto h-8 w-8 text-amber-500 opacity-60 mb-2" />
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                No matches are live on court right now
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Check the Results tab for completed matches or Upcoming for scheduled fixtures.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {liveMatches.map((m) => {
                const court = m.detail?.courtNumber || `Court ${m.detail?.courtId || 1}`;
                const sideA = formatSideName(m.homeSideJson, "Side A");
                const sideB = formatSideName(m.awaySideJson, "Side B");
                const state = m.state;
                const setScores = state?.games ?? [];

                return (
                  <article
                    key={m.id}
                    className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-white p-5 shadow-lg dark:border-emerald-500/20 dark:bg-[#131B2E]"
                  >
                    {/* Court Badge & Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-emerald-500 px-2 py-0.5 text-xs font-black text-black">
                          {court}
                        </span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          {m.matchLabel || m.detail?.matchLabel || "Match"}
                        </span>
                      </div>
                      <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                        Game {state?.currentGame || 1}
                      </span>
                    </div>

                    {/* Court Scoreboard Deck */}
                    <div className="mt-4 space-y-3">
                      {/* Side A */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {state?.servingSide === "left" && (
                            <span className="h-2 w-2 rounded-full bg-emerald-500" title="Serving" />
                          )}
                          <p className="truncate font-display text-base font-bold text-slate-900 dark:text-white">
                            {sideA}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-xs font-bold text-slate-400">
                            {state?.gamesLeft ?? 0}
                          </span>
                          <span className="font-display text-3xl font-black text-amber-500">
                            {state?.leftScore ?? 0}
                          </span>
                        </div>
                      </div>

                      {/* Side B */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {state?.servingSide === "right" && (
                            <span className="h-2 w-2 rounded-full bg-emerald-500" title="Serving" />
                          )}
                          <p className="truncate font-display text-base font-bold text-slate-900 dark:text-white">
                            {sideB}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-xs font-bold text-slate-400">
                            {state?.gamesRight ?? 0}
                          </span>
                          <span className="font-display text-3xl font-black text-amber-500">
                            {state?.rightScore ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Previous Completed Game Sets */}
                    {setScores.length > 0 && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-[11px] font-semibold text-slate-500 dark:border-white/[0.06] dark:text-slate-400">
                        <span className="uppercase tracking-wider">Sets:</span>
                        {setScores.map((g, idx) => (
                          <span
                            key={idx}
                            className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-slate-700 dark:bg-white/[0.06] dark:text-slate-300"
                          >
                            Set {g.gameNumber || idx + 1}: {g.leftScore ?? 0}-{g.rightScore ?? 0}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Results Tab View ────────────────────────────────────────────── */}
      {activeTab === "results" && (
        <section className="space-y-3">
          {completedMatches.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-[#131B2E]">
              No completed matches yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm dark:divide-white/[0.06] dark:border-white/10 dark:bg-[#131B2E]">
              {completedMatches.map((m) => {
                const sideA = formatSideName(m.homeSideJson, "Side A");
                const sideB = formatSideName(m.awaySideJson, "Side B");
                const state = m.state;
                const games = state?.games ?? [];
                const winnerSide = state?.winnerSide || (state?.gamesLeft && state?.gamesRight && state.gamesLeft > state.gamesRight ? "left" : "right");

                return (
                  <article key={m.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span>{m.matchLabel || m.detail?.matchLabel || "Match"}</span>
                        {m.detail?.courtNumber && <span>· {m.detail.courtNumber}</span>}
                      </div>
                      <div className="space-y-1">
                        <p className={cn("text-sm font-bold truncate", winnerSide === "left" ? "text-slate-900 dark:text-white" : "text-slate-500")}>
                          {sideA} {winnerSide === "left" && "🏆"}
                        </p>
                        <p className={cn("text-sm font-bold truncate", winnerSide === "right" ? "text-slate-900 dark:text-white" : "text-slate-500")}>
                          {sideB} {winnerSide === "right" && "🏆"}
                        </p>
                      </div>
                    </div>

                    {/* Game Score Badges */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="rounded-lg bg-amber-500/15 px-2.5 py-1 font-mono text-xs font-bold text-amber-700 dark:text-amber-300">
                        {state?.gamesLeft ?? 0} - {state?.gamesRight ?? 0}
                      </span>
                      {games.map((g, idx) => (
                        <span key={idx} className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-white/[0.06] dark:text-slate-300">
                          {g.leftScore ?? 0}-{g.rightScore ?? 0}
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Upcoming Schedule Tab View ──────────────────────────────────── */}
      {activeTab === "schedule" && (
        <section className="space-y-3">
          {upcomingMatches.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-[#131B2E]">
              No upcoming fixtures scheduled right now.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm dark:divide-white/[0.06] dark:border-white/10 dark:bg-[#131B2E]">
              {upcomingMatches.map((m) => {
                const sideA = formatSideName(m.homeSideJson, "TBD");
                const sideB = formatSideName(m.awaySideJson, "TBD");

                return (
                  <article key={m.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        <span>{m.matchLabel || m.detail?.matchLabel || "Upcoming Match"}</span>
                        {m.detail?.courtNumber && <span>· {m.detail.courtNumber}</span>}
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {sideA} <span className="text-slate-400 font-normal">vs</span> {sideB}
                      </p>
                    </div>
                    {m.scheduledAt && (
                      <span className="text-xs text-slate-500 font-mono shrink-0">
                        {new Date(m.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Dashboard Overview Tab View ─────────────────────────────────── */}
      {activeTab === "dashboard" && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Active Courts", val: dashboard?.totalCourts ?? 1, icon: Activity },
            { label: "Live Matches", val: liveMatches.length, icon: Radio },
            { label: "Completed", val: completedMatches.length, icon: CheckCircle2 },
            { label: "Total Players", val: dashboard?.totalPlayers ?? "—", icon: Trophy },
          ].map(({ label, val, icon: IconComponent }) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#131B2E]"
            >
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
                <IconComponent className="h-4 w-4 text-amber-500" />
              </div>
              <p className="font-display text-3xl font-black text-slate-900 dark:text-white">
                {String(val)}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export default LiveScoringBoard;
