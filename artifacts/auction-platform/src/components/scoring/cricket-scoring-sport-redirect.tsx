import { Redirect } from "wouter";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { badmintonHubPath } from "@/lib/badminton-routes";

/**
 * Cricket `/score*` routes are cricket-only. Badminton tournaments that land here
 * (e.g. old bookmarks or sport-agnostic entry URLs) go to the badminton hub.
 */
export function CricketScoringSportRedirect({
  tournamentId,
  sport,
}: {
  tournamentId: number;
  sport: string | undefined;
}) {
  if (sport === "badminton") {
    return <Redirect to={badmintonHubPath(tournamentId)} replace />;
  }
  return null;
}

/** Resolves `/tournament/:id` in the scoring app to the sport-correct home. */
export function ScoringAppTournamentHomeRedirect({
  tournamentId,
}: {
  tournamentId: number;
}) {
  const { data: tournament, isLoading, isError } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: !!tournamentId,
    },
  });

  if (!tournamentId || isError) {
    return <Redirect to={`/tournament/${tournamentId || 0}/score`} replace />;
  }

  if (isLoading || !tournament) {
    return (
      <div
        className="min-h-screen bg-background"
        aria-busy="true"
        aria-label="Loading tournament"
      />
    );
  }

  if (tournament.sport === "badminton") {
    return <Redirect to={badmintonHubPath(tournamentId)} replace />;
  }

  return <Redirect to={`/tournament/${tournamentId}/score`} replace />;
}
