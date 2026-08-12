import { useMemo, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import {
  BtnPrimary,
  BtnSecondary,
  EmptyState,
  HubKpiCard,
  HubSectionHeader,
  PageHeader,
  btnCompactClass,
  hubCardClass,
} from "@/components/badminton/page-chrome";
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
  getCricketMasterTeams,
  handoffAuctionParticipantsToSports,
  ScoringApiError,
} from "@/lib/scoring-api";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";
import { useCricketScoringActive, usePlatformFeatures } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { cricketPublicPath, openScoreDisplay, scoringSchedulePath, auctionRoomPath } from "@/lib/tournament-navigation";
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
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [overs, setOvers] = useState("20");
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<MatchFilter>("all");

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
      const detail = await createScoringMatch(tournamentId, {
        homeTeamId: home,
        awayTeamId: away,
        oversLimit: oversLimit || 20,
      });
      setCreateOpen(false);
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

  const pageActions = (
    <div className="flex flex-wrap items-center gap-2">
      <BtnSecondary
        className={btnCompactClass}
        disabled={!scoringActive}
        onClick={() => openScoreDisplay(tournamentId, tournament?.auctionCode)}
      >
        <Monitor className="w-4 h-4" />
        LED display
      </BtnSecondary>
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

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        eyebrow="Cricket Operations"
        title="Match Command Center"
        subtitle={tournament?.name ?? "Load tournament…"}
        badge={stats.live > 0 ? `${stats.live} Live` : undefined}
        actions={pageActions}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 space-y-8">
        {featuresLoading || tournamentLoading || (scoringActive && isLoading) ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : !scoringActive ? (
          <EmptyState
            icon={Trophy}
            title="Cricket scoring is off"
            desc="Enable scoring for this tournament in auction settings, then return here."
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
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/40 px-4 py-3 text-sm">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Teams & players</span>
                  {" — "}
                  {playersReady} player{playersReady === 1 ? "" : "s"} ready
                </p>
                <BtnSecondary
                  className={btnCompactClass}
                  disabled={handoffBusy}
                  onClick={() => void handleHandoffToSports()}
                >
                  {handoffBusy ? "Refreshing…" : "Refresh from Auction"}
                </BtnSecondary>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <HubKpiCard label="Live now" value={stats.live} icon={Radio} tint="red" pulse={stats.live > 0} />
              <HubKpiCard label="Scheduled" value={stats.scheduled} icon={Calendar} tint="muted" />
              <HubKpiCard label="Completed" value={stats.completed} icon={CheckCircle2} tint="green" />
              <HubKpiCard label="Franchise teams" value={teams.length} icon={Trophy} tint="primary" />
            </div>

            <div className="flex flex-wrap gap-2">
              <BtnSecondary href={scoringSchedulePath(tournamentId)} className={btnCompactClass}>
                <Calendar className="w-4 h-4" />
                Schedule
              </BtnSecondary>
              <BtnSecondary href={cricketPublicPath(tournamentId)} className={btnCompactClass}>
                <Globe className="w-4 h-4" />
                Fan page
              </BtnSecondary>
            </div>

            <section>
              <HubSectionHeader
                title="All matches"
                subtitle={`${filteredMatches.length} of ${stats.total} match${stats.total === 1 ? "" : "es"}`}
                badge={stats.live > 0 ? "LIVE" : undefined}
                badgeVariant="destructive"
              />

              <div className="flex flex-wrap gap-2 mt-3">
                {(
                  [
                    ["all", "All"],
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

              {filteredMatches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                  {filteredMatches.map((m) => {
                    const home = teams.find((t) => t.id === m.homeTeamId);
                    const away = teams.find((t) => t.id === m.awayTeamId);
                    const isLive = m.status === "live";
                    return (
                      <Link key={m.id} href={`/tournament/${tournamentId}/score/${m.id}`}>
                        <div
                          className={cn(
                            hubCardClass,
                            "p-4 cursor-pointer transition-all hover:border-primary/30",
                            isLive && "border-red-500/30 shadow-[0_0_24px_rgba(239,68,68,0.12)]",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <Badge variant={statusBadgeVariant(m.status)} className="capitalize">
                              {m.status}
                            </Badge>
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          </div>
                          <p className="font-display font-bold text-lg text-foreground">
                            {home?.shortCode ?? home?.name ?? "Home"} vs {away?.shortCode ?? away?.name ?? "Away"}
                          </p>
                          {m.resultSummary ? (
                            <p className="text-sm text-muted-foreground mt-1">{m.resultSummary}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-1 capitalize">{m.status}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={Plus}
                  title={filter === "all" ? "No matches yet" : "No matches in this filter"}
                  desc={
                    filter === "all"
                      ? "Create your first match to open the live scorer."
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
            <BtnPrimary className="w-full" disabled={creating} onClick={() => void handleCreate()}>
              Create match
            </BtnPrimary>
          </div>
        </DialogContent>
      </Dialog>
    </CricketOrganizerPageShell>
  );
}
