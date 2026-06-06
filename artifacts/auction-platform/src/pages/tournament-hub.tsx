import { useRoute, useLocation } from "wouter";
import {
  useGetTournament,
  useGetTournamentSummary,
  useGetTeamPurses,
  getGetTournamentQueryKey,
  getGetTournamentSummaryQueryKey,
  getGetTeamPursesQueryKey,
} from "@workspace/api-client-react";
import { AuctionCodeBadge } from "@/components/auction-code-badge";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import { openAuctionRoom } from "@/lib/tournament-navigation";
import {
  Users, UserCheck, UserMinus, Wallet, Activity,
  CheckCircle2, Circle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getReadinessChecklistItems,
  tournamentToReadinessInput,
  type AuctionReadinessCheckId,
} from "@workspace/api-base/auction-readiness";

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

  const readinessMode = tournament?.licenseStatus === "active" ? "live" : "trial";
  const settingsPath = `/tournament/${tournamentId}/settings`;
  const readinessLinks: Partial<Record<AuctionReadinessCheckId, string>> = {
    teams: `/tournament/${tournamentId}/teams`,
    players: `/tournament/${tournamentId}/players`,
    minBid: settingsPath,
    openingTimer: settingsPath,
    bidTimer: settingsPath,
    playerOrder: settingsPath,
    bidTiers: settingsPath,
    minSquad: settingsPath,
    maxSquad: settingsPath,
    squadRange: settingsPath,
  };
  const readinessInput = tournament
    ? tournamentToReadinessInput(
        tournament,
        teamPurses?.length ?? 0,
        summary?.totalPlayers ?? 0,
      )
    : null;
  const readinessChecks = readinessInput
    ? getReadinessChecklistItems(readinessInput, readinessMode, readinessLinks)
    : [];
  const readinessComplete = readinessChecks.length > 0 && readinessChecks.every((c) => c.done);

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
        {/* Title */}
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            {tournament?.logoUrl && (
              <img src={tournament.logoUrl} alt={tournament.name} className="h-10 w-10 object-contain rounded" />
            )}
            <h1 className="text-4xl font-bold tracking-tight">{tournament?.name}</h1>
            <span className="px-3 py-1 bg-primary/20 text-primary border border-primary/30 rounded-full text-xs font-bold tracking-widest uppercase">
              {tournament?.status}
            </span>
          </div>
          <p className="text-muted-foreground mt-2 font-mono text-sm flex items-center flex-wrap gap-x-2 gap-y-1">
            {tournament?.sport?.toUpperCase()}
            {tournament?.auctionCode && <AuctionCodeBadge code={tournament.auctionCode} />}
            {tournament?.organizerName && <span>· {tournament.organizerName}</span>}
            {tournament?.venue && <span>· {tournament.venue}</span>}
            <span>· BASE PURSE PER TEAM: {formatIndianRupee(tournament?.basePurse)}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2 max-w-2xl">
            Configure teams, players, and auction rules here. Open the Auction Room in a separate tab when you are ready to run the live session.
          </p>
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
                <div className="p-3 bg-blue-500/10 rounded-lg"><Users className="w-5 h-5 text-blue-500" /></div>
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
                <div className="p-3 bg-green-500/10 rounded-lg"><UserCheck className="w-5 h-5 text-green-500" /></div>
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
                <div className="p-3 bg-destructive/10 rounded-lg"><UserMinus className="w-5 h-5 text-destructive" /></div>
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
                <div className="p-3 bg-primary/10 rounded-lg"><Wallet className="w-5 h-5 text-primary" /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Setup Checklist — visible during setup phase only */}
        {tournament?.status === "setup" && (
          <div className="rounded-xl border border-border bg-card/30 p-5 space-y-4">
            <div>
              <h2 className="text-base font-display font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Setup Checklist
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Complete these steps before going live.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-green-500/20 bg-green-500/5">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-400">Tournament created</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Name, sport, date and purse are configured.</p>
                </div>
              </div>
              {readinessChecks.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${
                    item.done
                      ? "border-green-500/20 bg-green-500/5"
                      : "border-border/50 bg-muted/10"
                  }`}
                >
                  {item.done
                    ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    : <Circle className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${item.done ? "text-green-400" : "text-foreground"}`}>
                      {item.label}
                    </p>
                  </div>
                  {!item.done && item.link && (
                    <button
                      onClick={() => navigate(item.link!)}
                      className="text-xs text-primary hover:underline flex-shrink-0 font-medium mt-0.5"
                    >
                      Fix →
                    </button>
                  )}
                </div>
              ))}
            </div>
            {readinessComplete && (
              <div className="flex items-center gap-3 pt-1 border-t border-border/40">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-sm font-medium flex-1">
                  All set — you can start the {readinessMode === "trial" ? "trial" : "live"} auction.
                </p>
                <button
                  onClick={() => openAuctionRoom(tournamentId)}
                  className="text-xs text-primary font-semibold hover:underline flex-shrink-0"
                >
                  Go to Operator Panel ↗
                </button>
              </div>
            )}
          </div>
        )}

        {/* Team Purses */}
        <div>
          <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Team Purses
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
                        {team.logoUrl ? (
                          <img src={team.logoUrl} alt={team.teamName} className="w-10 h-10 object-contain rounded" />
                        ) : (
                          <div className="w-4 h-8 rounded-sm" style={{ backgroundColor: team.color || "#444" }} />
                        )}
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
