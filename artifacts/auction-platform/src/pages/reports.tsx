import { useRoute } from "wouter";
import {
  useGetTournamentSummary,
  useGetTournament,
  useGetTeamPurses,
  useGetTopBids,
  useGetCategoryBreakdown,
  getGetTournamentSummaryQueryKey,
  getGetTournamentQueryKey,
  getGetTeamPursesQueryKey,
  getGetTopBidsQueryKey,
  getGetCategoryBreakdownQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { OrganizerSectionHeader } from "@/components/organizer-page-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import { Users, Wallet, TrendingUp, BarChart3, UserCheck, Award } from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export default function Reports() {
  const [, params] = useRoute("/tournament/:id/reports");
  const tournamentId = parseInt(params?.id || "0");

  const { data: summary, isLoading: loadingSummary } = useGetTournamentSummary(tournamentId, {
    query: { queryKey: getGetTournamentSummaryQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: teamPurses, isLoading: loadingPurses } = useGetTeamPurses(tournamentId, {
    query: { queryKey: getGetTeamPursesQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: topBids } = useGetTopBids(tournamentId, {
    query: { queryKey: getGetTopBidsQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: categoryBreakdown } = useGetCategoryBreakdown(tournamentId, {
    query: { queryKey: getGetCategoryBreakdownQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const purseChartData = (teamPurses || []).map(t => ({
    name: t.shortCode,
    Spent: t.purseUsed,
    Remaining: t.purseRemaining,
    color: t.color || "#666",
  }));

  const catPieData = (categoryBreakdown || [])
    .filter(c => c.sold > 0)
    .map(c => ({ name: c.categoryName, value: c.sold, color: c.colorCode || "#666" }));

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-8">
        <OrganizerSectionHeader
          tournament={tournament}
          title={<span className="flex items-center gap-3"><BarChart3 className="w-8 h-8 text-primary" /> Reports & Analytics</span>}
          description="Auction performance overview and statistics."
        />

        {/* Summary Stats */}
        {loadingSummary ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-border">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Players</p>
                    <p className="text-3xl font-display font-bold">{summary?.totalPlayers || 0}</p>
                  </div>
                  <div className="p-2 bg-blue-500/10 rounded-lg"><Users className="w-4 h-4 text-blue-500" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Sold</p>
                    <p className="text-3xl font-display font-bold text-green-500">{summary?.soldPlayers || 0}</p>
                  </div>
                  <div className="p-2 bg-green-500/10 rounded-lg"><UserCheck className="w-4 h-4 text-green-500" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Spent</p>
                    <p className="text-3xl font-display font-bold text-primary">{formatShortIndianRupee(summary?.totalSpent)}</p>
                  </div>
                  <div className="p-2 bg-primary/10 rounded-lg"><Wallet className="w-4 h-4 text-primary" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Highest Bid</p>
                    <p className="text-3xl font-display font-bold text-purple-400">{formatShortIndianRupee(summary?.highestBid)}</p>
                  </div>
                  <div className="p-2 bg-purple-500/10 rounded-lg"><TrendingUp className="w-4 h-4 text-purple-400" /></div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" /> Team Purse Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPurses ? <Skeleton className="h-48" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={purseChartData} barSize={24}>
                    <XAxis dataKey="name" tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`}
                      tick={{ fill: "#888", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) => formatIndianRupee(value)}
                      contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
                    />
                    <Bar dataKey="Spent" stackId="a" fill="#F59E0B" radius={[0,0,0,0]} />
                    <Bar dataKey="Remaining" stackId="a" fill="#1e293b" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Sold by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              {catPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={catPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, value }) => `${name} (${value})`}
                      labelLine={false}
                    >
                      {catPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Team Purse Detail Table */}
        {teamPurses && teamPurses.length > 0 && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Team Purse Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {teamPurses.map(team => {
                const pct = Math.min(100, (team.purseUsed / team.purse) * 100);
                return (
                  <div key={team.teamId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: team.color || "#666" }} />
                        <span className="font-semibold">{team.teamName}</span>
                        <span className="text-muted-foreground text-xs">{team.playersBought} players</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">{formatShortIndianRupee(team.purseUsed)} used</span>
                        <span className="font-mono font-bold" style={{ color: team.color || "#fff" }}>
                          {formatShortIndianRupee(team.purseRemaining)} left
                        </span>
                      </div>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Top Bids */}
        {topBids && topBids.length > 0 && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" /> Top Sold Players
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topBids.map((entry, i) => (
                  <div key={entry.playerId} className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0"
                      style={{
                        backgroundColor: i === 0 ? "#F59E0B22" : i === 1 ? "#94A3B822" : i === 2 ? "#A855F722" : "#1e293b",
                        color: i === 0 ? "#F59E0B" : i === 1 ? "#94A3B8" : i === 2 ? "#A855F7" : "#666",
                      }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate">{entry.playerName}</h4>
                      <p className="text-xs text-muted-foreground capitalize">
                        {entry.role}{entry.categoryName ? ` · ${entry.categoryName}` : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono font-bold text-primary">{formatIndianRupee(entry.soldPrice)}</p>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        {entry.teamColor && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.teamColor }} />}
                        <p className="text-xs text-muted-foreground">{entry.teamName}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      {Math.round((entry.soldPrice / entry.basePrice) * 10) / 10}x
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
