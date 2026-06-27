import { useMemo } from "react";
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
import { useBroadcastAudio } from "./use-broadcast-audio";
import { useDisplayAudioLeader } from "./use-display-audio-leader";
import { AudioUnlockButton } from "./audio-unlock-button";
import { DisplayConnectionBanner } from "./display-connection-banner";
import { StageThemeProvider, DevThemePicker } from "./v1";
import {
  SideLedStageContent,
  type SideLedPanelMode,
} from "./side/SideLedStageContent";
import type { AudioSettings } from "@/lib/audio-manager";

/**
 * Side LED display shell — same realtime API as main display,
 * but fixed to sponsors OR player profile and immune to operator overlay switches.
 */
export function SideDisplayShell({
  tournamentId,
  theme,
  panel,
}: {
  tournamentId: number;
  theme?: DisplayTheme;
  panel: SideLedPanelMode;
}) {
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
    view.derivedState === "sold" || view.derivedState === "unsold"
      ? displayMode.outcome?.action ?? `${state?.soldPlayersCount ?? 0}`
      : "";

  const dc = state?.displayCountdown ?? null;
  const hasDisplayCountdown = dc?.type === "break" || dc?.type === "pre-auction";
  const displayCountdownEndsAt = hasDisplayCountdown ? (dc?.endsAt ?? null) : null;

  const isAudioLeader = useDisplayAudioLeader(tournamentId, "side");

  const { isUnlocked, unlockAudio } = useBroadcastAudio({
    status: view.derivedState === "sold" ? "sold" : view.derivedState === "unsold" ? "unsold" : displayMode.phase,
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
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div className="relative h-full w-full">
        <StageThemeProvider initialTheme={resolvedTheme}>
          <SideLedStageContent view={view} panel={panel} feedState={feed.state} tournamentId={tournamentId} />
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
      </div>
    </div>
  );
}

