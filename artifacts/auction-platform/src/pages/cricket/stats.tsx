/**
 * Cricket Statistics — organizer leaderboards (all categories).
 * Route: /tournament/:id/score/stats
 */
import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import {
  CricketFilterPill,
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
import { LeaderboardTable } from "@/components/scoring/leaderboard-table";
import { getScoringLeaderboard } from "@/lib/scoring-api";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import {
  cricketFanStatisticsPath,
  cricketPublicPath,
} from "@/lib/tournament-navigation";
import {
  Award,
  BarChart3,
  ExternalLink,
  Flame,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import type { LeaderboardCategory } from "@workspace/scoring-core";
import { cn } from "@/lib/utils";

const TABS: { key: LeaderboardCategory; label: string; valueLabel: string; icon?: typeof Flame }[] = [
  { key: "runs", label: "Runs", valueLabel: "Runs", icon: Trophy },
  { key: "wickets", label: "Wickets", valueLabel: "Wkts", icon: Target },
  { key: "strike_rate", label: "Strike rate", valueLabel: "SR", icon: Zap },
  { key: "economy", label: "Economy", valueLabel: "Econ", icon: Award },
  { key: "sixes", label: "Sixes", valueLabel: "6s", icon: Flame },
  { key: "fours", label: "Fours", valueLabel: "4s", icon: Sparkles },
  { key: "catches", label: "Catches", valueLabel: "Ct", icon: Award },
  { key: "stumpings", label: "Stumpings", valueLabel: "St", icon: Award },
];

export default function CricketStatsPage() {
  const [, params] = useRoute("/tournament/:id/score/stats");
  const tournamentId = parseInt(params?.id || "0");
  const [tab, setTab] = useState<LeaderboardCategory>("runs");

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);

  const { data: rows, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, tab],
    queryFn: () => getScoringLeaderboard(tournamentId, tab, 30),
    enabled: scoringActive && !!tournamentId,
    refetchInterval: 30000,
  });

  // Top metric previews for KPI summary
  const { data: topRuns } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, "runs"],
    queryFn: () => getScoringLeaderboard(tournamentId, "runs", 1),
    enabled: scoringActive && !!tournamentId,
  });
  const { data: topWickets } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, "wickets"],
    queryFn: () => getScoringLeaderboard(tournamentId, "wickets", 1),
    enabled: scoringActive && !!tournamentId,
  });
  const { data: topSixes } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, "sixes"],
    queryFn: () => getScoringLeaderboard(tournamentId, "sixes", 1),
    enabled: scoringActive && !!tournamentId,
  });
  const { data: topSR } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, "strike_rate"],
    queryFn: () => getScoringLeaderboard(tournamentId, "strike_rate", 1),
    enabled: scoringActive && !!tournamentId,
  });

  const active = TABS.find((t) => t.key === tab);

  const publicFanStatsUrl = cricketPublicPath(tournamentId);

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Operations"
        title="Statistics & Leaderboards"
        subtitle={tournament?.name ?? "Tournament batting, bowling and fielding leaderboards"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BtnSecondary
              className={btnCompactClass}
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
              Refresh
            </BtnSecondary>
            <BtnSecondary
              href={publicFanStatsUrl}
              external
              className={btnCompactClass}
            >
              <ExternalLink className="w-4 h-4" />
              Public Fan Stats
            </BtnSecondary>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 space-y-6">
        {tournamentLoading || (scoringActive && isLoading && !rows) ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : !scoringActive ? (
          <EmptyState
            icon={Trophy}
            title="Cricket scoring is off"
            desc="Enable scoring for this tournament to view leaderboards and player statistics."
          />
        ) : (
          <>
            {/* Top Key Leader KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <HubKpiCard
                label="Top Run Scorer"
                value={topRuns?.[0]?.value ?? "—"}
                subtitle={topRuns?.[0]?.playerName ? `${topRuns[0].playerName} (${topRuns[0].shortCode || "Team"})` : "No stats yet"}
                icon={Trophy}
                tint="primary"
              />
              <HubKpiCard
                label="Leading Wicket Taker"
                value={topWickets?.[0]?.value ?? "—"}
                subtitle={topWickets?.[0]?.playerName ? `${topWickets[0].playerName} (${topWickets[0].shortCode || "Team"})` : "No stats yet"}
                icon={Target}
                tint="green"
              />
              <HubKpiCard
                label="Most Sixes"
                value={topSixes?.[0]?.value ?? "—"}
                subtitle={topSixes?.[0]?.playerName ? `${topSixes[0].playerName} (${topSixes[0].shortCode || "Team"})` : "No stats yet"}
                icon={Flame}
                tint="red"
              />
              <HubKpiCard
                label="Best Strike Rate"
                value={topSR?.[0]?.value ?? "—"}
                subtitle={topSR?.[0]?.playerName ? `${topSR[0].playerName} (${topSR[0].shortCode || "Team"})` : "No stats yet"}
                icon={Zap}
                tint="muted"
              />
            </div>

            {/* Category Filter Pills */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Stat Category
                </span>
                <span className="text-xs text-muted-foreground">
                  Auto-updates from official match scorecards
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {TABS.map((t) => (
                  <CricketFilterPill
                    key={t.key}
                    active={tab === t.key}
                    onClick={() => setTab(t.key)}
                  >
                    {t.label}
                  </CricketFilterPill>
                ))}
              </div>
            </section>

            {/* Leaderboard Table Container */}
            <section className={cn(hubCardClass, "p-4 sm:p-6 space-y-4")}>
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
                <HubSectionHeader
                  title={`${active?.label ?? "Leaderboard"} Leaders`}
                  subtitle={`Top 30 performers in ${active?.label?.toLowerCase() ?? "category"}`}
                />
              </div>

              {isLoading ? (
                <Skeleton className="h-64 w-full rounded-xl" />
              ) : (
                <LeaderboardTable
                  rows={rows ?? []}
                  valueLabel={active?.valueLabel}
                  tournamentId={tournamentId}
                />
              )}
            </section>
          </>
        )}
      </div>
    </CricketOrganizerPageShell>
  );
}
