import { memo, useMemo } from "react";
import type { AuctionState, Player, TeamPurse } from "@workspace/api-client-react";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import { BROADCAST_OVERLAY_HEIGHT, BROADCAST_OVERLAY_WIDTH } from "@/lib/broadcast-overlay";
import { BIDWAR_BROADCAST_YELLOW } from "@/lib/bidwar-broadcast-colors";
import { BroadcastOverlayTopBar } from "@/components/display/broadcast-overlay-top-bar";
import { DisplayConnectionBanner } from "@/components/display/display-connection-banner";
import { SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX, SponsorTicker } from "@/components/display/sponsor-ticker";
import type { AuctionFeedState } from "@/hooks/use-auction-connection-state";
import { useBroadcastDirector } from "./use-broadcast-director";
import type { BroadcastOutputTarget, BroadcastSettings } from "./types";
import {
  buildTeamTickerRows,
  computeBottomStackHeight,
  ObsLowerThirdScene,
} from "./obs/obs-lower-third-scene";
import { TeamTicker } from "./obs/team-ticker";

export type BroadcastLayoutProps = {
  tournamentId: number;
  outputTarget?: BroadcastOutputTarget;
  tournamentName: string | null;
  tournamentLogoUrl: string | null;
  auctionStartsAt?: string | null;
  sponsorLogos: SponsorLogo[];
  state: AuctionState | undefined;
  teamPurses: TeamPurse[] | undefined;
  soldPlayers?: Player[] | undefined;
  settings: BroadcastSettings;
  isObsMode: boolean;
  formatAmount: (n: number) => string;
  feedState: AuctionFeedState;
  secondsSinceLastActivity: number | null;
  isStaleFeed: boolean;
};

/**
 * OBS broadcast layout — transparent 1920×1080 canvas with lower-third overlay only.
 * BroadcastDirector drives scene data; presentation stays in the bottom band + top chrome.
 */
export const BroadcastLayout = memo(function BroadcastLayout(props: BroadcastLayoutProps) {
  const frame = useBroadcastDirector({
    tournamentId: props.tournamentId,
    outputTarget: props.outputTarget ?? "obs",
    state: props.state,
    teamPurses: props.teamPurses,
    soldPlayers: props.soldPlayers,
    tournament: undefined,
    tournamentName: props.tournamentName,
    tournamentLogoUrl: props.tournamentLogoUrl,
    auctionStartsAt: props.auctionStartsAt ?? null,
    sponsorLogos: props.sponsorLogos,
    settings: props.settings,
    isObsMode: props.isObsMode,
    isStaleFeed: props.isStaleFeed,
    formatAmount: props.formatAmount,
  });

  const teams = useMemo(() => buildTeamTickerRows(props.teamPurses), [props.teamPurses]);
  const bottomStackHeight = computeBottomStackHeight(teams.length);
  const showTeamTicker = teams.length > 0 && frame.sceneId !== "SOLD" && frame.sceneId !== "UNSOLD";
  const themeAccent = frame.palette.accent || BIDWAR_BROADCAST_YELLOW;

  return (
    <div
      data-broadcast-overlay-root
      data-broadcast-scene={frame.sceneId}
      data-broadcast-context={frame.currentContext}
      data-broadcast-output={frame.outputTarget}
      style={{
        background: "transparent",
        width: `${BROADCAST_OVERLAY_WIDTH}px`,
        height: `${BROADCAST_OVERLAY_HEIGHT}px`,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        outline: props.isStaleFeed ? "4px solid rgba(245,158,11,0.35)" : undefined,
        outlineOffset: -4,
        opacity: props.isStaleFeed ? 0.95 : 1,
        transition: "opacity 0.3s ease",
      }}
    >
      {frame.chrome.showConnectionBanner && (
        <DisplayConnectionBanner
          feedState={props.feedState}
          secondsSinceLastActivity={props.secondsSinceLastActivity}
        />
      )}

      <BroadcastOverlayTopBar
        tournamentLogoUrl={props.tournamentLogoUrl}
        tournamentName={props.tournamentName}
        sponsorLogos={props.sponsorLogos}
      />

      <ObsLowerThirdScene
        frame={frame}
        state={props.state}
        teamPurses={props.teamPurses}
        formatAmount={props.formatAmount}
        tournamentName={props.tournamentName}
        bottomStackHeight={bottomStackHeight}
      />

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 25 }}>
        <SponsorTicker
          logos={props.sponsorLogos}
          themeAccent={themeAccent}
          includePoweredByBidWar
          overlay
        />
      </div>

      {showTeamTicker && (
        <div
          style={{
            position: "absolute",
            bottom: SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX,
            left: 0,
            right: 0,
            zIndex: 22,
          }}
        >
          <TeamTicker teams={teams} />
        </div>
      )}

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
});
