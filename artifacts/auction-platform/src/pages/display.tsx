import { useRoute } from "wouter";
import { DisplayShell } from "@/components/display";
import { TournamentCodeGate } from "@/components/tournament-code-gate";
import { getDisplayTheme } from "@/lib/display-theme";

/**
 * LED broadcast page. Thin route shell — all rendering, realtime data,
 * and animation logic lives inside DisplayShell and the modular
 * /components/display module (see ./components/display/display-shell.tsx
 * for the render-isolation map).
 *
 * Gated behind TournamentCodeGate to prevent IDOR access via sequential IDs.
 *
 * Theme is read from the `?theme=` query param (set by the operator panel).
 * It is stable for the lifetime of the display session and never changes
 * during an auction — so it does not affect any realtime render paths.
 */
export default function DisplayView() {
  const [, params] = useRoute("/tournament/:id/display");
  const tournamentId = parseInt(params?.id || "0");

  const searchTheme = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("theme")
    : null;
  const theme = getDisplayTheme(searchTheme);

  return (
    <TournamentCodeGate tournamentId={tournamentId}>
      <DisplayShell tournamentId={tournamentId} theme={theme} />
    </TournamentCodeGate>
  );
}
