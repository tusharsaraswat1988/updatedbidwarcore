import { useRoute } from "wouter";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { ScoreDisplayShell } from "@/components/scoring/score-display-shell";
import { TournamentCodeGate } from "@/components/tournament-code-gate";
import { FullscreenLayout } from "@/components/layout";

/** LED / big-screen live cricket scoreboard. Public (auction code gate). */
export default function ScoreDisplayPage() {
  const [, params] = useRoute("/tournament/:id/score-display");
  const tournamentId = parseInt(params?.id || "0");

  const { data: tournament, isLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const scoringActive = tournament?.sport === "cricket" && tournament?.scoringEnabled === true;

  if (isLoading) {
    return (
      <FullscreenLayout>
        <div className="min-h-screen bg-[#070b14] text-white flex items-center justify-center">
          <p className="text-white/50">Loading…</p>
        </div>
      </FullscreenLayout>
    );
  }

  if (!scoringActive) {
    return (
      <FullscreenLayout>
        <div className="min-h-screen bg-[#070b14] text-white flex items-center justify-center px-6">
          <p className="text-white/60 text-center">This page is not available for this tournament.</p>
        </div>
      </FullscreenLayout>
    );
  }

  return (
    <TournamentCodeGate tournamentId={tournamentId}>
      <ScoreDisplayShell tournamentId={tournamentId} />
    </TournamentCodeGate>
  );
}
