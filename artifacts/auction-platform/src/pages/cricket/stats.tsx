/**
 * Cricket Statistics — organizer leaderboards (all categories).
 * Route: /tournament/:id/score/stats
 */
import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import {
  CricketFilterPill,
  CricketOrganizerPageShell,
} from "@/components/scoring/cricket-page-chrome";
import {
  EmptyState,
  HubSectionHeader,
  PageHeader,
} from "@/components/badminton/page-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { LeaderboardTable } from "@/components/scoring/leaderboard-table";
import { getScoringLeaderboard } from "@/lib/scoring-api";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { cricketPublicPath } from "@/lib/tournament-navigation";
import { Trophy } from "lucide-react";
import type { LeaderboardCategory } from "@workspace/scoring-core";

const TABS: { key: LeaderboardCategory; label: string; valueLabel: string }[] = [
  { key: "runs", label: "Runs", valueLabel: "Runs" },
  { key: "wickets", label: "Wickets", valueLabel: "Wkts" },
  { key: "strike_rate", label: "Strike rate", valueLabel: "SR" },
  { key: "economy", label: "Economy", valueLabel: "Econ" },
  { key: "sixes", label: "Sixes", valueLabel: "6s" },
  { key: "fours", label: "Fours", valueLabel: "4s" },
  { key: "catches", label: "Catches", valueLabel: "Ct" },
  { key: "stumpings", label: "Stumpings", valueLabel: "St" },
];

export default function CricketStatsPage() {
  const [, params] = useRoute("/tournament/:id/score/stats");
  const tournamentId = parseInt(params?.id || "0");
  const [tab, setTab] = useState<LeaderboardCategory>("runs");

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const { data: rows, isLoading } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, tab],
    queryFn: () => getScoringLeaderboard(tournamentId, tab, 30),
    enabled: scoringActive && !!tournamentId,
    refetchInterval: 30000,
  });

  const active = TABS.find((t) => t.key === tab);

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Operations"
        title="Statistics"
        subtitle="Tournament leaderboards"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 space-y-6">
        {!scoringActive ? (
          <EmptyState icon={Trophy} title="Cricket scoring is off" desc="Enable scoring to view stats." />
        ) : (
          <>
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

            <HubSectionHeader
              title={active?.label ?? "Leaderboard"}
              subtitle="Top performers this tournament"
            />

            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : (
              <LeaderboardTable
                rows={rows ?? []}
                valueLabel={active?.valueLabel}
                tournamentId={tournamentId}
              />
            )}

            <Link href={cricketPublicPath(tournamentId)} className="text-sm font-semibold text-primary">
              Public fan statistics
            </Link>
          </>
        )}
      </div>
    </CricketOrganizerPageShell>
  );
}
