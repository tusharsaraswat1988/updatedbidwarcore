/**
 * Cricket Standings — organizer points table.
 * Route: /tournament/:id/score/standings
 */
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import {
  EmptyState,
  HubSectionHeader,
  PageHeader,
  hubPanelClass,
} from "@/components/badminton/page-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { StandingsTable } from "@/components/scoring/standings-table";
import { getScoringStandings } from "@/lib/scoring-api";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { cricketPublicPath } from "@/lib/tournament-navigation";
import { cricketReportsPath } from "@/lib/cricket-routes";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CricketStandingsPage() {
  const [, params] = useRoute("/tournament/:id/score/standings");
  const tournamentId = parseInt(params?.id || "0");

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const { data: standings, isLoading } = useQuery({
    queryKey: ["scoring-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: scoringActive && !!tournamentId,
    refetchInterval: 30000,
  });

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  const rows = standings ?? [];

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Operations"
        title="Standings"
        subtitle="Tournament table · points then NRR"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 space-y-6">
        {!scoringActive ? (
          <EmptyState icon={Trophy} title="Cricket scoring is off" desc="Enable scoring to view standings." />
        ) : isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          <>
            <div className={cn(hubPanelClass, "text-sm text-muted-foreground space-y-1")}>
              <p>
                <span className="font-semibold text-foreground">Tie-break order:</span> Points → Net Run Rate
              </p>
              <p>
                Teams with fewer points (or equal points and worse NRR) sit below the cut — use this table for qualification decisions.
              </p>
            </div>

            <HubSectionHeader
              title="Points table"
              subtitle={`${rows.length} team${rows.length === 1 ? "" : "s"}`}
            />

            <StandingsTable rows={rows} />

            <div className="flex flex-wrap gap-3 text-sm">
              <a href={cricketPublicPath(tournamentId)} className="text-primary font-semibold">
                Public standings page
              </a>
              <Link href={cricketReportsPath(tournamentId)} className="text-primary font-semibold">
                Export / print
              </Link>
            </div>
          </>
        )}
      </div>
    </CricketOrganizerPageShell>
  );
}
