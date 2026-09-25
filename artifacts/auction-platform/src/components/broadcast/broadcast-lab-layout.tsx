import { memo, useMemo } from "react";
import type { AuctionState, Player, TeamPurse } from "@workspace/api-client-react";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import { BROADCAST_OVERLAY_HEIGHT, BROADCAST_OVERLAY_WIDTH } from "@/lib/broadcast-overlay";
import type { AuctionFeedState } from "@/hooks/use-auction-connection-state";
import { useBroadcastDirector } from "./use-broadcast-director";
import type { BroadcastOutputTarget, BroadcastSettings } from "./types";
import "./obs-v2/broadcast.css";
import { BroadcastStage } from "./obs-v2/BroadcastStage";
import { adaptAuctionToBroadcastFrame } from "./obs-v2/auction-v2-adapter";
import type { ObsV2BroadcastEvent } from "./obs-v2/obs-v2-events";

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
  activeEvent?: ObsV2BroadcastEvent | null;
};

/**
 * Broadcast Overlay V2 Layout — Master presentation powered by the
 * new Lovable Broadcast Overlay Design System.
 *
 * Classic production `/obs` remains untouched on BroadcastLayout + obs/*.
 * This powers `/obs/v2` (and alias `/obs/lab`).
 */
export const BroadcastLabLayout = memo(function BroadcastLabLayout(props: BroadcastLabLayoutProps) {
  // Authoritative BidWar Broadcast Director handles scene transitions, ephemeral holds, timers
  const directorFrame = useBroadcastDirector({
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

  // Adapt authoritative director frame and live state to Lovable BroadcastFrame presentation model
  const lovableFrame = useMemo(() => {
    return adaptAuctionToBroadcastFrame({
      directorFrame,
      tournamentName: props.tournamentName,
      tournamentLogoUrl: props.tournamentLogoUrl,
      auctionStartsAt: props.auctionStartsAt,
      sponsorLogos: props.sponsorLogos,
      state: props.state,
      teamPurses: props.teamPurses,
      soldPlayers: props.soldPlayers,
      formatAmount: props.formatAmount,
      isStaleFeed: props.isStaleFeed,
      feedState: props.feedState,
      secondsSinceLastActivity: props.secondsSinceLastActivity,
      performanceMode: props.isObsMode || props.settings.obsPerformanceMode,
      showTicker: props.sponsorLogos.length > 0,
    });
  }, [
    directorFrame,
    props.tournamentName,
    props.tournamentLogoUrl,
    props.auctionStartsAt,
    props.sponsorLogos,
    props.state,
    props.teamPurses,
    props.soldPlayers,
    props.formatAmount,
    props.isStaleFeed,
    props.feedState,
    props.secondsSinceLastActivity,
    props.isObsMode,
    props.settings.obsPerformanceMode,
  ]);

  return (
    <div
      data-broadcast-overlay-v2-root
      data-broadcast-overlay-root
      data-broadcast-scene={directorFrame.sceneId}
      data-broadcast-context={directorFrame.currentContext}
      data-broadcast-output={directorFrame.outputTarget}
      className="bw-obs-root"
      style={{
        background: "transparent",
        width: `${BROADCAST_OVERLAY_WIDTH}px`,
        height: `${BROADCAST_OVERLAY_HEIGHT}px`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <BroadcastStage frame={lovableFrame} activeEvent={props.activeEvent} />
    </div>
  );
});
