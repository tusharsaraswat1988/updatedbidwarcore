import { useEffect, useState } from "react";
import { useRoute, useSearch } from "wouter";
import { SideDisplayShell } from "@/components/display/side-display-shell";
import { TournamentCodeGate } from "@/components/tournament-code-gate";
import { getDisplayTheme } from "@/lib/display-theme";
import type { DisplayTheme } from "@/lib/display-theme";
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
 */
export default function SideDisplayView() {
  const [, params] = useRoute("/tournament/:id/side-display");
  const tournamentId = parseInt(params?.id || "0");
  const search = useSearch();
  const panel = parsePanelMode(new URLSearchParams(search).get("panel"));

  const [theme, setTheme] = useState<DisplayTheme>(() => {
    const searchTheme = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("theme")
      : null;
    return getDisplayTheme(searchTheme);
  });

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("bidwar_display_theme");
    const handler = (ev: MessageEvent) => {
      if (ev.data?.tournamentId === tournamentId && ev.data?.theme) {
        setTheme(getDisplayTheme(ev.data.theme));
      }
    };
    ch.addEventListener("message", handler);
    return () => {
      ch.removeEventListener("message", handler);
      ch.close();
    };
  }, [tournamentId]);

  return (
    <TournamentCodeGate tournamentId={tournamentId}>
      <SideDisplayShell tournamentId={tournamentId} theme={theme} panel={panel} />
    </TournamentCodeGate>
  );
}
