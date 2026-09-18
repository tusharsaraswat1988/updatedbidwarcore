import { useRoute } from "wouter";
import {
  useGetTournamentSummary,
  useGetTournament,
  useGetTeamPurses,
  useGetTopBids,
  getGetTournamentSummaryQueryKey,
  getGetTournamentQueryKey,
  getGetTeamPursesQueryKey,
  getGetTopBidsQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { OrganizerSectionHeader } from "@/components/organizer-page-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Wallet, TrendingUp, BarChart3, UserCheck, Award, FileText } from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportCenter } from "@/components/reports/report-center";

export default function Reports() {
  const [, params] = useRoute("/tournament/:id/reports");
  const tournamentId = parseInt(params?.id || "0");

  const { data: summary, isLoading: loadingSummary } = useGetTournamentSummary(tournamentId, {
    query: { queryKey: getGetTournamentSummaryQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: teamPurses } = useGetTeamPurses(tournamentId, {
    query: { queryKey: getGetTeamPursesQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: topBids } = useGetTopBids(tournamentId, {
    query: { queryKey: getGetTopBidsQueryKey(tournamentId), enabled: !!tournamentId },
  });

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="org-page-content">
        <OrganizerSectionHeader
          tournament={tournament}
          title={<span className="flex items-center gap-2"><BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-primary" /> Reports & Analytics</span>}
          description="Auction performance overview and statistics."
        />

        {/* Summary Stats */}
        {loadingSummary ? (
          <div className="org-stat-grid">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="org-stat-grid">
            <div className="org-kpi-card flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="org-kpi-label">Total Players</p>
                <p className="org-kpi-value">{summary?.totalPlayers || 0}</p>
              </div>
              <div className="org-kpi-icon bg-blue-500/10"><Users className="w-5 h-5 text-blue-500" /></div>
            </div>
            <div className="org-kpi-card flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="org-kpi-label">Sold</p>
                <p className="org-kpi-value text-green-500">{summary?.soldPlayers || 0}</p>
              </div>
              <div className="org-kpi-icon bg-green-500/10"><UserCheck className="w-5 h-5 text-green-500" /></div>
            </div>
            <div className="org-kpi-card flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="org-kpi-label">Total Spent</p>
                <p className="org-kpi-value text-primary">{formatShortIndianRupee(summary?.totalSpent)}</p>
              </div>
              <div className="org-kpi-icon bg-primary/10"><Wallet className="w-5 h-5 text-primary" /></div>
            </div>
            <div className="org-kpi-card flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="org-kpi-label">Highest Bid</p>
                <p className="org-kpi-value text-purple-400">{formatShortIndianRupee(summary?.highestBid)}</p>
              </div>
              <div className="org-kpi-icon bg-purple-500/10"><TrendingUp className="w-5 h-5 text-purple-400" /></div>
            </div>
          </div>
        )}

        {/* Overview Row: Team Purse Breakdown (2 columns) & Top 5 Sold Players (Compact) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Team Purse Breakdown */}
          {teamPurses && teamPurses.length > 0 && (
            <Card className="panel border-none lg:col-span-7 flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs sm:text-sm flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Users className="w-4 h-4 text-primary" /> Team Purse Breakdown
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground font-normal">
                    {teamPurses.length} Teams
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1 flex-1">
                <div className={`grid gap-2.5 ${teamPurses.length > 3 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                  {teamPurses.map(team => {
                    const pct = Math.min(100, (team.purseUsed / team.purse) * 100);
                    return (
                      <div key={team.teamId} className="p-2.5 rounded-xl bg-card/60 border border-border/40 space-y-1.5 shadow-sm">
                        <div className="flex items-center justify-between gap-1.5 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: team.color || "#666" }} />
                            <span className="font-semibold text-xs truncate text-foreground">{team.teamName}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                            {team.playersBought}p
                          </span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                          <span>{formatShortIndianRupee(team.purseUsed)} used</span>
                          <span className="font-mono font-bold" style={{ color: team.color || "#fff" }}>
                            {formatShortIndianRupee(team.purseRemaining)} left
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top 5 Sold Players (Compact) */}
          {topBids && topBids.length > 0 && (
            <Card className="panel border-none lg:col-span-5 flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs sm:text-sm flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Award className="w-4 h-4 text-primary" /> Top 5 Sold Players
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-amber-500/30 text-amber-400 bg-amber-500/10 font-bold">
                    TOP 5
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1 flex-1">
                <div className="space-y-1.5">
                  {topBids.slice(0, 5).map((entry, i) => (
                    <div
                      key={entry.playerId}
                      className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg bg-card/50 border border-border/30 hover:border-border/60 transition"
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center font-display font-black text-[10px] flex-shrink-0"
                        style={{
                          backgroundColor: i === 0 ? "#F59E0B22" : i === 1 ? "#94A3B822" : i === 2 ? "#A855F722" : "#1e293b",
                          color: i === 0 ? "#F59E0B" : i === 1 ? "#94A3B8" : i === 2 ? "#A855F7" : "#888",
                        }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs truncate leading-tight text-foreground">{entry.playerName}</h4>
                        <p className="text-[10px] text-muted-foreground truncate capitalize">
                          {entry.role}{entry.teamName ? ` · ${entry.teamName}` : ""}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-mono font-bold text-primary text-xs leading-tight">
                          {formatShortIndianRupee(entry.soldPrice)}
                        </p>
                        {entry.basePrice && entry.soldPrice > 0 && (
                          <p className="text-[9px] font-mono text-muted-foreground">
                            {Math.round((entry.soldPrice / entry.basePrice) * 10) / 10}x
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ─── Integrated Reports & Posters Center ─────────────────────────── */}
        <div className="pt-6 border-t border-border/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-display text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Reports & Showcase Posters
              </h2>
              <p className="text-xs text-muted-foreground">
                Generate social media squad posters, print official player sheets, and download PDF / Excel / CSV reports for this tournament.
              </p>
            </div>
          </div>

          <ReportCenter tournamentId={tournamentId} hideTournamentSelector={true} />
        </div>
      </div>
    </AppLayout>
  );
}
