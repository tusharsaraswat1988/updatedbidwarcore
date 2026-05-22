import { useState } from "react";
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
  Gavel, Monitor, Trophy, ExternalLink, Link2, Dices,
  Settings, Download, CheckCircle2, Circle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function TournamentHub() {
  const [, params] = useRoute("/tournament/:id");
  const [, navigate] = useLocation();
  const tournamentId = parseInt(params?.id || "0");

  const [exportLoading, setExportLoading] = useState(false);

  const { data: tournament, isLoading: loadingTournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: summary, isLoading: loadingSummary } = useGetTournamentSummary(tournamentId, {
    query: { queryKey: getGetTournamentSummaryQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: teamPurses, isLoading: loadingPurses } = useGetTeamPurses(tournamentId, {
    query: { queryKey: getGetTeamPursesQueryKey(tournamentId), enabled: !!tournamentId },
  });

  async function handleExportForLocal() {
    setExportLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/export`);
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(tournament?.name || "tournament").replace(/\s+/g, "-").toLowerCase()}-bidwar-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExportLoading(false);
    }
  }

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
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1 font-semibold">Auction Control Center</p>
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
              {tournament?.auctionCode && (
                <span className="text-amber-400 border border-amber-500/40 bg-amber-500/10 rounded px-1.5 py-0.5 text-[11px] font-bold tracking-widest">
                  {tournament.auctionCode}
                </span>
              )}
              {tournament?.organizerName && <span>· {tournament.organizerName}</span>}
              {tournament?.venue && <span>· {tournament.venue}</span>}
              <span>· BASE PURSE: {formatIndianRupee(tournament?.basePurse)}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-2 max-w-2xl">
              This is your central control area. Manage teams, players, live auction, displays and reports — all from here.
            </p>
          </div>
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
              onClick={() => navigate(`/tournament/${tournamentId}/links`)}
            >
              <Link2 className="w-4 h-4" /> Links
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate(`/tournament/${tournamentId}/fortune-wheel`)}
            >
              <Dices className="w-4 h-4" /> Fortune Wheel
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate(`/tournament/${tournamentId}/reports`)}
            >
              <Trophy className="w-4 h-4" /> Reports
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
              onClick={handleExportForLocal}
              disabled={exportLoading}
            >
              <Download className="w-4 h-4" /> {exportLoading ? "Exporting..." : "Export for Local"}
            </Button>
            <Button
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-all"
              onClick={() => navigate(`/tournament/${tournamentId}/settings`)}
              title="Open tournament settings (identity, auction rules, broadcast, recovery)"
            >
              <Settings className="w-4 h-4" /> Tournament Settings
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
              {[
                {
                  done: true,
                  label: "Tournament created",
                  desc: "Name, sport, date and purse are configured.",
                  link: undefined as string | undefined,
                  linkLabel: undefined as string | undefined,
                },
                {
                  done: (teamPurses?.length ?? 0) >= 2,
                  label: "Add at least 2 teams",
                  desc: (teamPurses?.length ?? 0) >= 2
                    ? `${teamPurses?.length} teams added — good to go.`
                    : "You need at least 2 franchise teams to run an auction.",
                  link: `/tournament/${tournamentId}/teams`,
                  linkLabel: "Add teams",
                },
                {
                  done: (summary?.totalPlayers ?? 0) > 0,
                  label: "Add players",
                  desc: (summary?.totalPlayers ?? 0) > 0
                    ? `${summary?.totalPlayers} players in the pool.`
                    : "Add the athletes who will be auctioned off.",
                  link: `/tournament/${tournamentId}/players`,
                  linkLabel: "Add players",
                },
              ].map((item, i) => (
                <div
                  key={i}
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
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  {!item.done && item.link && (
                    <button
                      onClick={() => navigate(item.link!)}
                      className="text-xs text-primary hover:underline flex-shrink-0 font-medium mt-0.5"
                    >
                      {item.linkLabel} →
                    </button>
                  )}
                </div>
              ))}
            </div>
            {(teamPurses?.length ?? 0) >= 2 && (summary?.totalPlayers ?? 0) > 0 && (
              <div className="flex items-center gap-3 pt-1 border-t border-border/40">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-sm font-medium flex-1">All set — you can start the auction.</p>
                <button
                  onClick={() => navigate(`/tournament/${tournamentId}/auction`)}
                  className="text-xs text-primary font-semibold hover:underline flex-shrink-0"
                >
                  Open Operator Panel →
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
