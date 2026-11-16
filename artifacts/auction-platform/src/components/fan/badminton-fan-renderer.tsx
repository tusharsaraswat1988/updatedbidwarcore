import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Trophy,
  Calendar,
  Radio,
  Clock,
  Sparkles,
  Layers,
  ChevronRight,
  Flame,
  Award,
  ExternalLink,
} from "lucide-react";
import { fetchBadmintonMatches } from "@/lib/badminton-api";
import { subscribeBadmintonDashboardStream } from "@/hooks/use-badminton-match";
import { useBadmintonLeaderboardBoards } from "@/hooks/use-badminton-leaderboard-boards";
import { MatchPointsSummary } from "@/components/badminton/match-points-summary";
import { listLiveMatches } from "@/lib/badminton-broadcast-console";
import {
  listRecentCompleted,
  displayMatchSideScores,
  winnerLabel,
  loserLabel,
  gameScoreLines,
  type ResultsMatch,
} from "@/lib/badminton-results";
import { formatTeamPlayerLine, identityFromSideInfo } from "@/lib/team-player-identity";
import { cn } from "@/lib/utils";
import type { ScoringConnectionStatus } from "@/hooks/use-scoring-socket";

export interface BadmintonFanRendererProps {
  tournamentId: number;
}

type BadmintonFanSectionTab = "live_courts" | "standings" | "results" | "schedule";

/**
 * BadmintonFanRenderer
 *
 * Dedicated public spectator Badminton scoring experience.
 * Incorporates real-time multi-court score tracking, category league points tables,
 * completed match scorelines, and tournament schedule with active SSE event subscriptions.
 */
