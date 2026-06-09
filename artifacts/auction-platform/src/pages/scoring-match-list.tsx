import { useEffect, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetTournament,
  useListTeams,
  getGetTournamentQueryKey,
  getListTeamsQueryKey,
} from "@workspace/api-client-react";
import { ScorerShell } from "@/components/scoring/scorer-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, ChevronRight, CircleDot, Monitor, RefreshCw, Calendar, Globe } from "lucide-react";
import { openScoreDisplay, scoringSchedulePath } from "@/lib/tournament-navigation";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type CricketMasterTeam = {
  auctionTeamId: number;
  name: string;
  squadCount: number;
  syncedToMaster: boolean;
};

function statusColor(status: string) {
  if (status === "live") return "text-green-400";
  if (status === "completed") return "text-muted-foreground";
  if (status === "abandoned") return "text-red-400";
  return "text-amber-400";
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
  const isCricket = tournament?.sport === "cricket";
  const scoringEnabled = tournament?.scoringEnabled === true;
  const scoringActive = isCricket && scoringEnabled;
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

  useEffect(() => {
    if (!tournament || scoringActive) return;
    navigate(`/tournament/${tournamentId}`);
  }, [tournament, scoringActive, tournamentId, navigate]);

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

  return (
      <ScorerShell
        tournamentId={tournamentId}
        title="Cricket Scorer"
        subtitle={tournament?.name}
        backHref={`/tournament/${tournamentId}`}
        onRefresh={() => void refetch()}
        refreshing={isFetching}
      >
        {!scoringActive ? null : (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button className="flex-1 min-w-[120px] h-12 gap-2" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4" />
                New match
              </Button>
              <Button
                variant="secondary"
                className="h-12 gap-2"
                onClick={() => navigate(scoringSchedulePath(tournamentId))}
              >
                <Calendar className="w-4 h-4" />
                Schedule
              </Button>
              <Button
                variant="secondary"
                className="h-12 gap-2"
                onClick={() => navigate(cricketPublicPath(tournamentId))}
              >
                <Globe className="w-4 h-4" />
                Fan page
              </Button>
              <Button
                variant="outline"
                className="h-12 gap-2 shrink-0"
                disabled={syncingRoster}
                onClick={() => void handleSyncRoster()}
                title="Link auction teams and squads to master sports"
              >
                <RefreshCw className={`w-4 h-4 ${syncingRoster ? "animate-spin" : ""}`} />
                Sync
              </Button>
              <Button
                variant="outline"
                className="h-12 gap-2"
                onClick={() => openScoreDisplay(tournamentId, tournament?.auctionCode)}
              >
                <Monitor className="w-4 h-4" />
                LED
              </Button>
            </div>

            {unsyncedTeams > 0 ? (
              <p className="text-xs text-amber-400/90 px-1">
                {unsyncedTeams} team(s) not yet linked to master sports — tap Sync before scoring.
              </p>
            ) : null}

            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : matches && matches.length > 0 ? (
              <ul className="space-y-2">
                {matches.map((m) => {
                  const home = teams?.find((t) => t.id === m.homeTeamId);
                  const away = teams?.find((t) => t.id === m.awayTeamId);
                  return (
                    <li key={m.id}>
                      <Link
                        href={`/tournament/${tournamentId}/score/${m.id}`}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 active:bg-muted/40"
                      >
                        <CircleDot className={`w-4 h-4 shrink-0 ${statusColor(m.status)}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {home?.shortCode ?? "H"} vs {away?.shortCode ?? "A"}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {m.status}
                            {m.resultSummary ? ` · ${m.resultSummary}` : ""}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">
                No matches yet. Create one to start scoring.
              </p>
            )}
          </div>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-sm">
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
                <p className="text-xs text-amber-400/90">
                  Some teams have fewer than {squadData.minPlayingXi} sold/retained players — playing XI may be incomplete.
                </p>
              ) : null}
              <div className="space-y-2">
                <Label>Overs</Label>
                <Input value={overs} onChange={(e) => setOvers(e.target.value)} inputMode="numeric" />
              </div>
              <Button className="w-full h-11" disabled={creating} onClick={() => void handleCreate()}>
                Create match
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </ScorerShell>
  );
}
