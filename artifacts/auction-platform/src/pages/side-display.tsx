import { useRoute, useSearch } from "wouter";
import { SideDisplayShell } from "@/components/display/side-display-shell";
import { TournamentCodeGate } from "@/components/tournament-code-gate";
import type { SideLedPanelMode } from "@/components/display/side/SideLedStageContent";

function parsePanelMode(raw: string | null): SideLedPanelMode {
  if (raw === "sponsors" || raw === "sponsor") return "sponsors";
  return "player";
}

/**
 * Side LED panels for venue flanking screens — portrait or landscape.
 * ?panel=sponsors  → professional sponsor carousel (left/right screen)
 * ?panel=player    → live player full profile (default)
 *
 * Uses the same auction API as the main LED display but ignores operator
 * overlay switches (player list, team squads, top 5, banner, purse view).
 *
 * Colour theme is chosen on the live display via the bottom-left stage picker.
 */
export default function SideDisplayView() {
  const [, params] = useRoute("/tournament/:id/side-display");
  const tournamentId = parseInt(params?.id || "0");
  const search = useSearch();
  const panel = parsePanelMode(new URLSearchParams(search).get("panel"));

  return (
    <TournamentCodeGate tournamentId={tournamentId}>
      <SideDisplayShell tournamentId={tournamentId} panel={panel} />
    </TournamentCodeGate>
  );
}
