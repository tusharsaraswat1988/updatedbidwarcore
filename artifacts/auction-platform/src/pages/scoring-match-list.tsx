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
import { useScoringMatches, useSquadReadiness, scoringSquadsQueryKey } from "@/hooks/use-scoring-match";
import {
  createScoringMatch,
  deleteScoringMatch,
  getCricketMasterTeams,
  handoffAuctionParticipantsToSports,
  ScoringApiError,
} from "@/lib/scoring-api";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
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
import { cricketLiveControlPath } from "@/lib/cricket-routes";
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

  const { data: masterTeams, refetch: refetchTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });

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

  const [createOpen, setCreateOpen] = useState(false);
  const [linksInfoOpen, setLinksInfoOpen] = useState(false);
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [overs, setOvers] = useState("20");
  const [matchDateTime, setMatchDateTime] = useState(""); // datetime-local string
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<MatchFilter>("all");
  const [deletingMatchId, setDeletingMatchId] = useState<number | null>(null);

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
    const oversLimit = parseInt(overs, 10);
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
        oversLimit: oversLimit || 20,
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

  const liveControlUrl = cricketLiveControlPath(tournamentId);

  const pageActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={liveControlUrl}>
        <Button
          variant="outline"
          className={cn(btnCompactClass, "border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-1.5 font-bold")}
        >
          <Tv className="w-4 h-4 text-amber-400" />
          Live Control Console
        </Button>
      </Link>
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

  const ledDisplayUrl = scoreDisplayPath(tournamentId, tournament?.auctionCode);
  const obsStreamUrl = cricketObsLivePath(tournamentId, tournament?.auctionCode);
  const publicFanUrl = cricketPublicPath(tournamentId);

  function copyTextToClipboard(text: string, label: string) {
    const fullUrl =
      typeof window !== "undefined" && text.startsWith("/")
        ? `${window.location.origin}${text}`
        : text;
    void navigator.clipboard.writeText(fullUrl).then(
      () => toast({ title: `${label} copied to clipboard!` }),
      () => toast({ title: "Could not copy link", variant: "destructive" }),
    );
  }

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
        {/* ─── SLEEK CONSOLIDATED OUTPUT LINKS BAR ─── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-card/70 px-3.5 py-2.5 shadow-sm text-xs">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <Monitor className="w-4 h-4 text-primary shrink-0" />
            <span>Output Links:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* LED Ground */}
            <div className="flex items-center rounded-lg border border-border bg-background/80 overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => openScoreDisplay(tournamentId, tournament?.auctionCode)}
                className="px-2.5 py-1 font-semibold hover:bg-muted/70 transition flex items-center gap-1.5 text-foreground text-[11px]"
                title="Open LED Ground Scoreboard"
              >
                <span>📺 Ground LED</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => copyTextToClipboard(ledDisplayUrl, "LED Scoreboard Link")}
                className="p-1 border-l border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Copy LED URL"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>

            {/* OBS Live Stream */}
            <div className="flex items-center rounded-lg border border-sky-500/30 bg-sky-500/5 overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => window.open(obsStreamUrl, "_blank", "noopener,noreferrer")}
                className="px-2.5 py-1 font-semibold hover:bg-sky-500/10 transition flex items-center gap-1.5 text-sky-400 text-[11px]"
                title="Open OBS Overlay Screen"
              >
                <span>🎥 OBS Stream</span>
                <ExternalLink className="w-3 h-3 text-sky-400/70" />
              </button>
              <button
                type="button"
                onClick={() => copyTextToClipboard(obsStreamUrl, "OBS Live Stream Link")}
                className="p-1 border-l border-sky-500/30 hover:bg-sky-500/15 text-sky-400"
                title="Copy OBS URL"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>

            {/* Fan Match Page */}
            <div className="flex items-center rounded-lg border border-border bg-background/80 overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => window.open(publicFanUrl, "_blank", "noopener,noreferrer")}
                className="px-2.5 py-1 font-semibold hover:bg-muted/70 transition flex items-center gap-1.5 text-foreground text-[11px]"
                title="Open Fan Match Page"
              >
                <span>📱 Fan Scorecard</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => copyTextToClipboard(publicFanUrl, "Fan Page Link")}
                className="p-1 border-l border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Copy Fan Page URL"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>

            {/* (i) Info Guide Dialog Trigger */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLinksInfoOpen(true)}
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1 rounded-lg"
              title="Setup & Broadcast Info"
            >
              <Info className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Setup Help</span>
            </Button>
          </div>
        </div>

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
                    const scorerPath = `/tournament/${tournamentId}/score/${m.id}/live`;
                    const matchCenterPath = `/tournament/${tournamentId}/score/${m.id}`;
                    const matchLabel = m.tournamentMatchNumber != null
                      ? `Match #${m.tournamentMatchNumber}`
                      : `Match #${m.id}`;

                    return (
                      <div
                        key={m.id}
                        className={cn(
                          hubCardClass,
                          "p-4 flex flex-col justify-between gap-4 transition-all",
                          isLive && "border-amber-500/50 bg-gradient-to-b from-amber-500/10 via-card to-card shadow-[0_0_24px_rgba(245,158,11,0.15)]",
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <Badge variant={statusBadgeVariant(m.status)} className="capitalize font-bold text-[11px]">
                              {isLive ? "🔴 LIVE NOW" : m.status}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground font-semibold">
                              {matchLabel}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <p className="font-display font-black text-lg text-foreground tracking-tight">
                              {home?.shortCode ?? home?.name ?? "Home"} vs {away?.shortCode ?? away?.name ?? "Away"}
                            </p>
                            {m.resultSummary ? (
                              <p className="text-xs text-muted-foreground">{m.resultSummary}</p>
                            ) : m.scheduledAt ? (
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
                  icon={Plus}
                  title={filter === "all" ? "No matches yet" : "No matches in this filter"}
                  desc={
                    filter === "all"
                      ? "Create your first match to start live scoring."
                      : "Try another filter or create a new match."
                  }
                  action={
                    rosterReady
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
            <div className="space-y-2">
              <Label>Overs</Label>
              <Input value={overs} onChange={(e) => setOvers(e.target.value)} inputMode="numeric" />
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

      {/* Screen & Output Links Info Dialog */}
      <Dialog open={linksInfoOpen} onOpenChange={setLinksInfoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-primary" />
              Live Screen & Broadcast Setup Guide
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-xs text-muted-foreground leading-relaxed">
            <div className="rounded-xl border border-border p-3.5 bg-muted/30 space-y-1.5">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <span>📺 Ground Scoreboard (LED Screen / Projector)</span>
              </p>
              <p>
                Ground projector ya stadium LED display par full-screen browser me open karein. Keyboard par <strong>F11</strong> dabakar full screen mode karein. Real-time ball-by-ball score auto-refresh hota hai.
              </p>
            </div>

            <div className="rounded-xl border border-sky-500/30 p-3.5 bg-sky-500/5 space-y-1.5">
              <p className="font-bold text-sky-400 flex items-center gap-1.5">
                <span>🎥 OBS Studio & Live Stream Overlay</span>
              </p>
              <p>
                OBS Studio ya vMix me <strong>Add Source (+) &gt; Browser</strong> chunein. Upar ka OBS link paste karein. Settings: <strong>Width: 1920</strong>, <strong>Height: 1080</strong>, <strong>FPS: 60</strong>.
              </p>
              <p className="text-[11px] text-sky-300/80">
                Overlay mid-section 100% transparent hai jo aapke camera feed ke upar scorebug aur animation layers dikhata hai.
              </p>
            </div>

            <div className="rounded-xl border border-border p-3.5 bg-muted/30 space-y-1.5">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <span>📱 Public Fan Page & Scorecard</span>
              </p>
              <p>
                WhatsApp groups, spectators aur fans ke sath share karein taaki sabhi live ball commentary aur scorecard mobile par dekh sakein.
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/30 p-3.5 bg-amber-500/5 space-y-1.5">
              <p className="font-bold text-amber-400 flex items-center gap-1.5">
                <span>🎛️ Live Control Console</span>
              </p>
              <p>
                Live Control Console par jakar aap LED aur OBS par kya display hoga (Score vs Playing 11 vs Points Table vs Sponsors) switch kar sakte hain.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </CricketOrganizerPageShell>
  );
}