export function BadmintonFanRenderer({ tournamentId }: BadmintonFanRendererProps) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<BadmintonFanSectionTab>("live_courts");
  const [streamStatus, setStreamStatus] = useState<ScoringConnectionStatus>("reconnecting");

  // ── Realtime SSE Subscription ──────────────────────────────────────────────
  // Subscribes on mount, invalidates queries on court events, and unbinds cleanly on unmount
  useEffect(() => {
    if (!tournamentId || tournamentId <= 0) return;

    const unsub = subscribeBadmintonDashboardStream(
      tournamentId,
      () => {
        void queryClient.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
        void queryClient.invalidateQueries({ queryKey: ["badminton-leaderboards", tournamentId] });
      },
      (status) => {
        setStreamStatus(status);
      }
    );

    return () => {
      unsub();
    };
  }, [tournamentId, queryClient]);

  // ── Match List Query ───────────────────────────────────────────────────────
  const { data: matches = [], isLoading: isLoadingMatches } = useQuery<ResultsMatch[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: async () => {
      const data = await fetchBadmintonMatches(tournamentId);
      return data as ResultsMatch[];
    },
    enabled: tournamentId > 0,
    staleTime: 10_000,
  });

  // ── Leaderboards & Standings Query ─────────────────────────────────────────
  const leaderboards = useBadmintonLeaderboardBoards(tournamentId, tournamentId > 0);

  // Derive match partitions
  const liveMatches = useMemo(() => listLiveMatches(matches), [matches]);
  const recentCompleted = useMemo(() => listRecentCompleted(matches, 20), [matches]);
  const upcomingMatches = useMemo(
    () => matches.filter((m) => m.status === "scheduled" || m.status === "ready"),
    [matches]
  );

  return (
    <div className="w-full flex-1 flex flex-col space-y-5" data-testid="badminton-fan-renderer">
      {/* ── Realtime Status Bar & Sub-Navigation Pills ───────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/40 border border-white/10 rounded-2xl p-2.5 sm:p-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide">Badminton Court Center</span>
              {liveMatches.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-[10px] font-black text-red-400 uppercase tracking-wider animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  {liveMatches.length} Live Court{liveMatches.length > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium text-slate-400">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {upcomingMatches.length} Scheduled
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {streamStatus === "connected" ? (
                <span className="text-emerald-400 font-medium">● Real-time Live Connection Active</span>
              ) : (
                <span className="text-slate-400">Syncing tournament courts...</span>
              )}
            </p>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.08] max-w-full overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSection("live_courts")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
              activeSection === "live_courts"
                ? "bg-emerald-500 text-black font-bold shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-white/5"
            )}
          >
            Live Courts ({liveMatches.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("standings")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
              activeSection === "standings"
                ? "bg-emerald-500 text-black font-bold shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-white/5"
            )}
          >
            Points Table
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("results")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
              activeSection === "results"
                ? "bg-emerald-500 text-black font-bold shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-white/5"
            )}
          >
            Recent Results
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("schedule")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
              activeSection === "schedule"
                ? "bg-emerald-500 text-black font-bold shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-white/5"
            )}
          >
            Schedule
          </button>
        </div>
      </div>

      {/* ── Section Content ──────────────────────────────────────────────── */}
      {activeSection === "live_courts" && (
        <div className="space-y-4">
          {liveMatches.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {liveMatches.map((m) => {
                const state = m.state;
                const courtName = (m.detail?.courtName as string) || (m.detail?.courtNumber ? `Court ${m.detail.courtNumber}` : "Live Court");
                const leftId = state?.leftSide ? identityFromSideInfo(state.leftSide) : null;
                const rightId = state?.rightSide ? identityFromSideInfo(state.rightSide) : null;

                return (
                  <div
                    key={m.id}
                    className="p-5 rounded-2xl bg-[#121927] border border-emerald-500/30 shadow-xl space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">
                          {courtName}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
                        Game {state?.currentGame || 1}
                      </span>
                    </div>

                    {/* Scores & Sides */}
                    <div className="grid grid-cols-5 items-center gap-3">
                      {/* Left Side */}
                      <div className="col-span-2 text-left">
                        <p className="font-bold text-sm sm:text-base text-white truncate">
                          {leftId ? formatTeamPlayerLine(leftId) : "Side A"}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {leftId?.teamName || "Pair A"}
                        </p>
                      </div>

                      {/* Center Live Score */}
                      <div className="col-span-1 flex flex-col items-center justify-center bg-black/50 p-2.5 rounded-xl border border-white/10">
                        <div className="flex items-baseline gap-1 text-xl sm:text-2xl font-black font-mono tracking-tight text-white">
                          <span className={state?.servingSide === "left" ? "text-amber-400 underline decoration-amber-400 decoration-2" : ""}>
                            {state?.leftScore ?? 0}
                          </span>
                          <span className="text-slate-500 text-sm">-</span>
                          <span className={state?.servingSide === "right" ? "text-amber-400 underline decoration-amber-400 decoration-2" : ""}>
                            {state?.rightScore ?? 0}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold uppercase text-slate-400 mt-0.5">
                          Games: {state?.gamesLeft ?? 0} - {state?.gamesRight ?? 0}
                        </span>
                      </div>

                      {/* Right Side */}
                      <div className="col-span-2 text-right">
                        <p className="font-bold text-sm sm:text-base text-white truncate">
                          {rightId ? formatTeamPlayerLine(rightId) : "Side B"}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {rightId?.teamName || "Pair B"}
                        </p>
                      </div>
                    </div>

                    {/* Match Court Broadcast Stream if present */}
                    {(m.detail?.streamUrl || (m as any).streamUrl) && (
                      <div className="pt-2 border-t border-white/10 flex items-center justify-end">
                        <a
                          href={m.detail?.streamUrl || (m as any).streamUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-red-500/15 hover:bg-red-500/25 text-red-300 hover:text-white border border-red-500/30 transition-all shadow-sm"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse motion-reduce:animate-none" />
                          <span>Watch Court Stream</span>
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 sm:p-12 rounded-3xl bg-white/[0.02] border border-white/[0.06] text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-white">No Live Court In Progress</h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
                No matches are actively serving right now. Review scheduled matches or points standings below.
              </p>
            </div>
          )}

          {/* Upcoming Matches Preview */}
          {upcomingMatches.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Next Scheduled Court Matches
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {upcomingMatches.slice(0, 6).map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white truncate">
                        {(m.detail?.playerA as string) || "Player A"} vs {(m.detail?.playerB as string) || "Player B"}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {(m.detail?.courtName as string) || "Court Unassigned"} · {m.status.toUpperCase()}
                      </p>
                    </div>
                    <span className="px-2 py-1 rounded bg-white/5 text-[10px] text-slate-300 font-semibold uppercase">
                      Scheduled
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeSection === "standings" && (
        <div className="space-y-4">
          <MatchPointsSummary
            boards={leaderboards.boards}
            matches={matches}
            loading={leaderboards.loading || isLoadingMatches}
            emptyStandingsHint={
              leaderboards.leagueCategoryCount === 0
                ? "No group/league categories registered yet for this tournament."
                : undefined
            }
          />
        </div>
      )}

      {activeSection === "results" && (
        <div className="space-y-3">
          {recentCompleted.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentCompleted.map((m) => {
                const w = winnerLabel(m);
                const l = loserLabel(m);
                const games = gameScoreLines(m);

                return (
                  <div
                    key={m.id}
                    className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-white/5 pb-2">
                      <span className="font-semibold text-emerald-400 uppercase tracking-wider">
                        Result Completed
                      </span>
                      <span>{(m.detail?.category as string) || "Badminton Match"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{w}</span>
                        </p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          def. {l}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                          {games.join(", ") || "Completed"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/[0.06] text-slate-400 text-sm">
              No completed badminton matches recorded yet.
            </div>
          )}
        </div>
      )}

      {activeSection === "schedule" && (
        <div className="space-y-3">
          {matches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {matches.map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white truncate">
                      {(m.detail?.playerA as string) || "Player A"} vs {(m.detail?.playerB as string) || "Player B"}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {(m.detail?.courtName as string) || "Court TBA"} · {(m.detail?.category as string) || "Match"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                      m.status === "completed"
                        ? "bg-slate-800 text-slate-300 border border-slate-700"
                        : m.status === "live"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                    )}
                  >
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/[0.06] text-slate-400 text-sm">
              No matches scheduled yet for this tournament.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BadmintonFanRenderer;
