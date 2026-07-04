import { useEffect, useMemo } from "react";
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
import { LedStageContent, StageThemeProvider } from "./v1";
import { BootSplash } from "@/components/boot-splash";
import { resolveReconnectStandby } from "./display-reconnect-standby";
import type { AudioSettings } from "@/lib/audio-manager";
import { resolveBroadcastAudioUrls } from "@workspace/api-base/platform-audio";
import type { PlatformAudioDefaults } from "@workspace/api-base/platform-audio";
import { loadDisplayFonts } from "@/lib/load-display-fonts";

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
  useEffect(() => {
    loadDisplayFonts();
  }, []);

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
    const platform = (tournament as { platformAudioDefaults?: PlatformAudioDefaults }).platformAudioDefaults;
    const resolved = resolveBroadcastAudioUrls(
      {
        countdownSoundUrl:
          (tournament as { resolvedCountdownSoundUrl?: string | null }).resolvedCountdownSoundUrl
          ?? tournament.countdownSoundUrl,
        soldSoundUrl:
          (tournament as { resolvedSoldSoundUrl?: string | null }).resolvedSoldSoundUrl
          ?? tournament.soldSoundUrl,
        breakEndMusicUrl:
          (tournament as { resolvedBreakEndMusicUrl?: string | null }).resolvedBreakEndMusicUrl
          ?? tournament.breakEndMusicUrl,
      },
      platform ?? {
        countdownSoundUrl: null,
        soldSoundUrl: null,
        breakEndMusicUrl: null,
      },
    );
    return {
      audioEnabled: tournament.audioEnabled ?? true,
      masterVolume: tournament.masterVolume ?? 80,
      countdownSoundEnabled: tournament.countdownSoundEnabled ?? true,
      countdownSoundUrl: resolved.countdownSoundUrl,
      countdownSoundVolume: tournament.countdownSoundVolume ?? 70,
      soldSoundEnabled: tournament.soldSoundEnabled ?? true,
      soldSoundUrl: resolved.soldSoundUrl,
      soldSoundVolume: tournament.soldSoundVolume ?? 80,
      breakEndMusicEnabled: tournament.breakEndMusicEnabled ?? false,
      breakEndMusicUrl: resolved.breakEndMusicUrl,
      breakEndMusicVolume: tournament.breakEndMusicVolume ?? 80,
    };
  }, [
    tournament,
  ]);

  const soldKey =
    displayMode.phase === "sold"
      ? displayMode.outcome?.action ?? `${state?.soldPlayersCount ?? 0}`
      : "";

  const dc = state?.displayCountdown ?? null;
  const displayCountdownType = dc?.type;
  const displayCountdownEndsAt =
    dc?.type === "break" || dc?.type === "pre-auction" ? (dc?.endsAt ?? null) : null;
  const displayCountdownMusicMuted = dc?.musicMuted === true;

  const isAudioLeader = useDisplayAudioLeader(tournamentId, "main");

  const { isUnlocked, unlockAudio } = useBroadcastAudio({
    status: displayMode.phase,
    timerEndsAt: state?.timerEndsAt,
    soldKey,
    currentPlayerId: state?.currentPlayer?.id ?? null,
    settings: audioSettings,
    displayCountdownType,
    displayCountdownEndsAt,
    displayCountdownMusicMuted,
    auctionStateReady: !!state,
    isAudioLeader,
  });

  const showSoldOverlay = view.derivedState === "sold" || view.derivedState === "unsold";
  const standby = resolveReconnectStandby(view, feed.state);

  if (standby) {
    return <BootSplash />;
  }

  return (
    <DisplayStageViewport>
      <StageThemeProvider initialTheme={resolvedTheme}>
        <LedStageContent view={view} />
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

