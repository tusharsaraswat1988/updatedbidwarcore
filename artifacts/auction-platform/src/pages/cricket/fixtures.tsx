/**
 * Cricket Fixture Browser — filters over fixtures + matches with direct match operations.
 * Route: /tournament/:id/score/fixtures
 */
import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import {
  CricketOrganizerPageShell,
  CricketFilterPill,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useScoringMatches, useScoringLive } from "@/hooks/use-scoring-match";
import { useScoringSocket } from "@/hooks/use-scoring-socket";
import {
  createScoringMatch,
  deleteScoringMatch,
  getCricketMasterTeams,
  isTerminalCricketMatchStatus,
  listCricketRulePresets,
  resolveCricketRulePresetSummary,
  formatCricketRulePresetLabel,
  updateScoringMatch,
  type CricketRulePresetJson,
  type ScoringMatchRow,
} from "@/lib/scoring-api";
import { listFixtures } from "@/lib/scoring-foundation-api";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { cricketScheduleOpsPath, cricketScorerConsolePath, cricketMatchCenterPath, cricketRulesPath } from "@/lib/cricket-routes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar, CheckCircle2, ChevronRight, Edit2, ListOrdered, Plus, Radio, Settings, Sliders, Trash2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type FilterKey = "all" | "today" | "upcoming" | "live" | "completed";

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

