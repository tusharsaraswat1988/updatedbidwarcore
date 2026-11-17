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
      {/* Section Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[hsl(var(--muted))] border border-[hsl(var(--border))] max-w-full overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSection("live_courts")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
              activeSection === "live_courts"
                ? "bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            )}
          >
            Live Courts ({liveMatches.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("standings")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
              activeSection === "standings"
                ? "bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            )}
          >
            Points Table
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("results")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
              activeSection === "results"
                ? "bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            )}
          >
            Recent Results
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("schedule")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
              activeSection === "schedule"
                ? "bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            )}
          >
            Schedule
          </button>
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
                    className="p-5 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase text-[hsl(var(--primary))] tracking-wider">
                          {courtName}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest bg-[hsl(var(--muted))] px-2.5 py-1 rounded-md border border-[hsl(var(--border))]">
                        Game {state?.currentGame || 1}
                      </span>
                    </div>

                    {/* Scores & Sides */}
                    <div className="grid grid-cols-5 items-center gap-3">
                      {/* Left Side */}
                      <div className="col-span-2 text-left">
                        <p className="font-bold text-sm text-[hsl(var(--foreground))] truncate">
                          {leftId ? formatTeamPlayerLine(leftId) : "Side A"}
                        </p>
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">
                          {leftId?.teamName || "Pair A"}
                        </p>
                      </div>

                      {/* Center Live Score */}
                      <div className="col-span-1 flex flex-col items-center justify-center bg-[hsl(var(--muted))] p-2.5 rounded-xl border border-[hsl(var(--border))]">
                        <div className="flex items-baseline gap-1 text-xl font-black font-mono tracking-tight text-[hsl(var(--foreground))]">
                          <span className={state?.servingSide === "left" ? "text-[hsl(var(--primary))] underline decoration-2 underline-offset-4" : ""}>
                            {state?.leftScore ?? 0}
                          </span>
                          <span className="text-[hsl(var(--muted-foreground))] text-sm">-</span>
                          <span className={state?.servingSide === "right" ? "text-[hsl(var(--primary))] underline decoration-2 underline-offset-4" : ""}>
                            {state?.rightScore ?? 0}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold uppercase text-[hsl(var(--muted-foreground))] mt-0.5">
                          Games: {state?.gamesLeft ?? 0} - {state?.gamesRight ?? 0}
                        </span>
                      </div>

                      {/* Right Side */}
                      <div className="col-span-2 text-right">
                        <p className="font-bold text-sm text-[hsl(var(--foreground))] truncate">
                          {rightId ? formatTeamPlayerLine(rightId) : "Side B"}
                        </p>
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">
                          {rightId?.teamName || "Pair B"}
                        </p>
                      </div>
                    </div>

                    {/* Match Court Broadcast Stream */}
                    {(m.detail?.streamUrl || (m as any).streamUrl) && m.state?.status !== "completed" && m.state?.status !== "retired" && m.state?.status !== "walkover" && (
                      <div className="pt-2 border-t border-[hsl(var(--border))] flex items-center justify-end">
                        <a
                          href={m.detail?.streamUrl || (m as any).streamUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[hsl(var(--primary))/10] hover:bg-[hsl(var(--primary))/20] text-[hsl(var(--primary))] border border-[hsl(var(--primary))/20] transition-all shadow-sm"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          <span>Watch Stream</span>
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
                    className="p-3.5 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[hsl(var(--foreground))] truncate">
                        {(m.detail?.playerA as string) || "Player A"} vs {(m.detail?.playerB as string) || "Player B"}
                      </p>
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate mt-0.5">
                        {(m.detail?.courtName as string) || "Court TBA"} · {m.status.toUpperCase()}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-[hsl(var(--muted))] text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
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
                    className="p-4 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] space-y-3"
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))] pb-2">
                      <span className="uppercase tracking-widest text-[hsl(var(--primary))]">
                        Result Completed
                      </span>
                      <span>{(m.detail?.category as string) || "Badminton Match"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[hsl(var(--foreground))] truncate flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>{w}</span>
                        </p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate mt-0.5">
                          def. {l}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-mono font-bold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/10)] px-2 py-1 rounded-md border border-[hsl(var(--primary)/20)]">
                          {games.join(", ") || "Completed"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] text-sm">
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
                  className="p-3.5 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[hsl(var(--foreground))] truncate">
                      {(m.detail?.playerA as string) || "Player A"} vs {(m.detail?.playerB as string) || "Player B"}
                    </p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate mt-0.5">
                      {(m.detail?.courtName as string) || "Court TBA"} · {(m.detail?.category as string) || "Match"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide",
                      m.status === "completed"
                        ? "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                        : m.status === "live"
                        ? "bg-red-500/10 text-red-600 border border-red-500/20"
                        : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    )}
                  >
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] text-sm">
              No matches scheduled yet for this tournament.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BadmintonFanRenderer;
