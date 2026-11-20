import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Radio,
  Trophy,
  Calendar,
  Award,
  ChevronRight,
  Flame,
  ArrowUpDown,
  Clock,
  CheckCircle2,
  ListOrdered,
  X,
  ExternalLink,
} from "lucide-react";
import { useFanScoringEvents, type FanScoringConnection } from "@/lib/api/use-fan-scoring-events";

type Team = { id: number; name: string; shortCode?: string; color?: string; logoUrl?: string };
type PublicMatch = {
  id: number;
  status?: string;
  homeTeamId?: number;
  awayTeamId?: number;
  scheduledAt?: string | null;
  resultSummary?: string | null;
  roundName?: string | null;
  tournamentMatchNumber?: number | null;
  summaryJson?: any;
};
type Schedule = { teams?: Team[]; matches?: PublicMatch[] };
type StandingRow = {
  teamId?: number;
  teamName?: string;
  shortCode?: string;
  color?: string;
  played?: number;
  won?: number;
  lost?: number;
  tied?: number;
  noResult?: number;
  points?: number;
  netRunRate?: number | string;
  drawId?: number | null;
  drawName?: string | null;
};
type LeaderRow = {
  rank?: number;
  playerId?: number;
  playerName?: string;
  teamName?: string;
  shortCode?: string;
  value?: number;
};
type BattingRow = {
  playerId: number;
  runs?: number;
  balls?: number;
  fours?: number;
  sixes?: number;
  notOut?: boolean;
  dismissalType?: string | null;
};
type BowlingRow = {
  playerId: number;
  overs?: string;
  maidens?: number;
  runs?: number;
  wickets?: number;
  economy?: number;
};
type ScorecardPayload = {
  match?: {
    id?: number;
    status?: string;
    resultSummary?: string | null;
    homeTeam?: { name?: string } | null;
    awayTeam?: { name?: string } | null;
  };
  scorecard?: {
    innings?: Array<{
      innings: number;
      battingTeamId?: number;
      runs?: number;
      wickets?: number;
      totalRuns?: number;
      totalWickets?: number;
      overs?: string;
      extras?: { total?: number; byes?: number; legByes?: number; wides?: number; noBalls?: number };
      batting?: BattingRow[];
      bowling?: BowlingRow[];
    }>;
  };
  players?: Record<string, string>;
  manOfTheMatch?: { playerName?: string; reason?: string | null } | null;
};

type LeaderboardCategory = "runs" | "wickets" | "sixes" | "fours" | "strike_rate";

const LEADER_CATEGORIES: Array<{ id: LeaderboardCategory; label: string; unit: string }> = [
  { id: "runs", label: "Most Runs", unit: "Runs" },
  { id: "wickets", label: "Most Wickets", unit: "Wkts" },
  { id: "sixes", label: "Most Sixes", unit: "Sixes" },
  { id: "fours", label: "Most Fours", unit: "Fours" },
  { id: "strike_rate", label: "Highest Strike Rate", unit: "SR" },
];

const LIVE_STATUSES = new Set(["live", "in_progress"]);
const NO_MATCHES: PublicMatch[] = [];

function isLiveStatus(status: string | null | undefined) {
  return LIVE_STATUSES.has((status || "").toLowerCase());
}

function statusLabel(status: string | null | undefined) {
  const value = (status || "").toLowerCase();
  if (isLiveStatus(value)) return "Live";
  if (value === "completed") return "Completed";
  if (value === "scheduled" || value === "ready" || value === "draft") return "Upcoming";
  if (!value) return "Scheduled";
  return value;
}

function asRows(payload: unknown): StandingRow[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as { standings?: unknown };
  return Array.isArray(record.standings) ? (record.standings as StandingRow[]) : [];
}

function formatWhen(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRate(value: number | string | undefined) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    if (!trimmed || !Number.isFinite(parsed)) return trimmed || "—";
    return parsed > 0 && !trimmed.startsWith("+") ? `+${trimmed}` : trimmed;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 1000) / 1000;
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function connectionCopy(connection: FanScoringConnection) {
  if (connection === "connected") return "Live updates connected";
  if (connection === "reconnecting") return "Reconnecting to live scores";
  if (connection === "disconnected") return "Live updates disconnected";
  return "Connecting to live scores";
}

