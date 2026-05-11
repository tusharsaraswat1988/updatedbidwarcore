import { useRoute, useLocation } from "wouter";
import {
  useGetTournament,
  useGetTournamentSummary,
  useGetTeamPurses,
  getGetTournamentQueryKey,
  getGetTournamentSummaryQueryKey,
  getGetTeamPursesQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import {
  Users, UserCheck, UserMinus, Wallet, Activity,
  Gavel, Monitor, Trophy, ExternalLink,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function TournamentHub() {
  const [, params] = useRoute("/tournament/:id");
  const [, navigate] = useLocation();
  const tournamentId = parseInt(params?.id || "0");

  const { data: tournament, isLoading: loadingTournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const { data: summary, isLoading: loadingSummary } = useGetTournamentSummary(tournamentId, {
    query: { queryKey: getGetTournamentSummaryQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const { data: teamPurses, isLoading: loadingPurses } = useGetTeamPurses(tournamentId, {
    query: { queryKey: getGetTeamPursesQueryKey(tournamentId), enabled: !!tournamentId },
  });

  if (loadingTournament) {
    return (
      <AppLayout tournamentId={tournamentId}>
        <div className="space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-8">
        {/* Title + Quick Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-4xl font-bold tracking-tight">{tournament?.name}</h1>
              <span className="px-3 py-1 bg-primary/20 text-primary border border-primary/30 rounded-full text-xs font-bold tracking-widest uppercase">
                {tournament?.status}
              </span>
            </div>
            <p className="text-muted-foreground mt-2 font-mono text-sm">
              {tournament?.sport?.toUpperCase()} · BASE PURSE: {formatIndianRupee(tournament?.basePurse)}
            </p>
          </div>
          {/* Quick launch links */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => navigate(`/tournament/${tournamentId}/auction`)}
            >
              <Gavel className="w-4 h-4" /> Operator Panel
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.open(`/tournament/${tournamentId}/display`, "_blank")}
            >
              <Monitor className="w-4 h-4" /> LED Display <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-60" />
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate(`/tournament/${tournamentId}/reports`)}
            >
              <Trophy className="w-4 h-4" /> Reports
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Players</p>
                  {loadingSummary ? <Skeleton className="h-9 w-16" /> : <p className="text-3xl font-display font-bold">{summary?.totalPlayers || 0}</p>}
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Sold</p>
                  {loadingSummary ? <Skeleton className="h-9 w-16" /> : <p className="text-3xl font-display font-bold text-green-500">{summary?.soldPlayers || 0}</p>}
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <UserCheck className="w-5 h-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Unsold</p>
                  {loadingSummary ? <Skeleton className="h-9 w-16" /> : <p className="text-3xl font-display font-bold text-destructive">{summary?.unsoldPlayers || 0}</p>}
                </div>
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <UserMinus className="w-5 h-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Spent</p>
                  {loadingSummary ? <Skeleton className="h-9 w-24" /> : <p className="text-3xl font-display font-bold text-primary">{formatShortIndianRupee(summary?.totalSpent)}</p>}
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Purses */}
        <div>
          <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Team Purses
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingPurses ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)
            ) : teamPurses?.map(team => {
              const usedPercentage = (team.purseUsed / team.purse) * 100;
              return (
                <Card key={team.teamId} className="bg-card/50 border-border">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-8 rounded-sm" style={{ backgroundColor: team.color || "#444" }} />
                        <div>
                          <h3 className="font-bold text-lg leading-none">{team.teamName}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{team.playersBought} Players</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs font-mono text-muted-foreground">{team.shortCode}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Remaining</p>
                        <p className="font-mono font-bold text-primary">{formatShortIndianRupee(team.purseRemaining)}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatShortIndianRupee(team.purseUsed)} Used</span>
                        <span>{formatShortIndianRupee(team.purse)} Total</span>
                      </div>
                      <Progress value={usedPercentage} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
