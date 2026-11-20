import React, { useState, useEffect, useMemo } from "react";
import { Radio, Trophy, Activity, Calendar, CheckCircle2, Clock, ChevronRight } from "lucide-react";
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

type BadmintonSubTab = "all" | "live_courts" | "results" | "schedule";

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
  activeSection = "overview",
  onNavigateSection,
  sportLabel = "Badminton live",
}: {
  tournamentId: number;
  activeSection?: string;
  onNavigateSection?: (section: any) => void;
  sportLabel?: string;
}) {
  const [matches, setMatches] = useState<BadmintonMatchItem[]>([]);
  const [dashboard, setDashboard] = useState<BadmintonDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<BadmintonSubTab>("all");
  const [completedPageSize, setCompletedPageSize] = useState<number>(6);

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

  const activeSectionNorm = (activeSection === "scoring" ? "overview" : activeSection).toLowerCase();

  if (loading && matches.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-[#131B2E]">
        Loading {sportLabel}…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full" data-testid="live-scoring-board">
      {/* ── Status Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Badminton Scoring Active
        </span>
        {liveMatches.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            {liveMatches.length} ON COURT
          </span>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: OVERVIEW
      ═══════════════════════════════════════════════════════════════════ */}
      {activeSectionNorm === "overview" && (
        <div className="flex flex-col gap-4">
          {/* 1. Live Match Highlight or Next/Latest Featured Court */}
          {liveMatches.length > 0 ? (
            (() => {
              const m = liveMatches[0];
              const court = m.detail?.courtNumber || `Court ${m.detail?.courtId || 1}`;
              const sideA = formatSideName(m.homeSideJson, "Side A");
              const sideB = formatSideName(m.awaySideJson, "Side B");
              const state = m.state;
              const setScores = state?.games ?? [];

              return (
                <section className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-white p-5 shadow-lg dark:border-emerald-500/20 dark:bg-[#131B2E] sm:p-6">
                  <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-emerald-500 px-2 py-0.5 text-xs font-black text-black">
                        {court}
                      </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {m.matchLabel || m.detail?.matchLabel || "Live Match"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateSection?.("matches")}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-colors cursor-pointer"
                    >
                      View All Courts →
                    </button>
                  </div>

                  {/* Scores Deck */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {state?.servingSide === "left" && (
                          <span className="h-2 w-2 rounded-full bg-emerald-500" title="Serving" />
                        )}
                        <p className="truncate font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
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

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {state?.servingSide === "right" && (
                          <span className="h-2 w-2 rounded-full bg-emerald-500" title="Serving" />
                        )}
                        <p className="truncate font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
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

                  {setScores.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-[11px] font-semibold text-slate-500 dark:border-white/[0.06] dark:text-slate-400">
                      <span className="uppercase tracking-wider">Previous Games:</span>
                      {setScores.map((g, idx) => (
                        <span
                          key={idx}
                          className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-slate-700 dark:bg-white/[0.06] dark:text-slate-300"
                        >
                          G{g.gameNumber || idx + 1}: {g.leftScore ?? 0}-{g.rightScore ?? 0}
                        </span>
                      ))}
                    </div>
                  )}
                </section>
              );
            })()
          ) : upcomingMatches.length > 0 ? (
            (() => {
              const nextM = upcomingMatches[0];
              const sideA = formatSideName(nextM.homeSideJson, "TBD");
              const sideB = formatSideName(nextM.awaySideJson, "TBD");
              return (
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#131B2E]">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                      <Clock className="w-3.5 h-3.5" /> Next Match on Court
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigateSection?.("matches")}
                      className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      View Schedule →
                    </button>
                  </div>
                  <h3 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    {sideA} <span className="text-slate-400 font-normal">vs</span> {sideB}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {nextM.matchLabel || "Match"} {nextM.detail?.courtNumber ? `· ${nextM.detail.courtNumber}` : ""}
                  </p>
                </section>
              );
            })()
          ) : completedMatches.length > 0 ? (
            (() => {
              const lastM = completedMatches[0];
              const sideA = formatSideName(lastM.homeSideJson, "Side A");
              const sideB = formatSideName(lastM.awaySideJson, "Side B");
              return (
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#131B2E]">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Latest Result
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigateSection?.("matches")}
                      className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      View All Results →
                    </button>
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {sideA} vs {sideB}
                  </h3>
                  {lastM.state && (
                    <p className="mt-1 text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                      Games: {lastM.state.gamesLeft ?? 0} - {lastM.state.gamesRight ?? 0}
                    </p>
                  )}
                </section>
              );
            })()
          ) : null}

          {/* 2. Tournament Dashboard Overview Cards */}
          <section className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            {[
              { label: "Courts", val: dashboard?.totalCourts ?? 1, icon: Activity },
              { label: "Live Matches", val: liveMatches.length, icon: Radio },
              { label: "Completed", val: completedMatches.length, icon: CheckCircle2 },
              { label: "Total Players", val: dashboard?.totalPlayers ?? "—", icon: Trophy },
            ].map(({ label, val, icon: IconComponent }) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#131B2E] shadow-sm"
              >
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
                  <IconComponent className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <p className="font-display text-2xl font-black text-slate-900 dark:text-white">
                  {String(val)}
                </p>
              </div>
            ))}
          </section>

          {/* 3. Quick Match Previews (Upcoming & Completed) */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Upcoming Previews */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#131B2E]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Upcoming ({upcomingMatches.length})
                </span>
                {upcomingMatches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onNavigateSection?.("matches")}
                    className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    See all →
                  </button>
                )}
              </div>

              {upcomingMatches.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">No upcoming fixtures scheduled.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingMatches.slice(0, 2).map((m) => {
                    const sideA = formatSideName(m.homeSideJson, "TBD");
                    const sideB = formatSideName(m.awaySideJson, "TBD");
                    return (
                      <div
                        key={m.id}
                        className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06]"
                      >
                        <p className="text-[11px] text-slate-500 mb-0.5">
                          {m.matchLabel || "Match"} {m.detail?.courtNumber ? `· ${m.detail.courtNumber}` : ""}
                        </p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {sideA} vs {sideB}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Results Previews */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#131B2E]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Results ({completedMatches.length})
                </span>
                {completedMatches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onNavigateSection?.("matches")}
                    className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    See all →
                  </button>
                )}
              </div>

              {completedMatches.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">No matches completed yet.</p>
              ) : (
                <div className="space-y-2">
                  {completedMatches.slice(0, 2).map((m) => {
                    const sideA = formatSideName(m.homeSideJson, "Side A");
                    const sideB = formatSideName(m.awaySideJson, "Side B");
                    return (
                      <div
                        key={m.id}
                        className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06]"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>{m.matchLabel || "Match"}</span>
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                            {m.state?.gamesLeft ?? 0} - {m.state?.gamesRight ?? 0}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {sideA} vs {sideB}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: MATCHES (Courts, Results, Schedule)
      ═══════════════════════════════════════════════════════════════════ */}
      {activeSectionNorm === "matches" && (
        <div className="flex flex-col gap-4">
          {/* Sub Navigation Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
            <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={cn(
                  "rounded-xl px-3 py-1.5 transition-colors cursor-pointer",
                  activeTab === "all"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300"
                )}
              >
                All ({matches.length})
              </button>
              {liveMatches.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("live_courts")}
                  className={cn(
                    "rounded-xl px-3 py-1.5 transition-colors cursor-pointer flex items-center gap-1.5",
                    activeTab === "live_courts"
                      ? "bg-emerald-600 text-white font-bold"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Courts ({liveMatches.length})
                </button>
              )}
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
            </div>
          </div>

          {/* Live Courts */}
          {(activeTab === "all" || activeTab === "live_courts") && liveMatches.length > 0 && (
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Live on Court ({liveMatches.length})
              </h3>
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
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-emerald-500 px-2 py-0.5 text-xs font-black text-black">
                            {court}
                          </span>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            {m.matchLabel || m.detail?.matchLabel || "Match"}
                          </span>
                        </div>
                        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Game {state?.currentGame || 1}
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
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
            </section>
          )}

          {/* Completed Results with Load More */}
          {(activeTab === "all" || activeTab === "results") && completedMatches.length > 0 && (
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Completed Results ({completedMatches.length})
              </h3>
              <div className="divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm dark:divide-white/[0.06] dark:border-white/10 dark:bg-[#131B2E]">
                {completedMatches.slice(0, completedPageSize).map((m) => {
                  const sideA = formatSideName(m.homeSideJson, "Side A");
                  const sideB = formatSideName(m.awaySideJson, "Side B");
                  const state = m.state;
                  const games = state?.games ?? [];
                  const winnerSide =
                    state?.winnerSide ||
                    (state?.gamesLeft && state?.gamesRight && state.gamesLeft > state.gamesRight
                      ? "left"
                      : "right");

                  return (
                    <article
                      key={m.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span>{m.matchLabel || m.detail?.matchLabel || "Match"}</span>
                          {m.detail?.courtNumber && <span>· {m.detail.courtNumber}</span>}
                        </div>
                        <div className="space-y-1">
                          <p
                            className={cn(
                              "text-sm font-bold truncate",
                              winnerSide === "left"
                                ? "text-slate-900 dark:text-white"
                                : "text-slate-500"
                            )}
                          >
                            {sideA} {winnerSide === "left" && "🏆"}
                          </p>
                          <p
                            className={cn(
                              "text-sm font-bold truncate",
                              winnerSide === "right"
                                ? "text-slate-900 dark:text-white"
                                : "text-slate-500"
                            )}
                          >
                            {sideB} {winnerSide === "right" && "🏆"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span className="rounded-lg bg-amber-500/15 px-2.5 py-1 font-mono text-xs font-bold text-amber-700 dark:text-amber-300">
                          {state?.gamesLeft ?? 0} - {state?.gamesRight ?? 0}
                        </span>
                        {games.map((g, idx) => (
                          <span
                            key={idx}
                            className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-white/[0.06] dark:text-slate-300"
                          >
                            {g.leftScore ?? 0}-{g.rightScore ?? 0}
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>

              {completedMatches.length > completedPageSize && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setCompletedPageSize((prev) => prev + 6)}
                    className="px-5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:bg-[#131B2E] dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.04] transition-colors cursor-pointer shadow-sm"
                  >
                    Load More Results ({completedMatches.length - completedPageSize} remaining)
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Upcoming Schedule */}
          {(activeTab === "all" || activeTab === "schedule") && upcomingMatches.length > 0 && (
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Upcoming Schedule ({upcomingMatches.length})
              </h3>
              <div className="divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm dark:divide-white/[0.06] dark:border-white/10 dark:bg-[#131B2E]">
                {upcomingMatches.map((m) => {
                  const sideA = formatSideName(m.homeSideJson, "TBD");
                  const sideB = formatSideName(m.awaySideJson, "TBD");

                  return (
                    <article
                      key={m.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
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
                          {new Date(m.scheduledAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default LiveScoringBoard;
