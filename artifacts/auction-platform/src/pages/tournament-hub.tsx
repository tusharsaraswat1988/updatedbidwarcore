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
import { Progress } from "@/components/ui/progress";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import { openAuctionRoom } from "@/lib/tournament-navigation";
import { readinessFixPath } from "@/lib/settings-navigation";
import {
  Users, UserCheck, UserMinus, Wallet, Activity,
  CheckCircle2, Circle, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const readinessLinks: Partial<Record<AuctionReadinessCheckId, string>> = {
    teams: readinessFixPath(tournamentId, "teams"),
    players: readinessFixPath(tournamentId, "players"),
    minBid: readinessFixPath(tournamentId, "minBid"),
    openingTimer: readinessFixPath(tournamentId, "openingTimer"),
    bidTimer: readinessFixPath(tournamentId, "bidTimer"),
    playerOrder: readinessFixPath(tournamentId, "playerOrder"),
    bidTiers: readinessFixPath(tournamentId, "bidTiers"),
    minSquad: readinessFixPath(tournamentId, "minSquad"),
    maxSquad: readinessFixPath(tournamentId, "maxSquad"),
    squadRange: readinessFixPath(tournamentId, "squadRange"),
  };
  const isSetupPhase = tournament?.status === "setup";
  const minPlayersNeeded = readinessMode === "trial" ? 1 : 2;
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
  const readinessDoneCount = readinessChecks.filter((c) => c.done).length;
  const readinessTotal = readinessChecks.length;
  const readinessPercent = readinessTotal > 0 ? Math.round((readinessDoneCount / readinessTotal) * 100) : 0;
  const isPracticeMode = tournament?.licenseStatus !== "active";
  const statusLabel = tournament?.status === "setup"
    ? "Getting Ready"
    : tournament?.status === "active"
      ? "Auction Running"
      : tournament?.status === "completed"
        ? "Auction Done"
        : tournament?.status ?? "";

  const liveHelpWhatsApp = `https://wa.me/?text=${encodeURIComponent(
    `Hi BidWar, I have completed practice setup for "${tournament?.name ?? "my tournament"}". Please help me activate the live auction.`,
  )}`;

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
              {statusLabel}
            </span>
          </div>
          <p className="text-muted-foreground mt-2 font-mono text-sm flex items-center flex-wrap gap-x-2 gap-y-1">
            {tournament?.sport?.toUpperCase()}
            {tournament?.organizerName && <span>· {tournament.organizerName}</span>}
            {tournament?.venue && <span>· {tournament.venue}</span>}
            <span>· Team budget: {formatIndianRupee(tournament?.basePurse)}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2 max-w-2xl">
            Add teams and players, finish settings, then open Auction Control in a new tab when you are ready.
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isSetupPhase ? (
            <>
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Teams</p>
                      {loadingPurses ? <Skeleton className="h-9 w-16" /> : (
                        <p className="text-3xl font-display font-bold">
                          {teamPurses?.length || 0}
                          <span className="text-lg text-muted-foreground font-normal"> / 2</span>
                        </p>
                      )}
                    </div>
                    <div className="p-3 bg-amber-500/10 rounded-lg"><Users className="w-5 h-5 text-amber-500" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Players</p>
                      {loadingSummary ? <Skeleton className="h-9 w-16" /> : (
                        <p className="text-3xl font-display font-bold">
                          {summary?.totalPlayers || 0}
                          <span className="text-lg text-muted-foreground font-normal"> / {minPlayersNeeded}</span>
                        </p>
                      )}
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-lg"><UserCheck className="w-5 h-5 text-blue-500" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Settings</p>
                      <p className="text-3xl font-display font-bold text-primary">{readinessPercent}%</p>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-lg"><Activity className="w-5 h-5 text-primary" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Steps left</p>
                      <p className="text-3xl font-display font-bold">{readinessTotal - readinessDoneCount}</p>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg"><CheckCircle2 className="w-5 h-5 text-muted-foreground" /></div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Setup Checklist — visible during setup phase only */}
        {tournament?.status === "setup" && (
          <div className="rounded-xl border border-border bg-card/30 p-5 space-y-4">
            <div>
              <h2 className="text-base font-display font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Setup Checklist
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {readinessDoneCount} of {readinessTotal} complete ({readinessPercent}%)
              </p>
              <Progress value={readinessPercent} className="h-1.5 mt-2 max-w-xs" />
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
                  All set — you can start the {readinessMode === "trial" ? "practice" : "live"} auction.
                </p>
                <button
                  onClick={() => openAuctionRoom(tournamentId)}
                  className="text-xs text-primary font-semibold hover:underline flex-shrink-0"
                >
                  Open Auction Control ↗
                </button>
              </div>
            )}
            {readinessComplete && isPracticeMode && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-300">Ready for the live auction?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Run a practice auction first. When you are happy, contact BidWar to activate live mode, then clear practice data before the real event.
                </p>
                <Button size="sm" variant="outline" className="gap-2 border-amber-500/30 text-amber-300 hover:bg-amber-500/10" asChild>
                  <a href={liveHelpWhatsApp} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-3.5 h-3.5" /> Contact BidWar on WhatsApp
                  </a>
                </Button>
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
