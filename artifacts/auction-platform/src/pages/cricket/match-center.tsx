/**
 * Corporate Match Center — single operational page for one match.
 * Route: /tournament/:id/score/:matchId
 *
 * Scorer pad remains at /tournament/:id/score/:matchId/live
 * Organizer Live Control is /tournament/:id/score/live-control
 * Reuses: MatchSummaryCard, ScorecardView, ShareButtons, scoring APIs.
 */
import { useMemo, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { buildCricketMatchSummary } from "@workspace/scoring-core";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import {
  BtnPrimary,
  BtnSecondary,
  EmptyState,
  HubSectionHeader,
  PageHeader,
  btnCompactClass,
  hubCardClass,
  hubPanelClass,
} from "@/components/scoring/cricket-page-chrome";
import { MatchSummaryCard } from "@/components/scoring/match-summary-card";
import { ScorecardView } from "@/components/scoring/scorecard-view";
import { ShareButtons } from "@/components/scoring/share-buttons";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useScoringMatch } from "@/hooks/use-scoring-match";
import {
  deleteScoringMatch,
  getCricketMasterTeams,
  getPublicMatchScorecard,
  isTerminalCricketMatchStatus,
  updateScoringMatch,
} from "@/lib/scoring-api";
import { getMatchSquads, listOfficials, type MatchSquadJson } from "@/lib/scoring-foundation-api";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import {
  buildMatchStatSnapshots,
  buildMatchTimeline,
  currentRunRate,
  formatInningsScore,
  matchDurationLabel,
} from "@/lib/cricket-match-center";
import {
  cricketDashboardPath,
  cricketFixturesPath,
  cricketLiveControlPath,
  cricketScoreHubPath,
  cricketScorerConsolePath,
} from "@/lib/cricket-routes";
import {
  cricketMatchPublicPath,
  cricketPublicPath,
  openScoreDisplay,
  scoreDisplayPath,
} from "@/lib/tournament-navigation";
import { sportsMissionControlPath } from "@workspace/api-base/scoring-urls";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import {
  AlertTriangle,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit2,
  ExternalLink,
  Flame,
  Layers,
  Monitor,
  MoreVertical,
  Plus,
  Printer,
  Radio,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Tv,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function CricketMatchCenterPage() {
  const [, params] = useRoute("/tournament/:id/score/:matchId");
  const tournamentId = parseInt(params?.id || "0");
  const matchId = parseInt(params?.matchId || "0");

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const { data, isLoading, isError, error, refetch, isFetching } = useScoringMatch(
    tournamentId,
    matchId,
    scoringActive,
  );

  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });
  const { data: scorecard } = useQuery({
    queryKey: ["scoring-scorecard", tournamentId, matchId],
    queryFn: () => getPublicMatchScorecard(tournamentId, matchId),
    enabled: scoringActive && !!tournamentId && !!matchId,
    refetchInterval: data?.match.status === "live" ? 10000 : false,
  });
  const { data: squads } = useQuery({
    queryKey: ["scoring-match-squads", tournamentId, matchId],
    queryFn: () => getMatchSquads(tournamentId, matchId),
    enabled: scoringActive && !!tournamentId && !!matchId,
  });
  const { data: officials } = useQuery({
    queryKey: ["scoring-officials", tournamentId],
    queryFn: () => listOfficials(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });

  const teams = useMemo(
    () => (Array.isArray(masterTeams) ? masterTeams.map(cricketMasterTeamToScorerTeam) : []),
    [masterTeams],
  );
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const playerName = (id: number) =>
    scorecard?.players[String(id)] ?? `Player ${id}`;

  const home = data ? teamMap.get(data.match.homeTeamId) : undefined;
  const away = data ? teamMap.get(data.match.awayTeamId) : undefined;
  const state = data?.state;

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [editRoundName, setEditRoundName] = useState("");
  const [editOvers, setEditOvers] = useState(6);
  const [editVenue, setEditVenue] = useState("");
  const [editResultSummary, setEditResultSummary] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handleOpenEdit() {
    if (!data?.match) return;
    setEditRoundName(data.match.roundName || "");
    setEditOvers(data.match.rules?.overs ?? 6);
    setEditVenue(data.match.venue || "");
    setEditResultSummary(data.match.resultSummary || "");
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!data?.match) return;
    setSavingEdit(true);
    try {
      await updateScoringMatch(tournamentId, matchId, {
        roundName: editRoundName.trim() || null,
        oversLimit: editOvers || 6,
        venue: editVenue.trim() || null,
        resultSummary: editResultSummary.trim() || null,
      });
      toast({
        title: "Match updated",
        description: `Saved changes for Match #${matchId}`,
      });
      setEditOpen(false);
      await refetch();
      await qc.invalidateQueries({ queryKey: ["scoring-match", tournamentId, matchId] });
      await qc.invalidateQueries({ queryKey: ["scoring-matches", tournamentId] });
      await qc.invalidateQueries({ queryKey: ["scoring-scorecard", tournamentId, matchId] });
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
    setDeleting(true);
    try {
      await deleteScoringMatch(tournamentId, matchId);
      toast({
        title: "Match deleted",
        description: `Match #${matchId} was deleted successfully.`,
      });
      setDeleteOpen(false);
      await qc.invalidateQueries({ queryKey: ["scoring-matches", tournamentId] });
      await qc.invalidateQueries({ queryKey: ["scoring-fixtures", tournamentId] });
      setLocation(cricketFixturesPath(tournamentId));
    } catch (e) {
      toast({
        title: "Could not delete match",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }
  const isLive = data?.match.status === "live";
  const isFinished = data ? isTerminalCricketMatchStatus(data.match.status) : false;

  const [activeZone, setActiveZone] = useState<"pre" | "live" | "post">(
    data?.match.status === "live"
      ? "live"
      : data && isTerminalCricketMatchStatus(data.match.status)
        ? "post"
        : "pre",
  );
  const [copiedPin, setCopiedPin] = useState(false);

  function handleCopyPin() {
    const pin = data?.match.scorerPin ?? "0000";
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(String(pin));
    }
    setCopiedPin(true);
    toast({
      title: "Scorer PIN Copied",
      description: `Scorer PIN ${pin} copied to clipboard for match officials`,
    });
    setTimeout(() => setCopiedPin(false), 2000);
  }

  const summary = useMemo(() => {
    if (!data) return null;
    return (
      data.summary ??
      (isFinished || data.state.matchStatus === "live"
        ? buildCricketMatchSummary(data.state)
        : null)
    );
  }, [data, isFinished]);

  const homeScore = state ? formatInningsScore(state, state.homeTeamId) : null;
  const awayScore = state ? formatInningsScore(state, state.awayTeamId) : null;
  const rr = state ? currentRunRate(state) : null;

  const timeline = useMemo(() => {
    if (!data || !state) return [];
    return buildMatchTimeline({
      match: data.match,
      state,
      scorecard: scorecard ?? null,
      teamName: (id) => teamMap.get(id)?.shortCode ?? teamMap.get(id)?.name ?? `Team ${id}`,
      playerName: (id) => scorecard?.players[String(id)] ?? `Player ${id}`,
    });
  }, [data, state, scorecard, teamMap]);

  const stats = useMemo(
    () => buildMatchStatSnapshots(scorecard ?? null),
    [scorecard],
  );

  const duration = matchDurationLabel(
    data?.match.startedAt ?? null,
    data?.match.completedAt ?? null,
  );

  const captainLabel = (teamId: number) => {
    const rows = (
      squads as { squads?: Array<{ teamId: number; squadJson?: MatchSquadJson }> } | undefined
    )?.squads;
    const row = rows?.find((s) => s.teamId === teamId);
    const captainId = row?.squadJson?.captainId;
    if (!captainId) return null;
    return playerName(captainId);
  };

  const publicMatchUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${cricketMatchPublicPath(tournamentId, matchId)}`
      : cricketMatchPublicPath(tournamentId, matchId);

  const scorerHref = cricketScorerConsolePath(tournamentId, matchId);
  const liveControlHref = cricketLiveControlPath(tournamentId);

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  if (tournamentLoading || (scoringActive && isLoading && !data)) {
    return (
      <CricketOrganizerPageShell tournamentId={tournamentId}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </CricketOrganizerPageShell>
    );
  }

  if (!scoringActive) {
    return (
      <CricketOrganizerPageShell tournamentId={tournamentId}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <EmptyState
            icon={Trophy}
            title="Cricket scoring is off"
            desc="Enable scoring for this tournament, then return here."
          />
        </div>
      </CricketOrganizerPageShell>
    );
  }

  if (isError && !data) {
    return (
      <CricketOrganizerPageShell tournamentId={tournamentId}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <EmptyState
            icon={AlertTriangle}
            title="Could not load match"
            desc={error instanceof Error ? error.message : "Something went wrong."}
            action={{ label: "Retry", onClick: () => void refetch() }}
          />
        </div>
      </CricketOrganizerPageShell>
    );
  }

  if (!data || !state) return null;

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Match Center"
        title={`${home?.shortCode ?? "Home"} vs ${away?.shortCode ?? "Away"}`}
        subtitle={tournament?.name}
        badge={isLive ? "LIVE" : undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <BtnPrimary href={scorerHref} className={cn(btnCompactClass, "bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold")}>
              <Radio className="w-4 h-4" />
              Open Scorer Pad
            </BtnPrimary>
            <BtnSecondary href={liveControlHref} className={btnCompactClass}>
              <Tv className="w-4 h-4 text-amber-400" />
              Live Control
            </BtnSecondary>
            <BtnSecondary onClick={handleOpenEdit} className={btnCompactClass}>
              <Edit2 className="w-4 h-4" />
              Edit Details
            </BtnSecondary>
            <BtnSecondary onClick={() => window.print()} className={btnCompactClass}>
              <Printer className="w-4 h-4" />
              Print Scorecard
            </BtnSecondary>
            {data?.match.status !== "completed" && data?.match.status !== "abandoned" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground hover:border-border cursor-pointer"
                    title="Match options"
                    aria-label="Match options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => setDeleteOpen(true)}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Match
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-12 space-y-6 sm:space-y-8">
        {/* Header meta */}
        <section className={cn(hubPanelClass, "flex flex-wrap gap-x-4 gap-y-2 text-sm")}>
          <MetaChip label="Status" value={data.match.status} emphasize={isLive} />
          {tournament?.name ? <MetaChip label="Tournament" value={tournament.name} /> : null}
          {tournament?.sport ? <MetaChip label="Competition" value={tournament.sport} /> : null}
          {data.match.roundName ? <MetaChip label="Round" value={data.match.roundName} /> : null}
          {data.match.venue ? <MetaChip label="Ground" value={data.match.venue} /> : null}
          {data.match.scheduledAt ? (
            <MetaChip
              label="Time"
              value={new Date(data.match.scheduledAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            />
          ) : null}
          <MetaChip label="Match #" value={String(data.match.tournamentMatchNumber ?? data.match.id)} />
          {(officials?.length ?? 0) > 0 ? (
            <MetaChip
              label="Officials"
              value={(officials ?? [])
                .slice(0, 3)
                .map((o) => o.name)
                .join(", ")}
            />
          ) : null}
          {isFetching ? (
            <span className="text-xs text-muted-foreground self-center">Updating…</span>
          ) : null}
        </section>

        {/* Teams + score */}
        <section className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
          <TeamPanel
            name={home?.name ?? "Home"}
            shortCode={home?.shortCode ?? "H"}
            logoUrl={home?.logoUrl}
            color={home?.color}
            score={homeScore}
            captain={captainLabel(data.match.homeTeamId)}
          />
          <div className="flex flex-col items-center justify-center gap-2 py-2">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              vs
            </span>
            {rr != null ? (
              <span className="text-xs text-muted-foreground tabular-nums">CRR {rr.toFixed(2)}</span>
            ) : null}
            {state.target != null ? (
              <span className="text-xs font-semibold text-primary">Target {state.target}</span>
            ) : null}
          </div>
          <TeamPanel
            name={away?.name ?? "Away"}
            shortCode={away?.shortCode ?? "A"}
            logoUrl={away?.logoUrl}
            color={away?.color}
            score={awayScore}
            captain={captainLabel(data.match.awayTeamId)}
          />
        </section>

        {/* Operational Zone Navigation */}
        <div className="flex border-b border-border bg-card rounded-xl p-1 gap-1 shadow-xs overflow-x-auto print:hidden">
          <button
            type="button"
            onClick={() => setActiveZone("pre")}
            className={cn(
              "flex-1 min-w-[140px] py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer",
              activeZone === "pre"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <Users className="w-4 h-4" />
            <span>1. Pre-Match Setup</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveZone("live")}
            className={cn(
              "flex-1 min-w-[140px] py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer",
              activeZone === "live"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <Radio className="w-4 h-4" />
            <span>2. Live Supervision</span>
            {isLive ? (
              <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse ml-0.5" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setActiveZone("post")}
            className={cn(
              "flex-1 min-w-[140px] py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer",
              activeZone === "post"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <Trophy className="w-4 h-4" />
            <span>3. Post-Match Finalisation</span>
            {isFinished ? (
              <span className="h-2 w-2 rounded-full bg-emerald-600 ml-0.5" />
            ) : null}
          </button>
        </div>

        {/* ─── ZONE 1: PRE-MATCH SETUP ─── */}
        {activeZone === "pre" ? (
          <div className="space-y-6">
            {/* Toss Entry & Status */}
            <section className={cn(hubCardClass, "p-4 sm:p-5 space-y-3")}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <HubSectionHeader
                  title="Toss Status & Decision"
                  subtitle="Toss outcome determines batting and bowling positions"
                />
                <Badge
                  variant={state.tossWinnerTeamId != null ? "secondary" : "outline"}
                  className={cn(
                    state.tossWinnerTeamId != null
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                      : "text-muted-foreground",
                  )}
                >
                  {state.tossWinnerTeamId != null ? "Toss Recorded" : "Toss Pending"}
                </Badge>
              </div>

              {state.tossWinnerTeamId != null && state.electedTo ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-500/15 shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {teamMap.get(state.tossWinnerTeamId)?.name ?? "Toss Winner"} won the toss and elected to{" "}
                      <span className="uppercase text-primary font-mono">{state.electedTo}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Decision confirmed. Batting and bowling orders are locked into live match scoring.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Toss has not yet been conducted
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Conduct the toss at the pitch, then record it on the Scorer Console or through Match Officials.
                      </p>
                    </div>
                  </div>
                  <BtnPrimary href={scorerHref} className={cn(btnCompactClass, "shrink-0")}>
                    <Radio className="w-4 h-4" />
                    Conduct Toss on Scorer Pad
                  </BtnPrimary>
                </div>
              )}
            </section>

            {/* Squads & Playing XI Review */}
            <section className="space-y-3">
              <HubSectionHeader
                title="Playing XI & Squad Lineups"
                subtitle="Players submitted by team management for this match"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Home Team Lineup */}
                <div className={cn(hubCardClass, "p-4 space-y-3")}>
                  <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{home?.name ?? "Home Team"}</span>
                      <span className="text-xs text-muted-foreground font-mono">({home?.shortCode ?? "H"})</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {((state.lineups?.[data.match.homeTeamId] ?? []).length > 0)
                        ? `${(state.lineups?.[data.match.homeTeamId] ?? []).length} Confirmed`
                        : "Squad Pending"}
                    </Badge>
                  </div>
                  {((state.lineups?.[data.match.homeTeamId] ?? []).length > 0) ? (
                    <ol className="space-y-1.5 text-xs">
                      {(state.lineups?.[data.match.homeTeamId] ?? []).map((pId: number, idx: number) => (
                        <li key={pId} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                          <span className="text-muted-foreground font-mono w-5">{idx + 1}.</span>
                          <span className="font-medium text-foreground flex-1 truncate">{playerName(pId)}</span>
                          {captainLabel(data.match.homeTeamId) === playerName(pId) ? (
                            <Badge variant="secondary" className="text-[9px] py-0 px-1 font-bold">C</Badge>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      Playing XI lineup will be locked when the scorer initiates the match.
                    </p>
                  )}
                </div>

                {/* Away Team Lineup */}
                <div className={cn(hubCardClass, "p-4 space-y-3")}>
                  <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{away?.name ?? "Away Team"}</span>
                      <span className="text-xs text-muted-foreground font-mono">({away?.shortCode ?? "A"})</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {((state.lineups?.[data.match.awayTeamId] ?? []).length > 0)
                        ? `${(state.lineups?.[data.match.awayTeamId] ?? []).length} Confirmed`
                        : "Squad Pending"}
                    </Badge>
                  </div>
                  {((state.lineups?.[data.match.awayTeamId] ?? []).length > 0) ? (
                    <ol className="space-y-1.5 text-xs">
                      {(state.lineups?.[data.match.awayTeamId] ?? []).map((pId: number, idx: number) => (
                        <li key={pId} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                          <span className="text-muted-foreground font-mono w-5">{idx + 1}.</span>
                          <span className="font-medium text-foreground flex-1 truncate">{playerName(pId)}</span>
                          {captainLabel(data.match.awayTeamId) === playerName(pId) ? (
                            <Badge variant="secondary" className="text-[9px] py-0 px-1 font-bold">C</Badge>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      Playing XI lineup will be locked when the scorer initiates the match.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Match Officials & Ground Conditions */}
            <section className={cn(hubPanelClass, "space-y-3")}>
              <HubSectionHeader title="Match Conditions & Officials" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block">Overs Limit</span>
                  <span className="font-semibold">{data.match.rules?.overs ?? 6} Overs per inning</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block">Ground / Venue</span>
                  <span className="font-semibold">{data.match.venue || "Default Ground"}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block">Assigned Officials</span>
                  <span className="font-semibold">
                    {(officials?.length ?? 0) > 0
                      ? (officials ?? []).map((o) => o.name).join(", ")
                      : "Officials TBD"}
                  </span>
                </div>
              </div>
            </section>

            {/* Danger Zone: Match Removal (Pre-toss / Scheduled Only) */}
            {data.match.status !== "completed" && data.match.status !== "abandoned" ? (
              <section className="rounded-xl border border-destructive/25 bg-destructive/[0.03] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Danger Zone: Delete Match #{data.match.tournamentMatchNumber ?? matchId}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pre-toss fixtures can be removed if no balls have been bowled. This action cannot be undone.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                  className="shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Delete Match
                </Button>
              </section>
            ) : null}
          </div>
        ) : null}

        {/* ─── ZONE 2: LIVE SUPERVISION ─── */}
        {activeZone === "live" ? (
          <div className="space-y-6">
            {/* Scorer Console Access Card with PIN copy */}
            <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-primary">
                    Live Match Console Access
                  </span>
                  <h3 className="text-lg font-bold text-foreground">
                    Dedicated Scorer & Umpire Terminal
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-xl">
                    Open the touch-optimized scoring console to log balls, boundaries, wickets, and extras in real time.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Scorer PIN copy block */}
                  <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg shadow-xs">
                    <span className="text-xs text-muted-foreground">Scorer PIN:</span>
                    <span className="font-mono font-bold text-sm text-foreground tracking-wider">
                      {data.match.scorerPin ?? "0000"}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPin}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="Copy Scorer PIN"
                      aria-label="Copy Scorer PIN"
                    >
                      {copiedPin ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <a
                    href={scorerHref}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm h-10 px-4 shadow-xs hover-elevate active-elevate-2 transition-all cursor-pointer"
                  >
                    <Radio className="w-4 h-4" />
                    Open Scorer Pad
                  </a>
                </div>
              </div>

              {/* Broadcast triggers and public match quick links */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/50">
                <a
                  href={liveControlHref}
                  className={cn(hubPanelClass, "flex items-center gap-3 p-3 hover:border-primary/40 transition-all")}
                >
                  <Tv className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">Live Control & OBS</p>
                    <p className="text-[10px] text-muted-foreground truncate">Manage broadcast overlays</p>
                  </div>
                </a>

                <button
                  type="button"
                  onClick={() => openScoreDisplay(tournamentId)}
                  className={cn(hubPanelClass, "flex items-center gap-3 p-3 hover:border-primary/40 text-left transition-all cursor-pointer")}
                >
                  <Monitor className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">LED Arena Display</p>
                    <p className="text-[10px] text-muted-foreground truncate">Open venue score screen</p>
                  </div>
                </button>

                <a
                  href={cricketMatchPublicPath(tournamentId, matchId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(hubPanelClass, "flex items-center gap-3 p-3 hover:border-primary/40 transition-all")}
                >
                  <ExternalLink className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">Fan Scorecard</p>
                    <p className="text-[10px] text-muted-foreground truncate">Public ball-by-ball web view</p>
                  </div>
                </a>
              </div>
            </section>

            {/* Ball-by-Ball Live Timeline Stream */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <HubSectionHeader title="Live Event Timeline" subtitle="Authoritative match events stream" />
                <span className="text-xs text-muted-foreground font-mono">
                  {timeline.length} event{timeline.length === 1 ? "" : "s"} recorded
                </span>
              </div>
              {timeline.length === 0 ? (
                <div className="p-6 rounded-xl border border-border bg-card text-center">
                  <p className="text-sm text-muted-foreground">
                    Timeline stream activates once toss, lineups, and balls are entered on Scorer Pad.
                  </p>
                </div>
              ) : (
                <ol className="space-y-2 border-l border-border ml-2 pl-4">
                  {timeline.map((item) => (
                    <li key={item.id} className="relative">
                      <span className="absolute -left-[1.35rem] top-1.5 h-2 w-2 rounded-full bg-primary" />
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      {item.detail ? (
                        <p className="text-xs text-muted-foreground">{item.detail}</p>
                      ) : null}
                      {item.at ? (
                        <p className="text-[11px] text-muted-foreground/80">
                          {new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* Live Scorecard Preview */}
            <section className="space-y-3">
              <HubSectionHeader title="Live Scorecard Preview" subtitle="Synchronized with live ball scoring" />
              <div className="mt-2">
                {scorecard ? (
                  <ScorecardView data={scorecard} tournamentId={tournamentId} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Scorecard appears once scoring has started.
                  </p>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {/* ─── ZONE 3: POST-MATCH FINALISATION & REPORTS ─── */}
        {activeZone === "post" ? (
          <div className="space-y-6">
            {/* Result Verification Card */}
            <section className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <HubSectionHeader title="Official Match Result" subtitle="Authoritative outcome verified by match referee" />
                <Badge
                  variant={isFinished ? "secondary" : "outline"}
                  className={cn(
                    isFinished
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold"
                      : "text-muted-foreground",
                  )}
                >
                  {isFinished ? "Result Verified" : "Pending Match Completion"}
                </Badge>
              </div>

              {summary ? (
                <div className="space-y-4">
                  <MatchSummaryCard summary={summary} teams={teams} />
                  <div className={cn(hubPanelClass, "grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm")}>
                    {scorecard?.manOfTheMatch ? (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Player of Match</p>
                        <p className="font-semibold text-primary">{scorecard.manOfTheMatch.playerName}</p>
                      </div>
                    ) : null}
                    {duration ? (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Duration</p>
                        <p className="font-semibold">{duration}</p>
                      </div>
                    ) : null}
                    {(officials?.length ?? 0) > 0 ? (
                      <div className="sm:col-span-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Match Officials</p>
                        <p className="font-semibold">
                          {(officials ?? []).map((o) => `${o.name} (${o.role})`).join(" · ")}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Match summary will be calculated when the match concludes.
                </p>
              )}
            </section>

            {/* Statistics Snapshot */}
            {stats.length > 0 ? (
              <section className="space-y-3">
                <HubSectionHeader title="Match Performance Honors" subtitle="Key individual milestones" />
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
                  {stats.map((s) => (
                    <div key={s.label} className={cn(hubCardClass, "p-3")}>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                      <p className="text-sm font-semibold truncate mt-1">{s.playerName}</p>
                      <p className="text-lg font-display font-bold text-primary tabular-nums">{s.value}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Official PDF Scorecard & Exports */}
            <section className={cn(hubCardClass, "p-5 space-y-4")}>
              <HubSectionHeader title="Documentation & Official Exports" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <Printer className="w-5 h-5 text-emerald-500" />
                    <h4 className="font-bold text-sm text-foreground">Official PDF Scorecard</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Print or save the official signed scorecard document in high-fidelity A4 sheet layout.
                  </p>
                  <Button
                    onClick={() => window.print()}
                    variant="outline"
                    size="sm"
                    className="mt-2 font-semibold cursor-pointer"
                  >
                    <Printer className="w-4 h-4 mr-1.5" />
                    Print Scorecard
                  </Button>
                </div>

                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-5 h-5 text-primary" />
                    <h4 className="font-bold text-sm text-foreground">Share Match Result</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Direct public fan match scorecard link for social media and broadcast dispatches.
                  </p>
                  <div className="pt-2">
                    <ShareButtons
                      url={publicMatchUrl}
                      shareText={`${home?.name ?? "Home"} vs ${away?.name ?? "Away"}`}
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 text-sm print:hidden">
          <Link href={cricketScoreHubPath(tournamentId)} className="text-primary font-semibold">
            ← All matches
          </Link>
          <Link href={cricketDashboardPath(tournamentId)} className="text-muted-foreground">
            Dashboard
          </Link>
        </div>
      </div>

      {/* Modal: Edit Match Details */}
      <Dialog open={editOpen && !!data} onOpenChange={(open) => { if (!open) setEditOpen(false); }}>
        <DialogContent className="max-w-md p-6 space-y-4">
          <DialogHeader className="pb-2 border-b border-border/60 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DialogTitle className="font-bold text-base">Edit Match Details</DialogTitle>
                {data ? (
                  <Badge variant="outline" className="text-[10px] capitalize font-semibold">
                    {data.match.status}
                  </Badge>
                ) : null}
              </div>
              {data ? (
                <span className="text-xs text-muted-foreground">Match #{data.match.tournamentMatchNumber ?? data.match.id}</span>
              ) : null}
            </div>
            <DialogDescription className="sr-only">Edit stage, venue, overs and summary</DialogDescription>
          </DialogHeader>

          {data && data.match.status !== "scheduled" && data.match.status !== "draft" ? (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-500">
              Editing a {data.match.status} match updates display information and rules across all screens without resetting scored balls or player statistics.
            </div>
          ) : null}

          <div className="space-y-3 text-sm">
            <div className="space-y-1.5">
              <Label>Round / Match Stage</Label>
              <Input
                value={editRoundName}
                onChange={(e) => setEditRoundName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Overs per Inning</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={editOvers}
                  onChange={(e) => setEditOvers(parseInt(e.target.value, 10) || 6)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Venue (Optional)</Label>
                <Input
                  value={editVenue}
                  onChange={(e) => setEditVenue(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Result / Display Summary</Label>
              <Input
                value={editResultSummary}
                onChange={(e) => setEditResultSummary(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Custom text displayed on cards, scorecards, and overlays.
              </p>
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
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirm Delete Match (Pre-toss only) */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Match #{data?.match.tournamentMatchNumber ?? matchId}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this match between{" "}
              <strong>{home?.name ?? "Home Team"}</strong> and{" "}
              <strong>{away?.name ?? "Away Team"}</strong>?
              This action cannot be undone. Matches can only be deleted if no balls have been bowled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteMatch();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Match"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CricketOrganizerPageShell>
  );
}

function MetaChip({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground shrink-0">{label}</span>
      {emphasize ? (
        <Badge variant="destructive" className="capitalize">
          {value}
        </Badge>
      ) : (
        <span className="font-medium capitalize truncate">{value}</span>
      )}
    </div>
  );
}

function TeamPanel({
  name,
  shortCode,
  logoUrl,
  color,
  score,
  captain,
}: {
  name: string;
  shortCode: string;
  logoUrl?: string | null;
  color?: string | null;
  score: { runs: number; wickets: number; overs: string } | null;
  captain: string | null;
}) {
  return (
    <div className={cn(hubCardClass, "p-4 space-y-2")}>
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-10 w-10 rounded object-contain bg-white/5" />
        ) : (
          <span
            className="h-10 w-10 rounded flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: color ? `${color}33` : undefined }}
          >
            {(shortCode || "TM").slice(0, 3)}
          </span>
        )}
        <div className="min-w-0">
          <p className="font-display font-bold truncate">{name}</p>
          {captain ? (
            <p className="text-xs text-muted-foreground truncate">Captain · {captain}</p>
          ) : null}
        </div>
      </div>
      {score ? (
        <p className="text-2xl font-display font-bold tabular-nums">
          {score.runs}/{score.wickets}{" "}
          <span className="text-sm font-normal text-muted-foreground">({score.overs} ov)</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Yet to bat</p>
      )}
    </div>
  );
}

function ActionLink({
  href,
  label,
  icon: Icon,
  external,
  primary,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
  primary?: boolean;
}) {
  const className = cn(
    hubPanelClass,
    "text-sm font-semibold hover:border-primary/30 flex items-center gap-2",
    primary && "border-primary/40 bg-primary/5",
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        <Icon className="w-4 h-4 text-primary shrink-0" />
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      <Icon className="w-4 h-4 text-primary shrink-0" />
      {label}
    </Link>
  );
}
