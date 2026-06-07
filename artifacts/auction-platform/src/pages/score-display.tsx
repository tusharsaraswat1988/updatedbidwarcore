import { useRoute } from "wouter";
import { ScoreDisplayShell } from "@/components/scoring/score-display-shell";
import { TournamentCodeGate } from "@/components/tournament-code-gate";

/** LED / big-screen live cricket scoreboard. Public (auction code gate). */
export default function ScoreDisplayPage() {
  const [, params] = useRoute("/tournament/:id/score-display");
  const tournamentId = parseInt(params?.id || "0");

  return (
    <TournamentCodeGate tournamentId={tournamentId}>
      <ScoreDisplayShell tournamentId={tournamentId} />
    </TournamentCodeGate>
  );
}
