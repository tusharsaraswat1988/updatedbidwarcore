import { memo, useMemo } from "react";
import type { AuctionState, Player, TeamPurse } from "@workspace/api-client-react";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import { BROADCAST_OVERLAY_HEIGHT, BROADCAST_OVERLAY_WIDTH } from "@/lib/broadcast-overlay";
import { DisplayConnectionBanner } from "@/components/display/display-connection-banner";
import type { AuctionFeedState } from "@/hooks/use-auction-connection-state";
import { useBroadcastDirector } from "./use-broadcast-director";
import type { BroadcastOutputTarget, BroadcastSettings } from "./types";
import {
  buildTeamTickerRows,
  computeBottomStackHeight,
  ObsLowerThirdScene,
} from "./obs-lab/obs-lower-third-scene";
import { TeamTicker } from "./obs-lab/team-ticker";
import { BroadcastLabOverlayTopBar } from "./obs-lab/broadcast-lab-overlay-top-bar";
import { LabSponsorTicker } from "./obs-lab/lab-sponsor-ticker";
import { LAB_SPONSOR_RIBBON_HEIGHT_PX, OBS_LAB_FONTS } from "./obs-lab/obs-tokens";

export type BroadcastLabLayoutProps = {
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
 * Broadcast Overlay v2 layout — polished lower-thirds (Top5 strip, 6-team pages, bid pop).
 * Classic `/obs` remains on BroadcastLayout + obs/*; this powers `/obs/v2`.
 */
export const BroadcastLabLayout = memo(function BroadcastLabLayout(props: BroadcastLabLayoutProps) {
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

  return (
    <div
      data-broadcast-overlay-v2-root
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
        fontFamily: OBS_LAB_FONTS.label,
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

      <BroadcastLabOverlayTopBar
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
        <LabSponsorTicker logos={props.sponsorLogos} includePoweredByBidWar />
      </div>

      {showTeamTicker && (
        <div
          style={{
            position: "absolute",
            bottom: LAB_SPONSOR_RIBBON_HEIGHT_PX,
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
