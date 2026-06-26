import { useMemo, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetTournament,
  useListTeams,
  getGetTournamentQueryKey,
  getListTeamsQueryKey,
} from "@workspace/api-client-react";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import {
  BtnPrimary,
  EmptyState,
  HubKpiCard,
  HubSectionHeader,
  PageHeader,
  hubCardClass,
} from "@/components/badminton/page-chrome";
import { Button } from "@/components/ui/button";
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
import { useScoringMatches, useSquadReadiness } from "@/hooks/use-scoring-match";
import { createScoringMatch } from "@/lib/scoring-api";
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
} from "lucide-react";
import { useCricketScoringActive, usePlatformFeatures } from "@/hooks/use-platform-features";
import { cricketPublicPath, openScoreDisplay, scoringSchedulePath } from "@/lib/tournament-navigation";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type CricketMasterTeam = {
  auctionTeamId: number;
  name: string;
  squadCount: number;
  syncedToMaster: boolean;
};

function statusBadgeVariant(status: string): "default" | "destructive" | "secondary" | "outline" {
  if (status === "live") return "destructive";
  if (status === "completed") return "secondary";
  if (status === "abandoned") return "outline";
  return "default";
}

export default function ScoringMatchListPage() {
  const [, params] = useRoute("/tournament/:id/score");
  const [, navigate] = useLocation();
  const tournamentId = parseInt(params?.id || "0");
  const { toast } = useToast();

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: teams } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { loading: featuresLoading } = usePlatformFeatures();
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const { data: matches, isLoading, refetch, isFetching } = useScoringMatches(tournamentId, scoringActive);
  const { data: squadData } = useSquadReadiness(tournamentId, scoringActive);
  const qc = useQueryClient();

  const { data: masterTeams } = useQuery<CricketMasterTeam[]>({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/scoring/master-teams`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load teams");
      return res.json();
    },
    enabled: scoringActive && !!tournamentId,
  });

  const stats = useMemo(() => {
    const list = matches ?? [];
    return {
      live: list.filter((m) => m.status === "live").length,
      scheduled: list.filter((m) => m.status === "scheduled").length,
      completed: list.filter((m) => m.status === "completed").length,
      total: list.length,
    };
  }, [matches]);

  const [syncingRoster, setSyncingRoster] = useState(false);

  async function handleSyncRoster() {
    setSyncingRoster(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/scoring/sync-roster`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json();
      toast({
        title: "Roster synced",
        description: `${data.teamsSynced ?? 0} teams, ${data.playersSynced ?? 0} players linked to master sports.`,
      });
      void qc.invalidateQueries({ queryKey: ["cricket-master-teams", tournamentId] });
    } catch (e) {
      toast({
        title: "Sync failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSyncingRoster(false);
    }
  }

  const unsyncedTeams = masterTeams?.filter((t) => !t.syncedToMaster).length ?? 0;

  const [createOpen, setCreateOpen] = useState(false);
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [overs, setOvers] = useState("20");
  const [creating, setCreating] = useState(false);

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
      toast({
        title: "Could not create match",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  const pageActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={syncingRoster || !scoringActive}
        onClick={() => void handleSyncRoster()}
      >
        <RefreshCw className={cn("w-4 h-4", syncingRoster && "animate-spin")} />
        Sync roster
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={!scoringActive}
        onClick={() => openScoreDisplay(tournamentId, tournament?.auctionCode)}
      >
        <Monitor className="w-4 h-4" />
        LED display
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={isFetching}
        onClick={() => void refetch()}
      >
        <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
        Refresh
      </Button>
      <BtnPrimary onClick={() => setCreateOpen(true)} disabled={!scoringActive}>
        <Plus className="w-4 h-4 mr-1.5 inline" />
        New match
      </BtnPrimary>
    </div>
  );

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
        {featuresLoading || isLoading ? (
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
            {unsyncedTeams > 0 ? (
              <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
                {unsyncedTeams} team(s) not linked to master sports — run Sync roster before scoring.
              </div>
            ) : null}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <HubKpiCard label="Live now" value={stats.live} icon={Radio} tint="red" pulse={stats.live > 0} />
              <HubKpiCard label="Scheduled" value={stats.scheduled} icon={Calendar} tint="muted" />
              <HubKpiCard label="Completed" value={stats.completed} icon={CheckCircle2} tint="green" />
              <HubKpiCard label="Auction teams" value={teams?.length ?? 0} icon={Trophy} tint="primary" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" className="gap-2" asChild>
                <Link href={scoringSchedulePath(tournamentId)}>
                  <Calendar className="w-4 h-4" />
                  Schedule
                </Link>
              </Button>
              <Button variant="secondary" size="sm" className="gap-2" asChild>
                <Link href={cricketPublicPath(tournamentId)}>
                  <Globe className="w-4 h-4" />
                  Fan page
                </Link>
              </Button>
            </div>

            <section>
              <HubSectionHeader
                title="All matches"
                subtitle={`${stats.total} match${stats.total === 1 ? "" : "es"} in this tournament`}
                badge={stats.live > 0 ? "LIVE" : undefined}
                badgeVariant="destructive"
              />

              {matches && matches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                  {matches.map((m) => {
                    const home = teams?.find((t) => t.id === m.homeTeamId);
                    const away = teams?.find((t) => t.id === m.awayTeamId);
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
                  title="No matches yet"
                  desc="Create your first match to open the live scorer."
                  action={{ label: "New match", onClick: () => setCreateOpen(true) }}
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
                  {teams?.map((t) => {
                    const squad = squadData?.squads.find((s) => s.teamId === t.id);
                    return (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                        {squad ? ` (${squad.eligibleCount} players)` : ""}
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
                  {teams?.map((t) => {
                    const squad = squadData?.squads.find((s) => s.teamId === t.id);
                    return (
                      <SelectItem key={t.id} value={String(t.id)} disabled={homeTeamId === String(t.id)}>
                        {t.name}
                        {squad ? ` (${squad.eligibleCount} players)` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {squadData?.squads.some((s) => !s.ready) ? (
              <p className="text-xs text-primary">
                Some teams have fewer than {squadData.minPlayingXi} sold/retained players — playing XI may be incomplete.
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
