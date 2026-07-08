import { useEffect, useMemo } from "react";
import {
  useGetAuctionState,
  useGetTournament,
  getGetAuctionStateQueryKey,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { useAuctionConnectionState } from "@/hooks/use-auction-connection-state";
import { useSideLedView } from "@/lib/led-view/use-side-led-view";
import type { DisplayTheme } from "@/lib/display-theme";
import { DISPLAY_THEMES } from "@/lib/display-theme";
import { deriveAuctionDisplayMode } from "@/lib/auction-display-status";
import {
  isDeveloperMode,
  parseBroadcastCanvasPreview,
} from "@/lib/broadcast-canvas/preview-mode";
import { useBroadcastAudio } from "./use-broadcast-audio";
import { useDisplayAudioLeader } from "./use-display-audio-leader";
import { AudioUnlockButton } from "./audio-unlock-button";
import { DisplayConnectionBanner } from "./display-connection-banner";
import { StageThemeProvider } from "./v1";
import {
  SideLedStageContent,
  type SideLedPanelMode,
} from "./side/SideLedStageContent";
import {
  BroadcastCanvasProvider,
  DisplayViewport,
  DisplayPreviewControls,
} from "./broadcast-canvas";
import type { AudioSettings } from "@/lib/audio-manager";
import { resolveBroadcastAudioUrls } from "@workspace/api-base/platform-audio";
import type { PlatformAudioDefaults } from "@workspace/api-base/platform-audio";
import { loadDisplayFonts } from "@/lib/load-display-fonts";
import { BootSplash } from "@/components/boot-splash";
import { resolveReconnectStandby } from "./display-reconnect-standby";

/**
 * Side LED display shell — fixed 1080×1920 broadcast canvas scaled to viewport.
 * Player and sponsor scenes share the same scaling engine; each scene keeps its own layout.
 */
export function SideDisplayShell({
  tournamentId,
  theme,
  panel,
  previewSearch = "",
}: {
  tournamentId: number;
  theme?: DisplayTheme;
  panel: SideLedPanelMode;
  previewSearch?: string;
}) {
  useEffect(() => {
    loadDisplayFonts();
  }, []);

  const initialPreview = useMemo(
    () => parseBroadcastCanvasPreview(previewSearch),
    [previewSearch],
  );

  const { connectionStatus } = useAuctionSocket(tournamentId);
  const view = useSideLedView(tournamentId, connectionStatus);

  const { data: tournament } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: !!tournamentId,
      staleTime: 5 * 60 * 1000,
    },
  });

  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
    },
  });

  const lastActivityAt =
    typeof (state as { lastAuctionActivityAt?: string } | undefined)?.lastAuctionActivityAt === "string"
      ? (state as { lastAuctionActivityAt: string }).lastAuctionActivityAt
      : null;
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
  }, [tournament]);

  const soldKey =
    view.derivedState === "sold" || view.derivedState === "unsold"
      ? displayMode.outcome?.action ?? `${state?.soldPlayersCount ?? 0}`
      : "";

  const dc = state?.displayCountdown ?? null;
  const displayCountdownType = dc?.type;
  const displayCountdownEndsAt =
    dc?.type === "break" || dc?.type === "pre-auction" ? (dc?.endsAt ?? null) : null;
  const displayCountdownMusicMuted = (dc as { musicMuted?: boolean } | null)?.musicMuted === true;

  const isAudioLeader = useDisplayAudioLeader(tournamentId, "side");

  const { isUnlocked, unlockAudio } = useBroadcastAudio({
    status: view.derivedState === "sold" ? "sold" : view.derivedState === "unsold" ? "unsold" : displayMode.phase,
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
    <BroadcastCanvasProvider initialPreview={initialPreview}>
      <DisplayViewport>
        <StageThemeProvider initialTheme={resolvedTheme}>
          <SideLedStageContent view={view} panel={panel} tournamentId={tournamentId} />
        </StageThemeProvider>
      </DisplayViewport>

      {isDeveloperMode(initialPreview) ? (
        <>
          <DisplayConnectionBanner
            feedState={feed.state}
            secondsSinceLastActivity={feed.secondsSinceLastActivity}
          />
          <AudioUnlockButton
            visible={!!audioSettings?.audioEnabled && isAudioLeader && !isUnlocked && !showSoldOverlay}
            onUnlock={unlockAudio}
          />
          <DisplayPreviewControls />
        </>
      ) : null}
    </BroadcastCanvasProvider>
  );
}
