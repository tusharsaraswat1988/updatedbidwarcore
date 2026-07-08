import { useRoute, useSearch } from "wouter";
import { SideDisplayShell } from "@/components/display/side-display-shell";
import { TournamentCodeGate } from "@/components/tournament-code-gate";
import type { SideLedPanelMode } from "@/components/display/side/SideLedStageContent";

function parsePanelMode(raw: string | null): SideLedPanelMode {
  if (raw === "sponsors" || raw === "sponsor") return "sponsors";
  return "player";
}

/**
 * Side LED panels — fixed 1080×1920 broadcast canvas for venue screens.
 *
 * Production (default): canvas only — no debug UI. Use for live auction / OBS / fullscreen.
 *   /tournament/:id/side-display?panel=sponsors
 *   /tournament/:id/side-display?panel=player
 *
 * Developer mode (?dev=1): preview controls, safe-area guides, theme picker.
 *   ?dev=1&guides=safe,center,grid&scale=fit
 */
export default function SideDisplayView() {
  const [, params] = useRoute("/tournament/:id/side-display");
  const tournamentId = parseInt(params?.id || "0");
  const search = useSearch();
  const paramsObj = new URLSearchParams(search);
  const panel = parsePanelMode(paramsObj.get("panel"));

  return (
    <TournamentCodeGate tournamentId={tournamentId}>
      <SideDisplayShell
        tournamentId={tournamentId}
        panel={panel}
        previewSearch={search}
      />
    </TournamentCodeGate>
  );
}
