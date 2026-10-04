import { useMemo, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import {
  CricketOrganizerPageShell,
  BtnPrimary,
  BtnSecondary,
  EmptyState,
  HubKpiCard,
  HubSectionHeader,
  PageHeader,
  btnCompactClass,
  hubCardClass,
} from "@/components/scoring/cricket-page-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useScoringMatches, useSquadReadiness, scoringSquadsQueryKey, useScoringLive } from "@/hooks/use-scoring-match";
import { useScoringSocket } from "@/hooks/use-scoring-socket";
import {
  createScoringMatch,
  deleteScoringMatch,
  getCricketMasterTeams,
  handoffAuctionParticipantsToSports,
  listCricketRulePresets,
  resolveCricketRulePresetSummary,
  formatCricketRulePresetLabel,
  ScoringApiError,
} from "@/lib/scoring-api";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import { apiFetch } from "@workspace/api-base/api-fetch";
import { useToast } from "@/hooks/use-toast";
import { usePlatformFeatures, useCricketScoringActive } from "@/hooks/use-platform-features";
import { Button } from "@/components/ui/button";
import {
  Plus,
  ChevronRight,
  Monitor,
  RefreshCw,
  Calendar,
  Globe,
  Radio,
  CheckCircle2,
  Trophy,
  Users,
  Copy,
  Trash2,
  Tv,
  Info,
  ExternalLink,
  Sliders,
  AlertTriangle,
  Target,
} from "lucide-react";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import {
  cricketPublicPath,
  openScoreDisplay,
  scoringSchedulePath,
  auctionRoomPath,
  scoreDisplayPath,
  cricketObsLivePath,
} from "@/lib/tournament-navigation";
import {
  cricketLiveControlPath,
  cricketRulesPath,
  cricketScorerConsolePath,
  cricketMatchCenterPath,
} from "@/lib/cricket-routes";
import { CricketFilterPill } from "@/components/scoring/cricket-page-chrome";
import { isTerminalCricketMatchStatus } from "@/lib/scoring-api";
import { cn } from "@/lib/utils";

function statusBadgeVariant(status: string): "default" | "destructive" | "secondary" | "outline" {
  if (status === "live") return "destructive";
  if (status === "completed") return "secondary";
  if (status === "abandoned") return "outline";
  return "default";
}

type MatchFilter = "all" | "today" | "upcoming" | "live" | "completed";

function isSameLocalDay(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function ScoringMatchListPage() {
  const [, params] = useRoute("/tournament/:id/score");
  const [, navigate] = useLocation();
  const tournamentId = parseInt(params?.id || "0");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { loading: featuresLoading } = usePlatformFeatures();
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const { data: matches, isLoading, refetch, isFetching } = useScoringMatches(tournamentId, scoringActive);
  const { data: squadData } = useSquadReadiness(tournamentId, scoringActive);

  // Real-time live scoreboard sync
  useScoringSocket(tournamentId, scoringActive);
  const hasLiveMatch = useMemo(() => (matches ?? []).some((m) => m.status === "live"), [matches]);
  const { data: liveDisplay } = useScoringLive(tournamentId, scoringActive && hasLiveMatch);

  const { data: masterTeams, refetch: refetchTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });

  const { data: competitionData } = useQuery({
    queryKey: ["tournament-competition", tournamentId],
    queryFn: async () => {
      const res = await apiFetch(`/tournaments/${tournamentId}/competition`);
      if (!res.ok) return null;
      return (await res.json()) as {
        plan: { version: number } | null;
        validation?: { issues?: Array<{ severity: string; message: string }>; errorCount?: number };
        summary?: { status?: { readiness?: string; locked?: boolean; blockingIssueCount?: number } };
      };
    },
    enabled: scoringActive && !!tournamentId,
  });

  const competitionHasError = (competitionData?.validation?.errorCount ?? 0) > 0;
  const competitionErrorMsg = competitionData?.validation?.issues?.find((i) => i.severity === "ERROR")?.message;

  const teams = useMemo(
    () => (masterTeams ?? []).map(cricketMasterTeamToScorerTeam),
    [masterTeams],
  );

  const playersReady = useMemo(
    () => (masterTeams ?? []).reduce((sum, t) => sum + (t.squadCount ?? 0), 0),
    [masterTeams],
  );
  const teamsWithSquad = useMemo(
    () => (masterTeams ?? []).filter((t) => (t.squadCount ?? 0) > 0).length,
    [masterTeams],
  );
  const rosterReady = teams.length >= 2 && teamsWithSquad >= 2;

  const [handoffBusy, setHandoffBusy] = useState(false);

  async function handleHandoffToSports() {
    setHandoffBusy(true);
    try {
      const result = await handoffAuctionParticipantsToSports(tournamentId);
      await Promise.all([
        refetchTeams(),
        queryClient.invalidateQueries({ queryKey: ["cricket-roster", tournamentId] }),
        queryClient.invalidateQueries({ queryKey: scoringSquadsQueryKey(tournamentId) }),
      ]);
      toast({
        title: result.readyForMatches ? "Teams & players ready" : "Setup incomplete",
        description: result.message,
        variant: result.readyForMatches ? "default" : "destructive",
      });
    } catch (e) {
      toast({
        title: "Could not make teams & players available",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setHandoffBusy(false);
    }
  }

  const stats = useMemo(() => {
    const list = matches ?? [];
    return {
      live: list.filter((m) => m.status === "live").length,
      scheduled: list.filter((m) => m.status === "scheduled").length,
      completed: list.filter((m) => m.status === "completed").length,
      total: list.length,
    };
  }, [matches]);

  const { data: rulePresets } = useQuery({
    queryKey: ["cricket-rule-presets", tournamentId],
    queryFn: () => listCricketRulePresets(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [selectedRulePresetId, setSelectedRulePresetId] = useState("");
  const [matchDateTime, setMatchDateTime] = useState(""); // datetime-local string
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<MatchFilter>("live");
  const [deletingMatchId, setDeletingMatchId] = useState<number | null>(null);

  const defaultPreset = useMemo(() => {
    if (!rulePresets?.length) return null;
    return rulePresets.find((p) => p.isDefault) ?? rulePresets[0];
  }, [rulePresets]);

  const activePreset = useMemo(() => {
    if (!rulePresets?.length) return null;
    if (selectedRulePresetId) {
      return rulePresets.find((p) => String(p.id) === selectedRulePresetId) ?? defaultPreset;
    }
    return defaultPreset;
  }, [rulePresets, selectedRulePresetId, defaultPreset]);

  const filteredMatches = useMemo(() => {
    const list = matches ?? [];
    switch (filter) {
      case "today":
        return list.filter(
          (m) =>
            m.status === "live" ||
            isSameLocalDay(m.scheduledAt) ||
            isSameLocalDay(m.startedAt) ||
            isSameLocalDay(m.completedAt),
        );
      case "upcoming":
        return list.filter((m) => m.status === "scheduled");
      case "live":
        return list.filter((m) => m.status === "live");
      case "completed":
        return list.filter((m) => isTerminalCricketMatchStatus(m.status));
      default:
        return list;
    }
  }, [matches, filter]);

  async function handleCreate() {
    const home = parseInt(homeTeamId, 10);
    const away = parseInt(awayTeamId, 10);
    if (!home || !away || home === away) {
      toast({ title: "Pick two different teams", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      // Convert local datetime-local input to ISO string for the API
      const scheduledAtIso = matchDateTime
        ? new Date(matchDateTime).toISOString()
        : null;
      const detail = await createScoringMatch(tournamentId, {
        homeTeamId: home,
        awayTeamId: away,
        rulePresetId: activePreset?.id ?? undefined,
        scheduledAt: scheduledAtIso,
      });
      setCreateOpen(false);
      setMatchDateTime("");
      navigate(`/tournament/${tournamentId}/score/${detail.match.id}`);
    } catch (e) {
      const rosterBlocked = e instanceof ScoringApiError && e.code === "ROSTER_NOT_READY";
      toast({
        title: rosterBlocked ? "Teams & players not ready" : "Could not create match",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      if (rosterBlocked) setCreateOpen(false);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(matchId: number) {
    setDeletingMatchId(matchId);
    try {
      await deleteScoringMatch(tournamentId, matchId);
      await refetch();
      toast({ title: "Match deleted successfully" });
    } catch (e) {
      toast({
        title: "Could not delete match",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeletingMatchId(null);
    }
  }

  const pageActions = (
    <div className="flex flex-wrap items-center gap-2">
      <BtnSecondary
        className={btnCompactClass}
        disabled={isFetching}
        onClick={() => void refetch()}
      >
        <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
        Refresh
      </BtnSecondary>
      <BtnPrimary
        className={btnCompactClass}
        onClick={() => {
          if (!rosterReady) {
            toast({
              title: "Teams & players not ready",
              description: "Make teams & players available before creating matches.",
              variant: "destructive",
            });
            return;
          }
          setCreateOpen(true);
        }}
        disabled={!scoringActive}
      >
        <Plus className="w-4 h-4" />
        New match
      </BtnPrimary>
    </div>
  );

  const liveMatch = matches?.find((m) => m.status === "live");

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        eyebrow="Tournament Operations"
        title="Matches Hub"
        subtitle={tournament?.name ?? "Tournament matches and live operations"}
        badge={stats.live > 0 ? `${stats.live} Live Match` : undefined}
        actions={pageActions}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-12 space-y-6">

        {featuresLoading || tournamentLoading || (scoringActive && isLoading) ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : !scoringActive ? (
          <EmptyState
            icon={Trophy}
            title="Cricket scoring is off"
            desc="Enable scoring for this tournament in settings, then return here."
          />
        ) : (
          <>
            {!rosterReady ? (
              <div className={cn(hubCardClass, "p-4 border-primary/30 bg-primary/5 space-y-3")}>
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground">Teams & players not ready</p>
                    <p className="text-sm text-muted-foreground">
                      Assign players to at least two franchise teams, then make them available for matches.
                      {playersReady > 0
                        ? ` Currently ${playersReady} player${playersReady === 1 ? "" : "s"} across ${teams.length} team${teams.length === 1 ? "" : "s"}.`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <BtnPrimary disabled={handoffBusy} onClick={() => void handleHandoffToSports()}>
                    {handoffBusy ? "Working…" : "Make teams & players available"}
                  </BtnPrimary>
                  <BtnSecondary
                    className={btnCompactClass}
                    onClick={() => navigate(auctionRoomPath(tournamentId))}
                  >
                    Open Auction
                  </BtnSecondary>
                </div>
              </div>
            ) : null}

            {/* Match KPI Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <HubKpiCard label="Live now" value={stats.live} icon={Radio} tint="red" pulse={stats.live > 0} />
              <HubKpiCard label="Scheduled" value={stats.scheduled} icon={Calendar} tint="muted" />
              <HubKpiCard label="Completed" value={stats.completed} icon={CheckCircle2} tint="green" />
              <HubKpiCard label="Franchise teams" value={teams.length} icon={Trophy} tint="primary" />
            </div>

            {/* ─── ZONE 2: MIDDLE MATCH LIST ─── */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <HubSectionHeader
                  title="Tournament Matches"
                  subtitle={`${filteredMatches.length} of ${stats.total} match${stats.total === 1 ? "" : "es"}`}
                  badge={stats.live > 0 ? "1 LIVE" : undefined}
                  badgeVariant="destructive"
                />

                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ["all", "All"],
                      ["today", "Today"],
                      ["live", "Live"],
                      ["upcoming", "Upcoming"],
                      ["completed", "Completed"],
                    ] as const
                  ).map(([key, label]) => (
                    <CricketFilterPill
                      key={key}
                      active={filter === key}
                      onClick={() => setFilter(key)}
                    >
                      {label}
                    </CricketFilterPill>
                  ))}
                </div>
              </div>

              {filteredMatches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredMatches.map((m) => {
                    const home = teams.find((t) => t.id === m.homeTeamId);
                    const away = teams.find((t) => t.id === m.awayTeamId);
                    const isLive = m.status === "live";
                    const isCompleted = isTerminalCricketMatchStatus(m.status);
                    const isScheduled = m.status === "scheduled";
                    const canDelete = !isCompleted;
                    const scorerPath = cricketScorerConsolePath(tournamentId, m.id);
                    const matchCenterPath = cricketMatchCenterPath(tournamentId, m.id);
                    const matchLabel = m.tournamentMatchNumber != null
                      ? `Match #${m.tournamentMatchNumber}`
                      : `Match #${m.id}`;

                    // Extract live state if this match is live
                    const liveState = (
                      liveDisplay?.match?.id === m.id ? liveDisplay.state : m.stateJson
                    ) as import("@workspace/scoring-core").CricketScoreboardState | null;

                    // Extract completed summary / innings
                    const summary = (m.summaryJson || m.stateJson) as import("@workspace/scoring-core").CricketMatchSummary | null;
                    const summaryInnings = (summary?.innings as any[]) || (m.stateJson as any)?.innings || [];
                    const inn1 = summaryInnings?.[0];
                    const inn2 = summaryInnings?.[1];

                    return (
                      <div
                        key={m.id}
                        className={cn(
                          hubCardClass,
                          "p-4 flex flex-col justify-between gap-4 transition-all",
                          isLive && "border-amber-500/60 bg-gradient-to-b from-amber-500/10 via-card to-card shadow-[0_0_24px_rgba(245,158,11,0.18)]",
                          isCompleted && "border-border/80 bg-card/80",
                        )}
                      >
                        <div className="space-y-3">
                          {/* Card Header: Status Badge + Match Label */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isLive ? (
                                <Badge className="bg-red-500 hover:bg-red-600 text-white font-bold text-[11px] px-2.5 py-0.5 animate-pulse shadow-xs flex items-center gap-1">
                                  <Radio className="w-3 h-3" />
                                  <span>LIVE NOW</span>
                                </Badge>
                              ) : isCompleted ? (
                                <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-bold text-[11px] px-2.5 py-0.5 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>COMPLETED</span>
                                </Badge>
                              ) : (
                                <Badge variant={statusBadgeVariant(m.status)} className="capitalize font-bold text-[11px]">
                                  {m.status}
                                </Badge>
                              )}

                              {isLive && liveState?.currentInnings ? (
                                <Badge variant="outline" className="text-[10px] font-semibold text-amber-400 border-amber-500/30 bg-amber-500/10">
                                  {liveState.currentInnings === 1 ? "1st Innings" : "2nd Innings"}
                                </Badge>
                              ) : null}
                            </div>
                            <span className="text-[11px] text-muted-foreground font-semibold shrink-0">
                              {matchLabel} {m.roundName ? `· ${m.roundName}` : ""}
                            </span>
                          </div>

                          {/* ============================================================== */}
                          {/* CASE 1: LIVE MATCH SCORE BOX                                   */}
                          {/* ============================================================== */}
                          {isLive ? (
                            liveState && liveState.currentInnings > 0 ? (() => {
                              const activeInn = liveState.innings?.find((i) => i.innings === liveState.currentInnings);
                              const battingTeam = teams.find((t) => t.id === activeInn?.battingTeamId) || (liveState.currentInnings === 1 ? home : away);
                              const bowlingTeam = teams.find((t) => t.id === activeInn?.bowlingTeamId) || (liveState.currentInnings === 1 ? away : home);
                              const inn1Score = liveState.innings?.find((i) => i.innings === 1);
                              const inn1Team = teams.find((t) => t.id === inn1Score?.battingTeamId) || home;

                              const currentRuns = activeInn?.runs ?? 0;
                              const currentWickets = activeInn?.wickets ?? 0;
                              const currentOver = activeInn?.over ?? 0;
                              const currentBall = activeInn?.ball ?? 0;
                              const oversLimit = activeInn?.oversLimit || liveState.revisedOversLimit || liveState.oversLimit || m.rules?.overs || 20;
                              const ballsBowled = currentOver * 6 + currentBall;
                              const crr = ballsBowled > 0 ? ((currentRuns / ballsBowled) * 6).toFixed(2) : "0.00";

                              // 2nd innings chase equation
                              const isChase = liveState.currentInnings >= 2;
                              const target = liveState.target ?? (inn1Score ? inn1Score.runs + 1 : null);
                              const totalBalls = oversLimit * 6;
                              const ballsRemaining = Math.max(0, totalBalls - ballsBowled);
                              const runsNeeded = target != null ? Math.max(0, target - currentRuns) : null;
                              const rrr = runsNeeded != null && ballsRemaining > 0 ? ((runsNeeded / ballsRemaining) * 6).toFixed(2) : null;

                              return (
                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3.5 space-y-2.5">
                                  {/* Batting Team Live Score Header */}
                                  <div className="flex items-baseline justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div
                                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs ring-1 ring-white/20"
                                        style={{ backgroundColor: battingTeam?.color || "#f59e0b" }}
                                      />
                                      <span className="font-display font-black text-xl text-foreground tracking-tight truncate">
                                        {battingTeam?.shortCode || battingTeam?.name || "Batting"}
                                      </span>
                                      <span className="font-display font-black text-2xl text-amber-400 tracking-tight ml-1 shrink-0">
                                        {currentRuns}/{currentWickets}
                                      </span>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className="text-xs font-semibold text-muted-foreground">
                                        ({currentOver}.{currentBall} / {oversLimit} ov)
                                      </span>
                                    </div>
                                  </div>

                                  {/* CRR / 1st Innings / Target Strip */}
                                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs border-t border-amber-500/20 pt-2 text-muted-foreground">
                                    <span className="font-medium text-foreground">
                                      CRR: <strong className="text-amber-400">{crr}</strong>
                                    </span>
                                    {isChase && inn1Score ? (
                                      <span className="text-[11px] text-muted-foreground truncate">
                                        {inn1Team?.shortCode}: {inn1Score.runs}/{inn1Score.wickets} ({inn1Score.over}.{inn1Score.ball} ov)
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-muted-foreground">
                                        vs {bowlingTeam?.shortCode || bowlingTeam?.name}
                                      </span>
                                    )}
                                  </div>

                                  {/* Chase Required Equation Banner */}
                                  {isChase && target != null ? (
                                    <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 px-2.5 py-1.5 text-[11px] flex items-center justify-between text-amber-300 font-semibold gap-2">
                                      <span className="flex items-center gap-1 shrink-0">
                                        <Target className="w-3 h-3 text-amber-400" />
                                        Target: {target}
                                      </span>
                                      <span className="truncate text-right">
                                        Need <strong>{runsNeeded}</strong> in <strong>{ballsRemaining}b</strong>{rrr ? ` (RRR ${rrr})` : ""}
                                      </span>
                                    </div>
                                  ) : null}

                                  {/* This Over Recent Deliveries */}
                                  {liveState.thisOver && liveState.thisOver.length > 0 ? (
                                    <div className="flex items-center gap-1.5 pt-1 text-[11px]">
                                      <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0">This Over:</span>
                                      <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                                        {liveState.thisOver.map((b, bIdx) => {
                                          const isWkt = b.isWicket;
                                          const isSix = b.runsOffBat === 6;
                                          const isFour = b.runsOffBat === 4;
                                          const isDot = b.runsOffBat === 0 && !b.extrasType && !b.isWicket;
                                          const isExtra = Boolean(b.extrasType);
                                          return (
                                            <span
                                              key={bIdx}
                                              className={cn(
                                                "min-w-5 h-5 px-1.5 rounded flex items-center justify-center font-bold text-[10px] shrink-0 border",
                                                isWkt && "bg-red-500/25 text-red-300 border-red-500/40",
                                                isSix && "bg-purple-500/25 text-purple-300 border-purple-500/40",
                                                isFour && "bg-sky-500/25 text-sky-300 border-sky-500/40",
                                                isDot && "bg-white/5 text-muted-foreground border-white/10",
                                                isExtra && "bg-amber-500/25 text-amber-300 border-amber-500/40",
                                                !isWkt && !isSix && !isFour && !isDot && !isExtra && "bg-white/10 text-foreground border-white/15",
                                              )}
                                            >
                                              {b.label || (isWkt ? "W" : b.runsOffBat)}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })() : (
                              <div className="space-y-1 py-1">
                                <p className="font-display font-black text-lg text-foreground tracking-tight">
                                  {home?.shortCode ?? home?.name ?? "Home"} vs {away?.shortCode ?? away?.name ?? "Away"}
                                </p>
                                <p className="text-xs text-amber-400 font-medium">
                                  Match is live · Ready for 1st ball
                                </p>
                              </div>
                            )

                          /* ============================================================== */
                          /* CASE 2: COMPLETED MATCH SUMMARY BOX                            */
                          /* ============================================================== */
                          ) : isCompleted ? (
                            <div className="space-y-2.5">
                              {/* Innings 1 & 2 Scores directly styled */}
                              <div className="rounded-xl border border-border/60 bg-white/[0.03] p-3 space-y-1.5">
                                {(() => {
                                  const t1 = teams.find((t) => t.id === inn1?.battingTeamId) || home;
                                  const t2 = teams.find((t) => t.id === inn2?.battingTeamId) || away;
                                  const isT1Winner = m.winnerTeamId === t1?.id;
                                  const isT2Winner = m.winnerTeamId === t2?.id;

                                  return (
                                    <>
                                      <div className="flex items-center justify-between gap-2 text-sm">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div
                                            className="w-3 h-3 rounded-full shrink-0"
                                            style={{ backgroundColor: t1?.color || "#3b82f6" }}
                                          />
                                          <span className={cn("font-bold truncate", isT1Winner ? "text-foreground font-black" : "text-muted-foreground")}>
                                            {t1?.name ?? "Team 1"}
                                          </span>
                                          {isT1Winner && <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                        </div>
                                        <div className="font-display font-bold text-foreground text-sm shrink-0 tabular-nums">
                                          {inn1 ? `${inn1.runs}/${inn1.wickets} (${inn1.overs || `${inn1.over}.${inn1.ball}`} ov)` : "—"}
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between gap-2 text-sm">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div
                                            className="w-3 h-3 rounded-full shrink-0"
                                            style={{ backgroundColor: t2?.color || "#10b981" }}
                                          />
                                          <span className={cn("font-bold truncate", isT2Winner ? "text-foreground font-black" : "text-muted-foreground")}>
                                            {t2?.name ?? "Team 2"}
                                          </span>
                                          {isT2Winner && <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                        </div>
                                        <div className="font-display font-bold text-foreground text-sm shrink-0 tabular-nums">
                                          {inn2 ? `${inn2.runs}/${inn2.wickets} (${inn2.overs || `${inn2.over}.${inn2.ball}`} ov)` : "—"}
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>

                              {/* Result Highlight Banner */}
                              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 flex items-center gap-1.5 text-xs text-emerald-300 font-semibold">
                                <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="truncate">
                                  {m.resultSummary || (summary as any)?.resultText || "Match Finished"}
                                </span>
                              </div>

                              {/* Completed Subtitle */}
                              <p className="text-[11px] text-muted-foreground">
                                {m.completedAt ? (
                                  <>Finished {new Date(m.completedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} • </>
                                ) : null}
                                {m.rules?.overs ?? 20} Overs
                                {m.venue ? ` • ${m.venue}` : ""}
                              </p>
                            </div>

                          /* ============================================================== */
                          /* CASE 3: SCHEDULED MATCH BOX                                    */
                          /* ============================================================== */
                          ) : (
                            <div className="space-y-1.5 py-1">
                              <p className="font-display font-black text-lg text-foreground tracking-tight">
                                {home?.shortCode ?? home?.name ?? "Home"} vs {away?.shortCode ?? away?.name ?? "Away"}
                              </p>
                              {m.scheduledAt ? (
                                <p className="text-xs text-muted-foreground">
                                  {m.venue ? `${m.venue} • ` : ""}
                                  {new Date(m.scheduledAt).toLocaleString([], {
                                    month: "short", day: "numeric",
                                    hour: "2-digit", minute: "2-digit",
                                  })}
                                  {" • "}{m.rules?.overs ?? 20} Overs
                                </p>
                              ) : m.venue ? (
                                <p className="text-xs text-muted-foreground">
                                  {m.venue} • {m.rules?.overs ?? 20} Overs
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground capitalize">{m.status} • {m.rules?.overs ?? 20} Overs</p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
                          {isLive ? (
                            <div className="flex items-center gap-2">
                              <Link href={scorerPath} className="flex-1">
                                <Button className="w-full h-9 font-bold text-xs rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 gap-1.5 shadow-md shadow-amber-400/20">
                                  <Radio className="w-3.5 h-3.5" />
                                  Open Scorer / Umpire Pad
                                </Button>
                              </Link>
                              <Link href={matchCenterPath}>
                                <Button variant="outline" className="h-9 px-3 text-xs font-semibold rounded-xl">
                                  Scorecard
                                </Button>
                              </Link>
                            </div>
                          ) : isScheduled ? (
                            competitionHasError ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <Button
                                    disabled
                                    className="flex-1 h-9 font-bold text-xs rounded-xl bg-muted text-muted-foreground cursor-not-allowed gap-1.5"
                                  >
                                    <Radio className="w-3.5 h-3.5 opacity-40" />
                                    Start Match & Toss
                                  </Button>
                                  <Link href={matchCenterPath}>
                                    <Button variant="outline" className="h-9 px-3 text-xs font-semibold rounded-xl">
                                      Details
                                    </Button>
                                  </Link>
                                </div>
                                <p className="text-[11px] text-amber-400/90 flex items-center gap-1.5 leading-tight px-1">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>
                                    Rules issue: {competitionErrorMsg || "Rules conflict detected"} ·{" "}
                                    <Link href={`/tournament/${tournamentId}/score/rules`} className="underline font-semibold hover:text-amber-300">
                                      Fix rules
                                    </Link>
                                  </span>
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Link href={scorerPath} className="flex-1">
                                  <Button className="w-full h-9 font-bold text-xs rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
                                    <Radio className="w-3.5 h-3.5" />
                                    Start Match & Toss
                                  </Button>
                                </Link>
                                <Link href={matchCenterPath}>
                                  <Button variant="outline" className="h-9 px-3 text-xs font-semibold rounded-xl">
                                    Details
                                  </Button>
                                </Link>
                              </div>
                            )
                          ) : (
                            <div className="flex items-center gap-2">
                              <Link href={matchCenterPath} className="flex-1">
                                <Button variant="outline" className="w-full h-9 font-semibold text-xs rounded-xl gap-1.5">
                                  <ChevronRight className="w-3.5 h-3.5" />
                                  View Match Scorecard
                                </Button>
                              </Link>
                            </div>
                          )}
                          {/* Delete button — shown for scheduled/live (0-ball) matches */}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 self-end px-2 rounded-lg"
                              disabled={deletingMatchId === m.id}
                              onClick={() => {
                                if (!window.confirm(`Delete ${matchLabel}? This cannot be undone.`)) return;
                                void handleDelete(m.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                              {deletingMatchId === m.id ? "Deleting…" : "Delete"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

              ) : (
                <EmptyState
                  icon={filter === "live" ? Radio : Plus}
                  title={
                    filter === "live"
                      ? "No live matches right now"
                      : filter === "all"
                        ? "No matches yet"
                        : "No matches in this filter"
                  }
                  desc={
                    filter === "live"
                      ? (matches ?? []).length > 0
                        ? "There is no match in progress right now. Switch filter to view upcoming or completed matches."
                        : "Create your first match to start live scoring."
                      : filter === "all"
                        ? "Create your first match to start live scoring."
                        : "Try another filter or create a new match."
                  }
                  action={
                    filter === "live" && (matches ?? []).length > 0
                      ? { label: "View all matches", onClick: () => setFilter("all") }
                      : rosterReady
                        ? { label: "New match", onClick: () => setCreateOpen(true) }
                        : {
                            label: "Make teams & players available",
                            onClick: () => void handleHandoffToSports(),
                          }
                  }
                />
              )}
            </section>
          </>
        )}
      </div>

      {/* New Match Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New cricket match</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Home team</Label>
              <Select value={homeTeamId} onValueChange={setHomeTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => {
                    const master = masterTeams?.find((m) => m.auctionTeamId === t.id);
                    const squad = squadData?.squads.find((s) => s.teamId === t.id);
                    const count = squad?.eligibleCount ?? master?.squadCount ?? 0;
                    return (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name} ({count} player{count === 1 ? "" : "s"})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Away team</Label>
              <Select value={awayTeamId} onValueChange={setAwayTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => {
                    const master = masterTeams?.find((m) => m.auctionTeamId === t.id);
                    const squad = squadData?.squads.find((s) => s.teamId === t.id);
                    const count = squad?.eligibleCount ?? master?.squadCount ?? 0;
                    return (
                      <SelectItem key={t.id} value={String(t.id)} disabled={homeTeamId === String(t.id)}>
                        {t.name} ({count} player{count === 1 ? "" : "s"})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {teams.some((t) => {
              const master = masterTeams?.find((m) => m.auctionTeamId === t.id);
              return (master?.squadCount ?? 0) === 0;
            }) ? (
              <p className="text-xs text-amber-300">
                Teams with 0 players need a Sports roster — assign players on Players, or use
                &quot;Make teams &amp; players available&quot; / Import from Auction.
              </p>
            ) : null}
            {squadData?.squads.some((s) => !s.ready) ? (
              <p className="text-xs text-primary">
                Some teams have a thin roster — Playing XI / bench limits come from
                RuntimeExecutionPolicy after Runtime Prepare.
              </p>
            ) : null}
            {/* Tournament Rules / Match Format Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tournament Rules &amp; Format</Label>
                <Link
                  href={cricketRulesPath(tournamentId)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Sliders className="w-3 h-3" />
                  Manage Rules
                </Link>
              </div>
              {rulePresets && rulePresets.length > 0 ? (
                <Select
                  value={selectedRulePresetId || (defaultPreset ? String(defaultPreset.id) : "")}
                  onValueChange={setSelectedRulePresetId}
                >
                  <SelectTrigger className="font-semibold text-foreground">
                    <SelectValue placeholder="Select tournament rule preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {rulePresets.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {formatCricketRulePresetLabel(p, { isDefault: p.isDefault })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-2.5 rounded-lg border border-border bg-card/40 text-xs text-muted-foreground flex items-center justify-between">
                  <span>Using tournament default rules</span>
                  <Link href={cricketRulesPath(tournamentId)} className="text-primary font-medium hover:underline">
                    Configure Rules
                  </Link>
                </div>
              )}
              {activePreset ? (
                <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-foreground/80 flex flex-wrap gap-2 items-center">
                  <span className="font-bold text-amber-400">Rules applied:</span>
                  <span>
                    {resolveCricketRulePresetSummary(activePreset).overs} Overs
                  </span>
                  <span>•</span>
                  <span>
                    {resolveCricketRulePresetSummary(activePreset).wickets} Wickets
                  </span>
                  <span>•</span>
                  <span>
                    {resolveCricketRulePresetSummary(activePreset).squadSize} Players / Side
                  </span>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Match Date & Time <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                type="datetime-local"
                value={matchDateTime}
                onChange={(e) => setMatchDateTime(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Shown on match cards and fixtures. Leave blank to set later.
              </p>
            </div>
            <BtnPrimary className="w-full" disabled={creating} onClick={() => void handleCreate()}>
              Create match
            </BtnPrimary>
          </div>
        </DialogContent>
      </Dialog>
    </CricketOrganizerPageShell>
  );
}
