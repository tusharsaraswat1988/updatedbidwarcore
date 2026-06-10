import { useMemo } from "react";
import { Volume2 } from "lucide-react";
import {
  useGetAuctionState,
  useGetTournament,
  getGetAuctionStateQueryKey,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { useLedView } from "@/lib/led-view/use-led-view";
import type { DisplayTheme } from "@/lib/display-theme";
import { DISPLAY_THEMES } from "@/lib/display-theme";
import { deriveAuctionDisplayMode } from "@/lib/auction-display-status";
import { useBroadcastAudio } from "./use-broadcast-audio";
import { DisplayConnectionBanner } from "./display-connection-banner";
import { LedStageContent, StageThemeProvider, DevThemePicker } from "./v1";
import type { AudioSettings } from "@/lib/audio-manager";

/**
 * DisplayShell — single owner of realtime auction state for the LED broadcast screen.
 * V1 stadium-gold layout with production SSE + React Query data via useLedView().
 */
export function DisplayShell({
  tournamentId,
  theme,
}: {
  tournamentId: number;
  theme?: DisplayTheme;
}) {
  const { connectionStatus } = useAuctionSocket(tournamentId);
  const view = useLedView(tournamentId, connectionStatus);

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
    },
  });

  const resolvedTheme = theme ?? DISPLAY_THEMES["stadium-gold"];

  const displayMode = useMemo(() => deriveAuctionDisplayMode(state), [state]);

  const audioSettings = useMemo<AudioSettings | null>(() => {
    if (!tournament) return null;
    return {
      audioEnabled: tournament.audioEnabled ?? true,
      masterVolume: tournament.masterVolume ?? 80,
      countdownSoundEnabled: tournament.countdownSoundEnabled ?? true,
      countdownSoundUrl: tournament.countdownSoundUrl ?? null,
      countdownSoundVolume: tournament.countdownSoundVolume ?? 70,
      soldSoundEnabled: tournament.soldSoundEnabled ?? true,
      soldSoundUrl: tournament.soldSoundUrl ?? null,
      soldSoundVolume: tournament.soldSoundVolume ?? 80,
      breakEndMusicEnabled: tournament.breakEndMusicEnabled ?? false,
      breakEndMusicUrl: tournament.breakEndMusicUrl ?? null,
      breakEndMusicVolume: tournament.breakEndMusicVolume ?? 80,
    };
  }, [
    tournament?.audioEnabled,
    tournament?.masterVolume,
    tournament?.countdownSoundEnabled,
    tournament?.countdownSoundUrl,
    tournament?.countdownSoundVolume,
    tournament?.soldSoundEnabled,
    tournament?.soldSoundUrl,
    tournament?.soldSoundVolume,
    tournament?.breakEndMusicEnabled,
    tournament?.breakEndMusicUrl,
    tournament?.breakEndMusicVolume,
  ]);

  const soldKey =
    displayMode.phase === "sold"
      ? displayMode.outcome?.action ?? `${state?.soldPlayersCount ?? 0}`
      : "";

  const dc = state?.displayCountdown ?? null;
  const hasDisplayCountdown = dc?.type === "break" || dc?.type === "pre-auction";
  const displayCountdownEndsAt = hasDisplayCountdown ? (dc?.endsAt ?? null) : null;

  const { isUnlocked } = useBroadcastAudio({
    status: displayMode.phase,
    timerEndsAt: state?.timerEndsAt,
    soldKey,
    settings: audioSettings,
    hasDisplayCountdown,
    displayCountdownEndsAt,
  });

  const showSoldOverlay = view.derivedState === "sold" || view.derivedState === "unsold";
  const isStaleFeed = connectionStatus !== "connected";

  return (
    <div
      className={`fixed inset-0 bg-black overflow-hidden ${
        isStaleFeed ? "ring-2 ring-inset ring-amber-500/25" : ""
      }`}
    >
      <StageThemeProvider initialTheme={resolvedTheme}>
        <LedStageContent view={view} />
        <DevThemePicker />
      </StageThemeProvider>

      <DisplayConnectionBanner status={connectionStatus} />

      {audioSettings?.audioEnabled && !isUnlocked && !showSoldOverlay && (
        <div className="absolute right-5 bottom-5 z-50 flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-full px-3 py-1.5 text-white/50 text-[11px] select-none pointer-events-none backdrop-blur-sm">
          <Volume2 className="w-3 h-3" />
          Click anywhere to enable audio
        </div>
      )}
    </div>
  );
}
