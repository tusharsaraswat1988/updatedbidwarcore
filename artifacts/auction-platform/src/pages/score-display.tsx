import { useRoute } from "wouter";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { BootSplash } from "@/components/boot-splash";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { ScoreDisplayShell } from "@/components/scoring/score-display-shell";
import { TournamentCodeGate } from "@/components/tournament-code-gate";
import { FullscreenLayout } from "@/components/fullscreen-layout";

/** LED / big-screen live cricket scoreboard. Public (auction code gate). */
export default function ScoreDisplayPage() {
  const [, params] = useRoute("/tournament/:id/score-display");
  const tournamentId = parseInt(params?.id || "0");

  const { data: tournament, isLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  if (isLoading) {
    return (
      <FullscreenLayout>
        <BootSplash label="Loading Scoreboard..." />
      </FullscreenLayout>
    );
  }

  if (!scoringActive) {
    return (
      <FullscreenLayout>
        <div className="lovable-theme dark min-h-screen bg-background text-foreground flex items-center justify-center px-6">
          <p className="text-white/60 text-center">This page is not available for this tournament.</p>
        </div>
      </FullscreenLayout>
    );
  }

  return (
    <TournamentCodeGate tournamentId={tournamentId} requiredModule="scoring">
      <ScoreDisplayShell tournamentId={tournamentId} />
    </TournamentCodeGate>
  );
}