export default function CricketFixturesPage() {
  const [, fixturesParams] = useRoute("/tournament/:id/score/fixtures");
  const [, scoreParams] = useRoute("/tournament/:id/score");
  const tournamentId = parseInt(fixturesParams?.id || scoreParams?.id || "0");
  const [filter, setFilter] = useState<FilterKey>("all");

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const { data: matches, isLoading } = useScoringMatches(tournamentId, scoringActive);
  useScoringSocket(tournamentId, scoringActive);
  const hasLive = useMemo(() => (matches ?? []).some((m) => m.status === "live"), [matches]);
  const { data: liveDisplay } = useScoringLive(tournamentId, scoringActive && hasLive);
  const { data: fixtures } = useQuery({
    queryKey: ["scoring-fixtures", tournamentId],
    queryFn: () => listFixtures(tournamentId),
    enabled: scoringActive,
  });
  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });
  const { data: presets } = useQuery({
    queryKey: ["cricket-rule-presets", tournamentId],
    queryFn: () => listCricketRulePresets(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });

  const teams = useMemo(
    () => (masterTeams ?? []).map(cricketMasterTeamToScorerTeam),
    [masterTeams],
  );
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const defaultPreset = useMemo(
    () => (presets ?? []).find((p) => p.isDefault) || presets?.[0],
    [presets],
  );

  const stats = useMemo(() => {
    const list = matches ?? [];
    return {
      total: list.length,
      live: list.filter((m) => m.status === "live").length,
      upcoming: list.filter((m) => m.status === "scheduled").length,
      completed: list.filter((m) => isTerminalCricketMatchStatus(m.status)).length,
      fixturesCount: fixtures?.length ?? 0,
    };
  }, [matches, fixtures]);

  const filtered = useMemo(() => {
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

  const qc = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [createHomeId, setCreateHomeId] = useState("");
  const [createAwayId, setCreateAwayId] = useState("");
  const [createRoundName, setCreateRoundName] = useState("Semi Final 1");
  const [createPresetId, setCreatePresetId] = useState<string>("");
  const [createOvers, setCreateOvers] = useState(20);
  const [createVenue, setCreateVenue] = useState("");
  const [createScheduledAt, setCreateScheduledAt] = useState(""); // datetime-local string
  const [creating, setCreating] = useState(false);

  const [editMatch, setEditMatch] = useState<ScoringMatchRow | null>(null);
  const [editRoundName, setEditRoundName] = useState("");
  const [editPresetId, setEditPresetId] = useState<string>("");
  const [editOvers, setEditOvers] = useState(20);
  const [editVenue, setEditVenue] = useState("");
  const [editResultSummary, setEditResultSummary] = useState("");
  const [editScheduledAt, setEditScheduledAt] = useState(""); // datetime-local string
  const [savingEdit, setSavingEdit] = useState(false);

  const activeCreatePreset = useMemo(
    () => (presets ?? []).find((p) => String(p.id) === createPresetId) || defaultPreset,
    [presets, createPresetId, defaultPreset],
  );

  const activeEditPreset = useMemo(
    () => (presets ?? []).find((p) => String(p.id) === editPresetId) || defaultPreset,
    [presets, editPresetId, defaultPreset],
  );

  const [matchToDelete, setMatchToDelete] = useState<ScoringMatchRow | null>(null);
  const [deletingMatch, setDeletingMatch] = useState(false);

  function handleOpenCreate() {
    if (defaultPreset) {
      setCreatePresetId(String(defaultPreset.id));
      const details = resolveCricketRulePresetSummary(defaultPreset);
      setCreateOvers(details.overs);
    } else {
      setCreatePresetId("");
      setCreateOvers(20);
    }
    setCreateOpen(true);
  }

  function handleSelectCreatePreset(presetIdStr: string) {
    setCreatePresetId(presetIdStr);
    const p = (presets ?? []).find((x) => String(x.id) === presetIdStr);
    if (p) {
      const details = resolveCricketRulePresetSummary(p);
      setCreateOvers(details.overs);
    }
  }

  function handleOpenEdit(m: ScoringMatchRow) {
    setEditMatch(m);
    setEditRoundName(m.roundName || "");
    const presetId = m.rulePresetId ? String(m.rulePresetId) : defaultPreset ? String(defaultPreset.id) : "";
    setEditPresetId(presetId);
    const resolvedP = (presets ?? []).find((x) => String(x.id) === presetId) || defaultPreset;
    const details = resolveCricketRulePresetSummary(resolvedP);
    setEditOvers(m.rules?.overs ?? details.overs);
    setEditVenue(m.venue || "");
    setEditResultSummary(m.resultSummary || "");
    // Convert ISO to datetime-local string (YYYY-MM-DDTHH:MM) in local time
    if (m.scheduledAt) {
      const d = new Date(m.scheduledAt);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      setEditScheduledAt(local.toISOString().slice(0, 16));
    } else {
      setEditScheduledAt("");
    }
  }

  function handleSelectEditPreset(presetIdStr: string) {
    setEditPresetId(presetIdStr);
    const p = (presets ?? []).find((x) => String(x.id) === presetIdStr);
    if (p) {
      const details = resolveCricketRulePresetSummary(p);
      setEditOvers(details.overs);
    }
  }

  async function handleSaveEdit() {
    if (!editMatch) return;
    setSavingEdit(true);
    try {
      const isPreStart = !editMatch.startedAt && (editMatch.status === "scheduled" || editMatch.status === "draft");
      await updateScoringMatch(tournamentId, editMatch.id, {
        roundName: editRoundName.trim() || null,
        oversLimit: editOvers || 6,
        venue: editVenue.trim() || null,
        resultSummary: editResultSummary.trim() || null,
        scheduledAt: editScheduledAt ? new Date(editScheduledAt).toISOString() : null,
        ...(isPreStart && editPresetId ? { rulePresetId: parseInt(editPresetId, 10) } : {}),
      });
      toast({
        title: "Match updated",
        description: `Saved changes for Match #${editMatch.tournamentMatchNumber ?? editMatch.id}`,
      });
      setEditMatch(null);
      await qc.invalidateQueries({ queryKey: ["scoring-matches", tournamentId] });
      await qc.invalidateQueries({ queryKey: ["scoring-fixtures", tournamentId] });
    } catch (e) {
      toast({
        title: "Failed to update match",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteMatch() {
    if (!matchToDelete) return;
    setDeletingMatch(true);
    try {
      await deleteScoringMatch(tournamentId, matchToDelete.id);
      toast({
        title: "Match deleted",
        description: `Match #${matchToDelete.tournamentMatchNumber ?? matchToDelete.id} was deleted.`,
      });
      setMatchToDelete(null);
      await qc.invalidateQueries({ queryKey: ["scoring-matches", tournamentId] });
      await qc.invalidateQueries({ queryKey: ["scoring-fixtures", tournamentId] });
    } catch (e) {
      toast({
        title: "Could not delete match",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeletingMatch(false);
    }
  }

  async function handleCreateCustomMatch() {
    const home = parseInt(createHomeId, 10);
    const away = parseInt(createAwayId, 10);
    if (!home || !away || home === away) {
      toast({ title: "Pick two different teams", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await createScoringMatch(tournamentId, {
        homeTeamId: home,
        awayTeamId: away,
        roundName: createRoundName.trim() || undefined,
        oversLimit: createOvers || 6,
        venue: createVenue.trim() || undefined,
        scheduledAt: createScheduledAt ? new Date(createScheduledAt).toISOString() : undefined,
        rulePresetId: createPresetId ? parseInt(createPresetId, 10) : undefined,
      });
      toast({
        title: "Match created",
        description: `${createRoundName || "Match"} scheduled with ${createOvers} overs.`,
      });
      setCreateOpen(false);
      setCreateHomeId("");
      setCreateAwayId("");
      setCreateScheduledAt("");
      await qc.invalidateQueries({ queryKey: ["scoring-matches", tournamentId] });
      await qc.invalidateQueries({ queryKey: ["scoring-fixtures", tournamentId] });
    } catch (e) {
      toast({
        title: "Could not create match",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Operations"
        title="Matches Hub"
        subtitle={`${stats.total} total match${stats.total === 1 ? "" : "es"} · ${stats.live} live now · ${stats.upcoming} scheduled`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className={cn(btnCompactClass, "font-semibold text-xs gap-1.5")}
              onClick={handleOpenCreate}
              disabled={!scoringActive}
            >
              <Plus className="w-4 h-4" />
              New Match
            </Button>
            <BtnPrimary href={cricketScheduleOpsPath(tournamentId)} className={btnCompactClass}>
              <Calendar className="w-4 h-4 mr-1" />
              Schedule & Draws
            </BtnPrimary>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 space-y-6">
        {tournamentLoading || (scoringActive && isLoading && !matches) ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : !scoringActive ? (
          <EmptyState
            icon={Trophy}
            title="Cricket scoring is off"
            desc="Enable scoring to browse fixtures and schedule matches."
          />
        ) : (
          <>
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <HubKpiCard label="Live Matches" value={stats.live} icon={Radio} tint="red" pulse={stats.live > 0} />
              <HubKpiCard label="Scheduled" value={stats.upcoming} icon={Calendar} tint="primary" />
              <HubKpiCard label="Completed" value={stats.completed} icon={CheckCircle2} tint="green" />
              <HubKpiCard label="Total Matches" value={stats.total} icon={ListOrdered} tint="muted" />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All Matches"],
                  ["today", "Today"],
                  ["upcoming", "Upcoming"],
                  ["live", "Live"],
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

            <HubSectionHeader
              title="Tournament Matches"
              subtitle={`${filtered.length} of ${stats.total} match${stats.total === 1 ? "" : "es"} shown`}
              badge={stats.live > 0 ? `${stats.live} LIVE` : undefined}
              badgeVariant="destructive"
            />

            {filtered.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title={filter === "all" ? "No fixtures generated yet" : "No matches in this filter"}
                desc={
                  filter === "all"
                    ? "Generate tournament fixtures or create individual matches to populate the calendar."
                    : "Try switching to another filter or check the schedule tab."
                }
                action={{
                  label: "Schedule & Generate",
                  onClick: () => {
                    window.location.href = cricketScheduleOpsPath(tournamentId);
                  },
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((m) => {
                  const home = teamMap.get(m.homeTeamId);
                  const away = teamMap.get(m.awayTeamId);
                  const isLive = m.status === "live";
                  const isCompleted = isTerminalCricketMatchStatus(m.status);
                  const isScheduled = m.status === "scheduled";
                  const scorerUrl = cricketScorerConsolePath(tournamentId, m.id);
                  const centerUrl = cricketMatchCenterPath(tournamentId, m.id);

                  // Extract live scoreboard
                  const liveState = (
                    liveDisplay?.match?.id === m.id ? liveDisplay.state : m.stateJson
                  ) as import("@workspace/scoring-core").CricketScoreboardState | null;

                  // Extract completed summary
                  const summary = (m.summaryJson || m.stateJson) as import("@workspace/scoring-core").CricketMatchSummary | null;
                  const summaryInnings = (summary?.innings as any[]) || (m.stateJson as any)?.innings || [];
                  const inn1 = summaryInnings?.[0];
                  const inn2 = summaryInnings?.[1];

                  return (
                    <div
                      key={m.id}
                      className={cn(
                        hubCardClass,
                        "p-4 flex flex-col justify-between gap-4 transition-all hover:border-primary/40",
                        isLive && "border-amber-500/50 bg-gradient-to-b from-amber-500/10 via-card to-card shadow-[0_0_20px_rgba(245,158,11,0.15)]",
                      )}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={cn(
                                "text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full",
                                isLive
                                  ? "bg-red-500/15 border border-red-500/30 text-red-400 animate-pulse"
                                  : isCompleted
                                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                                    : "bg-muted border border-border text-muted-foreground",
                              )}
                            >
                              {isLive ? "🔴 LIVE NOW" : m.status}
                            </span>
                            {isLive && liveState?.currentInnings ? (
                              <Badge variant="outline" className="text-[10px] font-semibold text-amber-400 border-amber-500/30 bg-amber-500/10">
                                {liveState.currentInnings === 1 ? "1st Innings" : "2nd Innings"}
                              </Badge>
                            ) : null}
                            {m.rulePresetName ? (
                              <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30 bg-primary/5">
                                {m.rulePresetName}
                              </Badge>
                            ) : null}
                          </div>
                          <span className="text-xs text-muted-foreground font-semibold">
                            {m.scheduledAt
                              ? new Date(m.scheduledAt).toLocaleString(undefined, {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })
                              : m.venue || `Match #${m.tournamentMatchNumber ?? m.id}`}
                          </span>
                        </div>

                        {/* LIVE MATCH DISPLAY */}
                        {isLive && liveState && liveState.currentInnings > 0 ? (() => {
                          const activeInn = liveState.innings?.find((i) => i.innings === liveState.currentInnings);
                          const battingTeam = teams.find((t) => t.id === activeInn?.battingTeamId) || (liveState.currentInnings === 1 ? home : away);
                          const oversLimit = activeInn?.oversLimit || liveState.revisedOversLimit || liveState.oversLimit || m.rules?.overs || 20;
                          const currentRuns = activeInn?.runs ?? 0;
                          const currentWickets = activeInn?.wickets ?? 0;
                          const currentOver = activeInn?.over ?? 0;
                          const currentBall = activeInn?.ball ?? 0;

                          return (
                            <div className="rounded-xl border border-amber-500/30 bg-slate-950/70 p-3 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: battingTeam?.color || "#f59e0b" }}
                                  />
                                  <span className="font-bold text-sm text-foreground">
                                    {battingTeam?.name || "Batting"}
                                  </span>
                                </div>
                                <div className="font-display font-black text-amber-400 text-lg">
                                  {currentRuns}/{currentWickets}{" "}
                                  <span className="text-xs font-normal text-muted-foreground">
                                    ({currentOver}.{currentBall}/{oversLimit} ov)
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })() : isCompleted ? (
                          <div className="rounded-xl border border-border/80 bg-card/60 p-3 space-y-2">
                            <div className="space-y-1 text-sm">
                              {(() => {
                                const t1 = teams.find((t) => t.id === inn1?.battingTeamId) || home;
                                const t2 = teams.find((t) => t.id === inn2?.battingTeamId) || away;
                                const isT1Winner = m.winnerTeamId === t1?.id;
                                const isT2Winner = m.winnerTeamId === t2?.id;

                                return (
                                  <>
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t1?.color || "#3b82f6" }} />
                                        <span className={cn("truncate text-xs font-bold", isT1Winner ? "text-foreground" : "text-muted-foreground")}>
                                          {t1?.shortCode || t1?.name}
                                        </span>
                                      </div>
                                      <span className="text-xs font-bold tabular-nums">
                                        {inn1 ? `${inn1.runs}/${inn1.wickets} (${inn1.overs || `${inn1.over}.${inn1.ball}`} ov)` : "—"}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t2?.color || "#10b981" }} />
                                        <span className={cn("truncate text-xs font-bold", isT2Winner ? "text-foreground" : "text-muted-foreground")}>
                                          {t2?.shortCode || t2?.name}
                                        </span>
                                      </div>
                                      <span className="text-xs font-bold tabular-nums">
                                        {inn2 ? `${inn2.runs}/${inn2.wickets} (${inn2.overs || `${inn2.over}.${inn2.ball}`} ov)` : "—"}
                                      </span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>

                            {m.resultSummary ? (
                              <div className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-xs text-emerald-300 font-medium truncate flex items-center gap-1">
                                <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                                <span className="truncate">{m.resultSummary}</span>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          /* Teams Row for Scheduled */
                          <div className="flex items-center justify-between gap-3 py-1.5">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div
                                className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs"
                                style={{ backgroundColor: home?.color || "#3B82F6" }}
                              >
                                {home?.shortCode?.slice(0, 3) || "H"}
                              </div>
                              <span className="font-bold text-foreground text-sm truncate">
                                {home?.name ?? "Home"}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-muted-foreground/60 uppercase shrink-0">
                              vs
                            </span>
                            <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-end">
                              <span className="font-bold text-foreground text-sm truncate text-right">
                                {away?.name ?? "Away"}
                              </span>
                              <div
                                className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs"
                                style={{ backgroundColor: away?.color || "#10B981" }}
                              >
                                {away?.shortCode?.slice(0, 3) || "A"}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Round / Result Summary */}
                        {!isCompleted && !isLive && (
                          <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                            <span className="truncate">{m.roundName || `Match #${m.tournamentMatchNumber ?? m.id}`}</span>
                            <span>{m.venue || `${m.rules?.overs ?? 20} Overs`}</span>
                          </div>
                        )}
                      </div>

                      {/* Direct Operational Action Buttons */}
                      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                        {isLive ? (
                          <>
                            <Link href={scorerUrl} className="flex-1">
                              <Button className="w-full h-8.5 font-bold text-xs rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 gap-1.5 shadow-xs">
                                <Radio className="w-3.5 h-3.5" />
                                Scorer Pad
                              </Button>
                            </Link>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8.5 w-8.5 text-xs font-semibold rounded-lg shrink-0"
                              onClick={() => handleOpenEdit(m)}
                              title="Edit overs & match details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Link href={centerUrl}>
                              <Button variant="outline" className="h-8.5 px-3 text-xs font-semibold rounded-lg">
                                Scorecard
                              </Button>
                            </Link>
                          </>
                        ) : isScheduled ? (
                          <>
                            <Link href={scorerUrl} className="flex-1">
                              <Button className="w-full h-8.5 font-bold text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-xs">
                                <Radio className="w-3.5 h-3.5" />
                                Start Toss & Score
                              </Button>
                            </Link>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8.5 w-8.5 text-xs font-semibold rounded-lg shrink-0"
                              onClick={() => handleOpenEdit(m)}
                              title="Edit overs & details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            {!m.startedAt && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8.5 w-8.5 text-xs font-semibold rounded-lg shrink-0 text-muted-foreground hover:text-destructive hover:border-destructive/40"
                                onClick={() => setMatchToDelete(m)}
                                title="Delete Match (pre-toss only)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Link href={centerUrl}>
                              <Button variant="outline" className="h-8.5 px-3 text-xs font-semibold rounded-lg">
                                Details
                              </Button>
                            </Link>
                          </>
                        ) : (
                          <>
                            <Link href={centerUrl} className="flex-1">
                              <Button variant="outline" className="w-full h-8.5 font-semibold text-xs rounded-lg gap-1.5 justify-between">
                                <span>View Match Scorecard</span>
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            </Link>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8.5 w-8.5 text-xs font-semibold rounded-lg shrink-0"
                              onClick={() => handleOpenEdit(m)}
                              title="Edit match display & summary"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Modal: Create Playoff / Custom Match */}
        {createOpen ? (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <h3 className="font-bold text-base">Schedule Playoff / Custom Match</h3>
                <span className="text-xs text-muted-foreground">Custom Overs</span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="space-y-1.5">
                  <Label>Round / Match Stage</Label>
                  <Input
                    value={createRoundName}
                    onChange={(e) => setCreateRoundName(e.target.value)}
                    placeholder="e.g. Semi Final 1, Final"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Rules & Match Format
                    </Label>
                    <Link
                      href={cricketRulesPath(tournamentId)}
                      className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                    >
                      <Settings className="w-3 h-3" />
                      Manage Rules
                    </Link>
                  </div>
                  {presets && presets.length > 0 ? (
                    <Select
                      value={createPresetId || (defaultPreset ? String(defaultPreset.id) : "")}
                      onValueChange={handleSelectCreatePreset}
                    >
                      <SelectTrigger className="font-semibold text-foreground">
                        <SelectValue placeholder="Select tournament rule preset" />
                      </SelectTrigger>
                      <SelectContent>
                        {presets.map((p) => (
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
                  {activeCreatePreset ? (
                    <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-foreground/80 flex flex-wrap gap-2 items-center">
                      <span className="font-bold text-amber-400">Rules applied:</span>
                      <span>{resolveCricketRulePresetSummary(activeCreatePreset).overs} Overs</span>
                      <span>•</span>
                      <span>{resolveCricketRulePresetSummary(activeCreatePreset).wickets} Wickets</span>
                      <span>•</span>
                      <span>{resolveCricketRulePresetSummary(activeCreatePreset).squadSize} Players / Side</span>
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Home Team</Label>
                    <Select value={createHomeId} onValueChange={setCreateHomeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Away Team</Label>
                    <Select value={createAwayId} onValueChange={setCreateAwayId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Venue (Optional)</Label>
                  <Input
                    value={createVenue}
                    onChange={(e) => setCreateVenue(e.target.value)}
                    placeholder="Stadium / Ground"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-border/40">
                <Button
                  className="flex-1 font-bold"
                  disabled={creating}
                  onClick={handleCreateCustomMatch}
                >
                  {creating ? "Scheduling..." : "Schedule Match"}
                </Button>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Modal: Edit Match Setup */}
        {editMatch ? (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base">Edit Match Details</h3>
                  <Badge variant="outline" className="text-[10px] capitalize font-semibold">
                    {editMatch.status}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">Match #{editMatch.id}</span>
              </div>

              {editMatch.status !== "scheduled" && editMatch.status !== "draft" ? (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-500">
                  Editing a {editMatch.status} match updates display information and rules across all screens without resetting scored balls or player statistics.
                </div>
              ) : null}

              <div className="space-y-3 text-sm">
                <div className="space-y-1.5">
                  <Label>Round / Match Stage</Label>
                  <Input
                    value={editRoundName}
                    onChange={(e) => setEditRoundName(e.target.value)}
                    placeholder="e.g. Semi Final 1, Final"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Rules & Match Format
                    </Label>
                    {editMatch.startedAt ? (
                      <span className="text-[10px] text-amber-500 font-semibold">Rules Locked (Scoring started)</span>
                    ) : null}
                  </div>
                  <Select
                    value={editPresetId}
                    onValueChange={handleSelectEditPreset}
                    disabled={Boolean(editMatch.startedAt)}
                  >
                    <SelectTrigger className="font-medium text-foreground">
                      <SelectValue placeholder="Tournament Default Preset" />
                    </SelectTrigger>
                    <SelectContent>
                      {(presets ?? []).map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {formatCricketRulePresetLabel(p, { isDefault: p.isDefault })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {activeEditPreset ? (
                    <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-foreground/80 flex flex-wrap gap-2 items-center">
                      <span className="font-bold text-amber-400">Rules applied:</span>
                      <span>{resolveCricketRulePresetSummary(activeEditPreset).overs} Overs</span>
                      <span>•</span>
                      <span>{resolveCricketRulePresetSummary(activeEditPreset).wickets} Wickets</span>
                      <span>•</span>
                      <span>{resolveCricketRulePresetSummary(activeEditPreset).squadSize} Players / Side</span>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label>Venue (Optional)</Label>
                  <Input
                    value={editVenue}
                    onChange={(e) => setEditVenue(e.target.value)}
                    placeholder="Stadium / Ground"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Result / Display Summary</Label>
                  <Input
                    value={editResultSummary}
                    onChange={(e) => setEditResultSummary(e.target.value)}
                    placeholder="e.g. Team A won by 15 runs, No result due to rain"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Custom text displayed on cards, scorecards, and overlays.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Match Date & Time <span className="text-muted-foreground font-normal text-[11px]">(optional)</span></Label>
                  <Input
                    type="datetime-local"
                    value={editScheduledAt}
                    onChange={(e) => setEditScheduledAt(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-border/40">
                <Button
                  className="flex-1 font-bold"
                  disabled={savingEdit}
                  onClick={handleSaveEdit}
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="outline" onClick={() => setEditMatch(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Modal: Confirm Delete Match (Pre-toss only) */}
        <AlertDialog open={!!matchToDelete} onOpenChange={(open) => !open && setMatchToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Match #{matchToDelete?.tournamentMatchNumber ?? matchToDelete?.id}?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete this match between{" "}
                <strong>{teamMap.get(matchToDelete?.homeTeamId ?? 0)?.name ?? "Home Team"}</strong> and{" "}
                <strong>{teamMap.get(matchToDelete?.awayTeamId ?? 0)?.name ?? "Away Team"}</strong>?
                This action cannot be undone. Matches can only be deleted if no balls have been bowled.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingMatch}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deletingMatch}
                onClick={(e) => {
                  e.preventDefault();
                  void handleDeleteMatch();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingMatch ? "Deleting..." : "Delete Match"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </CricketOrganizerPageShell>
  );
}
