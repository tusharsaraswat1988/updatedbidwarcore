import { useMemo } from "react";
import {
  useGetAuctionState,
  useGetTournament,
  getGetAuctionStateQueryKey,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { useAuctionConnectionState } from "@/hooks/use-auction-connection-state";
import { useLedView } from "@/lib/led-view/use-led-view";
import type { DisplayTheme } from "@/lib/display-theme";
import { DISPLAY_THEMES } from "@/lib/display-theme";
import { deriveAuctionDisplayMode } from "@/lib/auction-display-status";
import { useBroadcastAudio } from "./use-broadcast-audio";
import { useDisplayAudioLeader } from "./use-display-audio-leader";
import { AudioUnlockButton } from "./audio-unlock-button";
import { DisplayConnectionBanner } from "./display-connection-banner";
import { DisplayStageViewport } from "./display-stage-viewport";
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

  const lastActivityAt =
    typeof state?.lastAuctionActivityAt === "string" ? state.lastAuctionActivityAt : null;
  const feed = useAuctionConnectionState(connectionStatus, tournamentId, lastActivityAt);

  const resolvedTheme = theme ?? DISPLAY_THEMES["stadium-gold"];

  const displayMode = useMemo(() => deriveAuctionDisplayMode(state), [state]);

  const audioSettings = useMemo<AudioSettings | null>(() => {
    if (!tournament) return null;
    return {
      audioEnabled: tournament.audioEnabled ?? true,
      masterVolume: tournament.masterVolume ?? 80,
      countdownSoundEnabled: tournament.countdownSoundEnabled ?? true,
      countdownSoundUrl: tournament.resolvedCountdownSoundUrl ?? tournament.countdownSoundUrl ?? null,
      countdownSoundVolume: tournament.countdownSoundVolume ?? 70,
      soldSoundEnabled: tournament.soldSoundEnabled ?? true,
      soldSoundUrl: tournament.resolvedSoldSoundUrl ?? tournament.soldSoundUrl ?? null,
      soldSoundVolume: tournament.soldSoundVolume ?? 80,
      breakEndMusicEnabled: tournament.breakEndMusicEnabled ?? false,
      breakEndMusicUrl: tournament.resolvedBreakEndMusicUrl ?? tournament.breakEndMusicUrl ?? null,
      breakEndMusicVolume: tournament.breakEndMusicVolume ?? 80,
    };
  }, [
    tournament?.audioEnabled,
    tournament?.masterVolume,
    tournament?.countdownSoundEnabled,
    tournament?.countdownSoundUrl,
    tournament?.resolvedCountdownSoundUrl,
    tournament?.countdownSoundVolume,
    tournament?.soldSoundEnabled,
    tournament?.soldSoundUrl,
    tournament?.resolvedSoldSoundUrl,
    tournament?.soldSoundVolume,
    tournament?.breakEndMusicEnabled,
    tournament?.breakEndMusicUrl,
    tournament?.resolvedBreakEndMusicUrl,
    tournament?.breakEndMusicVolume,
  ]);

  const soldKey =
    displayMode.phase === "sold"
      ? displayMode.outcome?.action ?? `${state?.soldPlayersCount ?? 0}`
      : "";

  const dc = state?.displayCountdown ?? null;
  const hasDisplayCountdown = dc?.type === "break" || dc?.type === "pre-auction";
  const displayCountdownEndsAt = hasDisplayCountdown ? (dc?.endsAt ?? null) : null;

  const isAudioLeader = useDisplayAudioLeader(tournamentId, "main");

  const { isUnlocked, unlockAudio } = useBroadcastAudio({
    status: displayMode.phase,
    timerEndsAt: state?.timerEndsAt,
    soldKey,
    settings: audioSettings,
    hasDisplayCountdown,
    displayCountdownEndsAt,
    auctionStateReady: !!state,
    isAudioLeader,
  });

  const showSoldOverlay = view.derivedState === "sold" || view.derivedState === "unsold";

  return (
    <DisplayStageViewport>
      <StageThemeProvider initialTheme={resolvedTheme}>
        <LedStageContent view={view} feedState={feed.state} />
        <DevThemePicker anchor="stage" />
      </StageThemeProvider>

      <DisplayConnectionBanner
        feedState={feed.state}
        secondsSinceLastActivity={feed.secondsSinceLastActivity}
      />

      <AudioUnlockButton
        visible={!!audioSettings?.audioEnabled && isAudioLeader && !isUnlocked && !showSoldOverlay}
        onUnlock={unlockAudio}
      />
    </DisplayStageViewport>
  );
}