function stringOf(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOf(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nameOf(names: Record<string, string>, id: number | null) {
  if (id == null) return null;
  return names[String(id)] || null;
}

export interface CricketFanExperienceProps {
  tournamentId: number;
  activeSection?: string;
  onNavigateSection?: (section: any) => void;
}

export function CricketFanExperience({
  tournamentId,
  activeSection = "overview",
  onNavigateSection,
}: CricketFanExperienceProps) {
  const { display, connection } = useFanScoringEvents(tournamentId, tournamentId > 0);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [scheduleReady, setScheduleReady] = useState(false);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [standingsHasGroups, setStandingsHasGroups] = useState(false);
  const [standingsGroups, setStandingsGroups] = useState<any[]>([]);

  // Leaders state
  const [selectedLeaderCategory, setSelectedLeaderCategory] = useState<LeaderboardCategory>("runs");
  const [categoryLeaders, setCategoryLeaders] = useState<LeaderRow[]>([]);
  const [overviewRunsLeaders, setOverviewRunsLeaders] = useState<LeaderRow[]>([]);
  const [overviewWicketsLeaders, setOverviewWicketsLeaders] = useState<LeaderRow[]>([]);
  const [showAllCategoryLeaders, setShowAllCategoryLeaders] = useState(false);

  // Scorecard modal state
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scorecard, setScorecard] = useState<ScorecardPayload | null>(null);
  const [scorecardError, setScorecardError] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  // Matches section sub-filter & pagination
  const [matchCategoryFilter, setMatchCategoryFilter] = useState<"all" | "live" | "upcoming" | "completed">("all");
  const [completedPageSize, setCompletedPageSize] = useState<number>(6);

  // Standings group filter
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  const sequence = display?.sequence ?? null;

  // 1. Fetch public schedule
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tournaments/${tournamentId}/scoring/public/schedule`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: Schedule | null) => {
        if (!cancelled) setSchedule(body);
      })
      .catch(() => {
        if (!cancelled) setSchedule(null);
      })
      .finally(() => {
        if (!cancelled) setScheduleReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  // 2. Fetch standings & overview leaders
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      // Standings
      fetch(`/api/tournaments/${tournamentId}/scoring/standings`)
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (!cancelled && body) {
            setStandings(asRows(body));
            setStandingsHasGroups(Boolean(body.hasGroups));
            setStandingsGroups(Array.isArray(body.groups) ? body.groups : []);
          }
        })
        .catch(() => {
          if (!cancelled) setStandings([]);
        });

      // Overview Top Runs
      fetch(`/api/tournaments/${tournamentId}/scoring/leaderboards/runs?limit=3`)
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { rows?: LeaderRow[] } | null) => {
          if (!cancelled) setOverviewRunsLeaders(body?.rows ?? []);
        })
        .catch(() => {
          if (!cancelled) setOverviewRunsLeaders([]);
        });

      // Overview Top Wickets
      fetch(`/api/tournaments/${tournamentId}/scoring/leaderboards/wickets?limit=3`)
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { rows?: LeaderRow[] } | null) => {
          if (!cancelled) setOverviewWicketsLeaders(body?.rows ?? []);
        })
        .catch(() => {
          if (!cancelled) setOverviewWicketsLeaders([]);
        });
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, sequence]);

  // 3. Fetch selected leaderboard category
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tournaments/${tournamentId}/scoring/leaderboards/${selectedLeaderCategory}?limit=20`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { rows?: LeaderRow[] } | null) => {
        if (!cancelled) {
          setCategoryLeaders(body?.rows ?? []);
          setShowAllCategoryLeaders(false);
        }
      })
      .catch(() => {
        if (!cancelled) setCategoryLeaders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, selectedLeaderCategory, sequence]);

  // Teams map
  const teams = useMemo(() => {
    const map = new Map<number, string>();
    for (const team of schedule?.teams ?? []) {
      if (team.id != null && team.name) map.set(team.id, team.name);
    }
    for (const row of standings) {
      if (row.teamId != null && row.teamName) map.set(row.teamId, row.teamName);
    }
    return map;
  }, [schedule, standings]);

  const matches = schedule?.matches ?? NO_MATCHES;
  const knownMatchIds = useMemo(() => new Set(matches.map((m) => m.id)), [matches]);

  // Realtime live match state derivation
  const state = display?.state;
  const summary = display?.summary;
  const match = display?.match;
  const matchStatus = stringOf(state?.matchStatus) || stringOf(match?.status);
  const live = isLiveStatus(matchStatus);
  const currentInnings = numberOf(state?.currentInnings);
  const innings = Array.isArray(summary?.innings)
    ? (summary.innings as Array<Record<string, unknown>>)
    : [];
  const currentLine =
    innings.find((row) => numberOf(row.innings) === currentInnings) ??
    innings[innings.length - 1];
  const battingTeamId = numberOf(currentLine?.battingTeamId);
  const bowlingTeamId = numberOf(currentLine?.bowlingTeamId);
  const liveMatchId = numberOf(match?.id);

  // Look up players for live match
  useEffect(() => {
    if (!liveMatchId || !knownMatchIds.has(liveMatchId)) return;
    let cancelled = false;
    fetch(`/api/tournaments/${tournamentId}/scoring/matches/${liveMatchId}/scorecard`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: ScorecardPayload | null) => {
        if (cancelled || !body?.players) return;
        setNames((current) => ({ ...current, ...body.players }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tournamentId, liveMatchId, knownMatchIds]);

  const strikerId = numberOf(state?.strikerId);
  const nonStrikerId = numberOf(state?.nonStrikerId);
  const bowlerId = numberOf(state?.bowlerId);
  const lookedUp = useRef(new Set<number>());

  useEffect(() => {
    const missing = [strikerId, nonStrikerId, bowlerId].filter(
      (id): id is number => id != null && !names[String(id)] && !lookedUp.current.has(id)
    );
    if (missing.length === 0) return;
    let cancelled = false;
    for (const id of missing) {
      lookedUp.current.add(id);
      fetch(`/api/tournaments/${tournamentId}/scoring/public/players/${id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { player?: { name?: string } } | null) => {
          const name = body?.player?.name;
          if (!cancelled && name) setNames((current) => ({ ...current, [String(id)]: name }));
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [tournamentId, strikerId, nonStrikerId, bowlerId, names]);

  // Fetch scorecard for selectedId
  useEffect(() => {
    if (selectedId == null) {
      setScorecard(null);
      return;
    }
    if (!scheduleReady) return;
    if (!knownMatchIds.has(selectedId)) {
      setScorecard(null);
      setScorecardError("That match is not part of this tournament.");
      return;
    }
    let cancelled = false;
    setScorecardError(null);
    fetch(`/api/tournaments/${tournamentId}/scoring/matches/${selectedId}/scorecard`)
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json() as Promise<ScorecardPayload>;
      })
      .then((body) => {
        if (!cancelled) setScorecard(body);
      })
      .catch(() => {
        if (!cancelled) setScorecardError("Scorecard is not available for this match.");
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, selectedId, knownMatchIds, scheduleReady]);

  const battingName = battingTeamId != null ? teams.get(battingTeamId) : undefined;
  const bowlingName = bowlingTeamId != null ? teams.get(bowlingTeamId) : undefined;
  const tossWinnerId = numberOf(state?.tossWinnerTeamId);
  const tossWinner = tossWinnerId != null ? teams.get(tossWinnerId) : undefined;
  const elected = stringOf(state?.electedTo);
  const result = stringOf(summary?.resultText) || stringOf(match?.resultSummary);
  const runs = numberOf(currentLine?.runs);
  const wickets = numberOf(currentLine?.wickets);
  const overs = stringOf(currentLine?.overs);
  const scoreText =
    runs != null && wickets != null ? `${runs}/${wickets}${overs ? ` (${overs})` : ""}` : null;

  // Match categorizations
  const grouped = useMemo(
    () => ({
      live: matches.filter((item) => isLiveStatus(item.status)),
      upcoming: matches.filter(
        (item) => !isLiveStatus(item.status) && (item.status || "").toLowerCase() !== "completed"
      ),
      completed: matches.filter((item) => (item.status || "").toLowerCase() === "completed"),
    }),
    [matches]
  );

  // Group-wise standings filter
  const filteredStandings = useMemo(() => {
    if (selectedGroup === "all") return standings;
    return standings.filter((row) => String(row.drawId ?? "") === selectedGroup);
  }, [standings, selectedGroup]);

  const activeSectionNorm = (activeSection === "scoring" ? "overview" : activeSection).toLowerCase();

  return (
    <div
      className="flex flex-col gap-4 w-full"
      data-testid="cricket-fan-experience"
      data-connection={connection}
      data-sequence={sequence ?? ""}
    >
      {/* ── Top Live Status Pulse Strip ─────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span
            className={`w-2 h-2 rounded-full ${
              connection === "connected"
                ? "bg-emerald-500"
                : connection === "reconnecting"
                ? "bg-amber-500 animate-ping"
                : "bg-slate-400"
            }`}
          />
          {connectionCopy(connection)}
        </span>
        {live && (
          <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-500" />
            Live Scoring In Progress
          </span>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: OVERVIEW (Default Landing Section)
      ═══════════════════════════════════════════════════════════════════ */}
      {activeSectionNorm === "overview" && (
        <div className="flex flex-col gap-4">
          {/* ── 1. Compact Live Match Highlight or Next/Latest Featured Card ── */}
          {live ? (
            <section className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-white p-5 shadow-lg dark:border-emerald-500/20 dark:bg-[#131B2E] sm:p-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  Cricket Live
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={matchStatus} />
                  {liveMatchId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(liveMatchId);
                        onNavigateSection?.("matches");
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-colors cursor-pointer"
                    >
                      Scorecard →
                    </button>
                  )}
                </div>
              </div>

              {(stringOf(match?.roundName) || stringOf(match?.venue)) && (
                <p className="mb-2 text-xs text-slate-500">
                  {[stringOf(match?.roundName), stringOf(match?.venue)].filter(Boolean).join(" · ")}
                </p>
              )}

              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {currentInnings ? `Innings ${currentInnings}` : "Current innings"}
                {bowlingName ? ` · Bowling ${bowlingName}` : ""}
              </p>

              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  {battingName || "Live innings"}
                </h2>
                <p className="font-display text-3xl sm:text-4xl font-black text-amber-500 dark:text-amber-400">
                  {scoreText || "—"}
                </p>
              </div>

              {/* Batting & Bowling status */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 pt-3 dark:border-white/[0.06]">
                <PlayerLine label="Striker" name={nameOf(names, strikerId)} />
                <PlayerLine label="Non-striker" name={nameOf(names, nonStrikerId)} />
                <PlayerLine label="Bowler" name={nameOf(names, bowlerId)} />
              </div>

              {tossWinner && elected && (
                <p className="mt-2.5 text-[11px] text-slate-500">{tossWinner} elected to {elected}</p>
              )}
              {result && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{result}</p>}
            </section>
          ) : grouped.upcoming.length > 0 ? (
            /* Next Upcoming Match Highlight */
            (() => {
              const nextMatch = grouped.upcoming[0];
              const home = nextMatch.homeTeamId != null ? teams.get(nextMatch.homeTeamId) : undefined;
              const away = nextMatch.awayTeamId != null ? teams.get(nextMatch.awayTeamId) : undefined;
              const when = formatWhen(nextMatch.scheduledAt);
              return (
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#131B2E]">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                      <Clock className="w-3.5 h-3.5" /> Next Match
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigateSection?.("matches")}
                      className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      View All Matches →
                    </button>
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {home && away ? `${home} vs ${away}` : "Fixture Scheduled"}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    {when && <span>{when}</span>}
                    {nextMatch.roundName && <span>· {nextMatch.roundName}</span>}
                    {nextMatch.tournamentMatchNumber && (
                      <span>· Match {nextMatch.tournamentMatchNumber}</span>
                    )}
                  </div>
                </section>
              );
            })()
          ) : grouped.completed.length > 0 ? (
            /* Latest Result Highlight */
            (() => {
              const latest = grouped.completed[grouped.completed.length - 1];
              const home = latest.homeTeamId != null ? teams.get(latest.homeTeamId) : undefined;
              const away = latest.awayTeamId != null ? teams.get(latest.awayTeamId) : undefined;
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
                  <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    {home && away ? `${home} vs ${away}` : "Completed Match"}
                  </h3>
                  {latest.resultSummary && (
                    <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {latest.resultSummary}
                    </p>
                  )}
                </section>
              );
            })()
          ) : null}

          {/* ── 2. Quick Match Center Preview (Upcoming & Completed) ── */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Upcoming Previews */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#131B2E]">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  Upcoming ({grouped.upcoming.length})
                </div>
                {grouped.upcoming.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMatchCategoryFilter("upcoming");
                      onNavigateSection?.("matches");
                    }}
                    className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    See all →
                  </button>
                )}
              </div>

              {grouped.upcoming.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">No upcoming fixtures scheduled.</p>
              ) : (
                <div className="space-y-2">
                  {grouped.upcoming.slice(0, 2).map((m) => {
                    const home = m.homeTeamId != null ? teams.get(m.homeTeamId) : undefined;
                    const away = m.awayTeamId != null ? teams.get(m.awayTeamId) : undefined;
                    const when = formatWhen(m.scheduledAt);
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedId(m.id);
                          onNavigateSection?.("matches");
                        }}
                        className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] hover:border-amber-500/40 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span>{m.tournamentMatchNumber ? `Match ${m.tournamentMatchNumber}` : "Fixture"}</span>
                          {when && <span>{when}</span>}
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {home && away ? `${home} vs ${away}` : "Teams to be announced"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Completed Previews */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#131B2E]">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Completed ({grouped.completed.length})
                </div>
                {grouped.completed.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMatchCategoryFilter("completed");
                      onNavigateSection?.("matches");
                    }}
                    className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    See all →
                  </button>
                )}
              </div>

              {grouped.completed.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">No matches completed yet.</p>
              ) : (
                <div className="space-y-2">
                  {grouped.completed.slice(-2).reverse().map((m) => {
                    const home = m.homeTeamId != null ? teams.get(m.homeTeamId) : undefined;
                    const away = m.awayTeamId != null ? teams.get(m.awayTeamId) : undefined;
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedId(m.id);
                          onNavigateSection?.("matches");
                        }}
                        className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] hover:border-amber-500/40 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span>{m.tournamentMatchNumber ? `Match ${m.tournamentMatchNumber}` : "Completed"}</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Done</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {home && away ? `${home} vs ${away}` : "Match"}
                        </p>
                        {m.resultSummary && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
                            {m.resultSummary}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* ── 3. Standings Preview (Top 5 Rows) ── */}
          {standings.length > 0 && (
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#131B2E]">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Standings Preview</h3>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateSection?.("standings")}
                  className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  View Full Table ({standings.length}) →
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-white/[0.02]">
                    <tr>
                      <th className="px-4 py-2.5 font-bold">#</th>
                      <th className="px-3 py-2.5 font-bold">Team</th>
                      <th className="px-3 py-2.5 font-bold text-center">P</th>
                      <th className="px-3 py-2.5 font-bold text-center">W</th>
                      <th className="px-3 py-2.5 font-bold text-center">PTS</th>
                      <th className="px-3 py-2.5 font-bold text-right pr-4">NRR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {standings.slice(0, 5).map((row, idx) => (
                      <tr key={row.teamId ?? idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                        <td className="px-4 py-2 font-bold text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2 font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                          {row.teamName || "—"}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">{row.played ?? 0}</td>
                        <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">{row.won ?? 0}</td>
                        <td className="px-3 py-2 text-center font-bold text-amber-600 dark:text-amber-400">{row.points ?? 0}</td>
                        <td className="px-3 py-2 text-right pr-4 font-mono text-[11px] text-slate-500">
                          {formatRate(row.netRunRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── 4. Top Performers Preview (Top 3 Runs & Wickets) ── */}
          {(overviewRunsLeaders.length > 0 || overviewWicketsLeaders.length > 0) && (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#131B2E]">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top Performers</h3>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateSection?.("leaders")}
                  className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  View All Leaderboards →
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Most Runs Top 3 */}
                <div className="rounded-2xl bg-amber-500/[0.05] border border-amber-500/20 p-3.5">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      🏏 Most Runs
                    </span>
                  </div>
                  {overviewRunsLeaders.length === 0 ? (
                    <p className="text-xs text-slate-500">No batting figures recorded.</p>
                  ) : (
                    <ol className="space-y-1.5">
                      {overviewRunsLeaders.slice(0, 3).map((player, idx) => (
                        <li key={idx} className="flex items-center justify-between text-xs py-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white truncate">
                              {player.playerName || "Player"}
                            </span>
                          </div>
                          <span className="font-display font-black text-amber-600 dark:text-amber-400 shrink-0 ml-2">
                            {player.value ?? 0} Runs
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {/* Most Wickets Top 3 */}
                <div className="rounded-2xl bg-purple-500/[0.05] border border-purple-500/20 p-3.5">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                      🎯 Most Wickets
                    </span>
                  </div>
                  {overviewWicketsLeaders.length === 0 ? (
                    <p className="text-xs text-slate-500">No bowling figures recorded.</p>
                  ) : (
                    <ol className="space-y-1.5">
                      {overviewWicketsLeaders.slice(0, 3).map((player, idx) => (
                        <li key={idx} className="flex items-center justify-between text-xs py-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white truncate">
                              {player.playerName || "Player"}
                            </span>
                          </div>
                          <span className="font-display font-black text-purple-600 dark:text-purple-400 shrink-0 ml-2">
                            {player.value ?? 0} Wkts
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: MATCHES (All, Live, Upcoming, Completed with Load More)
      ═══════════════════════════════════════════════════════════════════ */}
      {activeSectionNorm === "matches" && (
        <div className="flex flex-col gap-4">
          {/* Sub Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
            <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMatchCategoryFilter("all")}
                className={`px-3 py-1.5 rounded-xl cursor-pointer transition-colors ${
                  matchCategoryFilter === "all"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300"
                }`}
              >
                All ({matches.length})
              </button>
              {grouped.live.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMatchCategoryFilter("live")}
                  className={`px-3 py-1.5 rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 ${
                    matchCategoryFilter === "live"
                      ? "bg-emerald-600 text-white font-bold"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
                  Live ({grouped.live.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setMatchCategoryFilter("upcoming")}
                className={`px-3 py-1.5 rounded-xl cursor-pointer transition-colors ${
                  matchCategoryFilter === "upcoming"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300"
                }`}
              >
                Upcoming ({grouped.upcoming.length})
              </button>
              <button
                type="button"
                onClick={() => setMatchCategoryFilter("completed")}
                className={`px-3 py-1.5 rounded-xl cursor-pointer transition-colors ${
                  matchCategoryFilter === "completed"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300"
                }`}
              >
                Completed ({grouped.completed.length})
              </button>
            </div>
          </div>

          {/* Interactive Scorecard Detail View */}
          {selectedId != null && (
            <ScorecardView
              card={scorecard}
              error={scorecardError}
              teams={teams}
              onClose={() => setSelectedId(null)}
            />
          )}

          {/* Match Lists */}
          {!scheduleReady ? (
            <p className="text-sm text-slate-500 py-6 text-center">Loading tournament fixtures…</p>
          ) : matches.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-[#131B2E]">
              <Calendar className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm text-slate-500">Fixtures have not been announced for this tournament yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Live Category */}
              {(matchCategoryFilter === "all" || matchCategoryFilter === "live") &&
                grouped.live.length > 0 && (
                  <section>
                    <h3 className="mb-2.5 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Live Matches ({grouped.live.length})
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {grouped.live.map((m) => renderMatchCard(m, teams, selectedId, setSelectedId))}
                    </div>
                  </section>
                )}

              {/* Upcoming Category */}
              {(matchCategoryFilter === "all" || matchCategoryFilter === "upcoming") &&
                grouped.upcoming.length > 0 && (
                  <section>
                    <h3 className="mb-2.5 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      Upcoming Fixtures ({grouped.upcoming.length})
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {grouped.upcoming.map((m) => renderMatchCard(m, teams, selectedId, setSelectedId))}
                    </div>
                  </section>
                )}

              {/* Completed Category with Pagination */}
              {(matchCategoryFilter === "all" || matchCategoryFilter === "completed") &&
                grouped.completed.length > 0 && (
                  <section>
                    <h3 className="mb-2.5 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Completed Matches ({grouped.completed.length})
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {grouped.completed
                        .slice(0, completedPageSize)
                        .map((m) => renderMatchCard(m, teams, selectedId, setSelectedId))}
                    </div>

                    {/* Load More Button for Completed Matches */}
                    {grouped.completed.length > completedPageSize && (
                      <div className="mt-4 text-center">
                        <button
                          type="button"
                          onClick={() => setCompletedPageSize((prev) => prev + 6)}
                          className="px-5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:bg-[#131B2E] dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.04] transition-colors cursor-pointer shadow-sm"
                        >
                          Load More Matches ({grouped.completed.length - completedPageSize} remaining)
                        </button>
                      </div>
                    )}
                  </section>
                )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3: STANDINGS (Full Points Table Only)
      ═══════════════════════════════════════════════════════════════════ */}
      {activeSectionNorm === "standings" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Tournament Standings
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Official points table and net run rate standings.
              </p>
            </div>

            {/* Group Tabs (if tournament has multiple groups) */}
            {standingsHasGroups && standingsGroups.length > 0 && (
              <div className="flex gap-1.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSelectedGroup("all")}
                  className={`px-3 py-1 rounded-xl cursor-pointer ${
                    selectedGroup === "all"
                      ? "bg-amber-500 text-black font-bold"
                      : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                  }`}
                >
                  All Groups
                </button>
                {standingsGroups.map((grp) => (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => setSelectedGroup(String(grp.id))}
                    className={`px-3 py-1 rounded-xl cursor-pointer ${
                      selectedGroup === String(grp.id)
                        ? "bg-amber-500 text-black font-bold"
                        : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                    }`}
                  >
                    {grp.name || `Group ${grp.id}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {standings.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-[#131B2E]">
              <Trophy className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm text-slate-500">Points table has not been generated for this tournament yet.</p>
            </div>
          ) : (
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#131B2E]">
              <div className="overflow-x-auto relative">
                <table className="w-full min-w-[540px] sm:min-w-[640px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-white/[0.03] border-b border-slate-100 dark:border-white/10">
                    <tr>
                      <th className="px-3 py-3 text-center w-10">#</th>
                      <th className="px-4 py-3 font-semibold sticky left-0 bg-slate-50 dark:bg-[#131B2E] z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                        Team
                      </th>
                      {["P", "W", "L", "T", "NR", "Pts", "NRR"].map((heading) => (
                        <th key={heading} className="px-3 py-3 font-semibold text-center">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {filteredStandings.map((row, index) => (
                      <tr
                        key={row.teamId ?? index}
                        className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-3 py-3 text-center font-bold text-slate-400 text-xs">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white sticky left-0 bg-white dark:bg-[#131B2E] z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                          <div className="flex items-center gap-2">
                            {row.color && (
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: row.color }}
                              />
                            )}
                            <span className="truncate max-w-[150px] sm:max-w-[200px]">
                              {row.teamName || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-300">{row.played ?? 0}</td>
                        <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-300">{row.won ?? 0}</td>
                        <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-300">{row.lost ?? 0}</td>
                        <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-300">{row.tied ?? 0}</td>
                        <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-300">{row.noResult ?? 0}</td>
                        <td className="px-3 py-3 text-center font-black text-amber-600 dark:text-amber-400 text-base">
                          {row.points ?? 0}
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-xs text-slate-500">
                          {formatRate(row.netRunRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Explanatory Legend */}
              <div className="p-3 border-t border-slate-100 bg-slate-50/50 dark:border-white/[0.05] dark:bg-white/[0.01] text-[10px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                <span><strong>P</strong> = Played</span>
                <span><strong>W</strong> = Won</span>
                <span><strong>L</strong> = Lost</span>
                <span><strong>T</strong> = Tied</span>
                <span><strong>NR</strong> = No Result</span>
                <span><strong>Pts</strong> = Points</span>
                <span><strong>NRR</strong> = Net Run Rate</span>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4: LEADERS (Sport-Specific Leaderboard Categories)
      ═══════════════════════════════════════════════════════════════════ */}
      {activeSectionNorm === "leaders" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Player Leaderboards
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Top individual performers across the tournament.
              </p>
            </div>
          </div>

          {/* Category Selector Pills */}
          <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-white/10 pb-3">
            {LEADER_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedLeaderCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedLeaderCategory === cat.id
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {categoryLeaders.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-[#131B2E]">
              <Award className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm text-slate-500">
                No figures published yet for{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {LEADER_CATEGORIES.find((c) => c.id === selectedLeaderCategory)?.label}
                </span>.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Top 3 Podium Cards */}
              <div className="grid gap-3 sm:grid-cols-3">
                {categoryLeaders.slice(0, 3).map((player, idx) => {
                  const rankColors = [
                    "border-amber-400/50 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                    "border-slate-300/60 bg-slate-100/60 text-slate-700 dark:border-slate-500/40 dark:bg-slate-800/60 dark:text-slate-200",
                    "border-amber-700/40 bg-amber-700/10 text-amber-700 dark:text-amber-500",
                  ];
                  const badges = ["🥇 1st", "🥈 2nd", "🥉 3rd"];

                  return (
                    <div
                      key={idx}
                      className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm flex flex-col justify-between ${rankColors[idx]}`}
                    >
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest block mb-1">
                          {badges[idx]}
                        </span>
                        <h4 className="font-display text-base font-black text-slate-900 dark:text-white truncate">
                          {player.playerName || "Player"}
                        </h4>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {player.teamName || "—"}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-current/10 flex items-baseline justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {LEADER_CATEGORIES.find((c) => c.id === selectedLeaderCategory)?.unit}
                        </span>
                        <span className="font-display text-2xl font-black">
                          {player.value ?? 0}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ranks 4 through 20 */}
              {categoryLeaders.length > 3 && (
                <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#131B2E]">
                  <ol className="divide-y divide-slate-100 dark:divide-white/5">
                    {(showAllCategoryLeaders
                      ? categoryLeaders.slice(3)
                      : categoryLeaders.slice(3, 8)
                    ).map((player, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-xs font-bold text-slate-400 w-5">
                            #{idx + 4}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {player.playerName || "—"}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{player.teamName || ""}</p>
                          </div>
                        </div>
                        <p className="font-display text-lg font-black text-amber-600 dark:text-amber-400 shrink-0">
                          {player.value ?? "—"}
                        </p>
                      </li>
                    ))}
                  </ol>

                  {categoryLeaders.length > 8 && !showAllCategoryLeaders && (
                    <div className="p-3 text-center border-t border-slate-100 dark:border-white/5">
                      <button
                        type="button"
                        onClick={() => setShowAllCategoryLeaders(true)}
                        className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        Show All {categoryLeaders.length} Performers ↓
                      </button>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Match Card Renderer ─────────────────────────────────────────────────────
function renderMatchCard(
  match: PublicMatch,
  teams: Map<number, string>,
  selectedId: number | null,
  onSelect: (id: number) => void
) {
  const home = match.homeTeamId != null ? teams.get(match.homeTeamId) : undefined;
  const away = match.awayTeamId != null ? teams.get(match.awayTeamId) : undefined;
  const when = formatWhen(match.scheduledAt);
  const live = isLiveStatus(match.status);
  const isSelected = selectedId === match.id;

  return (
    <button
      key={match.id}
      type="button"
      onClick={() => onSelect(match.id)}
      className={`rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer ${
        isSelected
          ? "border-amber-500 bg-amber-500/10 shadow-md"
          : live
          ? "border-emerald-500/40 bg-white dark:bg-[#131B2E] shadow-sm hover:border-emerald-500"
          : "border-slate-200 bg-white dark:border-white/10 dark:bg-[#131B2E] hover:border-amber-500/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
        <span>
          {match.tournamentMatchNumber ? `Match ${match.tournamentMatchNumber}` : "Fixture"}
          {match.roundName ? ` · ${match.roundName}` : ""}
        </span>
        <StatusPill status={match.status ?? null} />
      </div>

      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
        {home && away ? `${home} vs ${away}` : "Teams to be announced"}
      </p>

      {when && <p className="mt-1 text-xs text-slate-500">{when}</p>}

      {match.resultSummary && (
        <p className="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
          {match.resultSummary}
        </p>
      )}

      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
        <span>View scorecard</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </button>
  );
}

// ── Small Status Pill ────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string | null }) {
  const live = isLiveStatus(status);
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
        live
          ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 animate-pulse"
          : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

// ── Player Stat Line ─────────────────────────────────────────────────────────
function PlayerLine({ label, name }: { label: string; name: string | null }) {
  if (!name) return null;
  return (
    <div>
      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="font-semibold truncate block">{name}</span>
    </div>
  );
}

// ── Detailed Scorecard Drawer / View ─────────────────────────────────────────
function ScorecardView({
  card,
  error,
  teams,
  onClose,
}: {
  card: ScorecardPayload | null;
  error: string | null;
  teams: Map<number, string>;
  onClose: () => void;
}) {
  const players = card?.players ?? {};

  return (
    <section className="rounded-3xl border border-amber-500/40 bg-white p-5 shadow-xl dark:border-amber-500/30 dark:bg-[#131B2E]">
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Scorecard</span>
            {card?.match?.status && <StatusPill status={card.match.status} />}
          </h3>
          {card?.match?.homeTeam?.name && card.match.awayTeam?.name && (
            <p className="text-xs text-slate-500 mt-0.5">
              {card.match.homeTeam.name} vs {card.match.awayTeam.name}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          aria-label="Close scorecard"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && <p className="text-sm text-red-500 py-3">{error}</p>}
      {!error && !card && <p className="text-sm text-slate-500 py-3">Loading scorecard…</p>}

      {card?.match?.resultSummary && (
        <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          Result: {card.match.resultSummary}
        </div>
      )}

      {card?.manOfTheMatch?.playerName && !/^Player \d+$/.test(card.manOfTheMatch.playerName) && (
        <div className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
          <strong>🏆 Player of the match:</strong> {card.manOfTheMatch.playerName}
          {card.manOfTheMatch.reason ? ` · ${card.manOfTheMatch.reason}` : ""}
        </div>
      )}

      {(card?.scorecard?.innings ?? []).map((innings) => (
        <div key={innings.innings} className="mb-6 last:mb-0">
          <div className="mb-2 flex items-baseline justify-between border-b border-slate-100 pb-1.5 dark:border-white/[0.06]">
            <p className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Innings {innings.innings}
              {innings.battingTeamId != null && teams.get(innings.battingTeamId)
                ? ` · ${teams.get(innings.battingTeamId)}`
                : ""}
            </p>
            {(innings.totalRuns != null || innings.overs) && (
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {innings.totalRuns ?? 0}/{innings.totalWickets ?? 0}
                {innings.overs ? ` (${innings.overs} ov)` : ""}
              </p>
            )}
          </div>

          {(innings.batting ?? []).length === 0 && (innings.bowling ?? []).length === 0 && (
            <p className="text-xs text-slate-500 py-2">No batting or bowling card recorded for this innings.</p>
          )}

          {/* Batting Table */}
          {(innings.batting ?? []).length > 0 && (
            <div className="overflow-x-auto mb-3">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead className="text-[10px] uppercase text-slate-400 bg-slate-50/60 dark:bg-white/[0.02]">
                  <tr>
                    <th className="py-1.5 px-2">Batter</th>
                    <th className="px-2 text-center">R</th>
                    <th className="px-2 text-center">B</th>
                    <th className="px-2 text-center">4s</th>
                    <th className="px-2 text-center">6s</th>
                    <th className="px-2 text-right">SR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {innings.batting?.map((row) => {
                    const sr =
                      row.balls && row.balls > 0 && row.runs != null
                        ? Math.round((row.runs / row.balls) * 100 * 10) / 10
                        : "—";
                    return (
                      <tr key={row.playerId}>
                        <td className="py-2 px-2 font-semibold text-slate-900 dark:text-white">
                          {players[String(row.playerId)] || "—"}
                          {row.notOut ? " *" : ""}
                          {row.dismissalType && (
                            <span className="block text-[10px] font-normal text-slate-400">
                              {row.dismissalType}
                            </span>
                          )}
                        </td>
                        <td className="px-2 text-center font-bold text-slate-900 dark:text-white">
                          {row.runs ?? 0}
                        </td>
                        <td className="px-2 text-center text-slate-500">{row.balls ?? 0}</td>
                        <td className="px-2 text-center text-slate-500">{row.fours ?? 0}</td>
                        <td className="px-2 text-center text-slate-500">{row.sixes ?? 0}</td>
                        <td className="px-2 text-right font-mono text-slate-400">{sr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {innings.extras && typeof innings.extras.total === "number" && (
            <p className="mb-3 text-[11px] text-slate-500">
              Extras: <strong>{innings.extras.total}</strong>
              {` (b ${innings.extras.byes ?? 0}, lb ${innings.extras.legByes ?? 0}, w ${
                innings.extras.wides ?? 0
              }, nb ${innings.extras.noBalls ?? 0})`}
            </p>
          )}

          {/* Bowling Table */}
          {(innings.bowling ?? []).length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead className="text-[10px] uppercase text-slate-400 bg-slate-50/60 dark:bg-white/[0.02]">
                  <tr>
                    <th className="py-1.5 px-2">Bowler</th>
                    <th className="px-2 text-center">O</th>
                    <th className="px-2 text-center">M</th>
                    <th className="px-2 text-center">R</th>
                    <th className="px-2 text-center">W</th>
                    <th className="px-2 text-right">Econ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {innings.bowling?.map((row) => (
                    <tr key={row.playerId}>
                      <td className="py-2 px-2 font-semibold text-slate-900 dark:text-white">
                        {players[String(row.playerId)] || "—"}
                      </td>
                      <td className="px-2 text-center text-slate-600 dark:text-slate-300">
                        {row.overs ?? "—"}
                      </td>
                      <td className="px-2 text-center text-slate-500">{row.maidens ?? 0}</td>
                      <td className="px-2 text-center text-slate-600 dark:text-slate-300">{row.runs ?? 0}</td>
                      <td className="px-2 text-center font-bold text-amber-600 dark:text-amber-400">
                        {row.wickets ?? 0}
                      </td>
                      <td className="px-2 text-right font-mono text-slate-400">{row.economy ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

export default CricketFanExperience;
