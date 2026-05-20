import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { DisplayShell } from "@/components/display";
import { TournamentCodeGate } from "@/components/tournament-code-gate";
import { getDisplayTheme } from "@/lib/display-theme";
import type { DisplayTheme } from "@/lib/display-theme";

/**
 * LED broadcast page. Thin route shell — all rendering, realtime data,
 * and animation logic lives inside DisplayShell and the modular
 * /components/display module (see ./components/display/display-shell.tsx
 * for the render-isolation map).
 *
 * Gated behind TournamentCodeGate to prevent IDOR access via sequential IDs.
 *
 * Theme is initially read from the `?theme=` query param (set by the operator
 * panel when clicking "Open Display"). Live theme changes from the operator
 * are received via BroadcastChannel so an already-open display tab updates
 * instantly without a page reload.
 */
export default function DisplayView() {
  const [, params] = useRoute("/tournament/:id/display");
  const tournamentId = parseInt(params?.id || "0");

  const [theme, setTheme] = useState<DisplayTheme>(() => {
    const searchTheme = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("theme")
      : null;
    return getDisplayTheme(searchTheme);
  });

  // Listen for real-time theme changes broadcast from the operator panel.
  // BroadcastChannel is same-origin only and scoped to the tournament ID,
  // so multiple tournaments on the same device don't interfere.
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
      <DisplayShell tournamentId={tournamentId} theme={theme} />
    </TournamentCodeGate>
  );
}
