/**
 * Compatibility route: `/tournament/:id`
 *
 * No standalone Tournament Home page in the Auction module. This route resolves
 * the tournament's enabled modules and redirects to the appropriate landing:
 * - Auction enabled → Auction Overview
 * - Scoring only → sport-specific scoring entry (then scoring-app shell)
 * - Neither → Tournament Settings
 */
import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveTournamentOrganizerLandingPath } from "@/lib/tournament-navigation";

export default function TournamentHome() {
  const [, params] = useRoute("/tournament/:id");
  const [, navigate] = useLocation();
  const tournamentId = parseInt(params?.id || "0");

  const { data: tournament, isLoading, isError } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: !!tournamentId,
    },
  });

  useEffect(() => {
    if (!tournamentId || isLoading || isError) return;
    const target = resolveTournamentOrganizerLandingPath(tournamentId, tournament);
    navigate(target, { replace: true });
  }, [tournamentId, tournament, isLoading, isError, navigate]);

  return (
    <div
      className="min-h-[40vh] flex items-center justify-center p-8"
      aria-busy="true"
      aria-label="Loading tournament"
      data-testid="tournament-root-redirect"
    >
      <Skeleton className="h-8 w-64" />
    </div>
  );
}
