import { useRoute } from "wouter";
import { DisplayShell } from "@/components/display";
import { TournamentCodeGate } from "@/components/tournament-code-gate";

/**
 * LED broadcast page. Thin route shell — all rendering, realtime data,
 * and animation logic lives inside DisplayShell and the modular
 * /components/display module (see ./components/display/display-shell.tsx
 * for the render-isolation map).
 *
 * Gated behind TournamentCodeGate to prevent IDOR access via sequential IDs.
 */
export default function DisplayView() {
  const [, params] = useRoute("/tournament/:id/display");
  const tournamentId = parseInt(params?.id || "0");
  return (
    <TournamentCodeGate tournamentId={tournamentId}>
      <DisplayShell tournamentId={tournamentId} />
    </TournamentCodeGate>
  );
}
