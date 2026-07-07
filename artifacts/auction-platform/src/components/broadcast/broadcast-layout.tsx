import { memo, useEffect } from "react";
import type { AuctionState, TeamPurse } from "@workspace/api-client-react";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import {
  BROADCAST_OVERLAY_HEIGHT,
  BROADCAST_OVERLAY_WIDTH,
} from "@/lib/broadcast-overlay";
import { DisplayConnectionBanner } from "@/components/display/display-connection-banner";
import type { AuctionFeedState } from "@/hooks/use-auction-connection-state";
import { BroadcastAnimator } from "./broadcast-animator";
import { useBroadcastStateManager } from "./broadcast-state-manager";
import { AuctionScene } from "./auction-scene";
import { SoldScene } from "./sold-scene";
import { UnsoldScene } from "./unsold-scene";
import { BreakScene } from "./break-scene";
import { WaitingScene } from "./waiting-scene";
import { SummaryScene } from "./summary-scene";
import type { BroadcastSettings } from "./types";
import { cldUrl } from "@/lib/cloudinary";

export type BroadcastLayoutProps = {
  tournamentId: number;
  tournamentName: string | null;
  tournamentLogoUrl: string | null;
  auctionStartsAt?: string | null;
  sponsorLogos: SponsorLogo[];
  state: AuctionState | undefined;
  teamPurses: TeamPurse[] | undefined;
  settings: BroadcastSettings;
  isObsMode: boolean;
  formatAmount: (n: number) => string;
  feedState: AuctionFeedState;
  secondsSinceLastActivity: number | null;
  isStaleFeed: boolean;
};

export const BroadcastLayout = memo(function BroadcastLayout({
  tournamentId,
  tournamentName,
  tournamentLogoUrl,
  auctionStartsAt,
  sponsorLogos,
  state,
  teamPurses,
  settings,
  isObsMode,
  formatAmount,
  feedState,
  secondsSinceLastActivity,
  isStaleFeed,
}: BroadcastLayoutProps) {
  const obsMode = isObsMode || settings.obsPerformanceMode;

  const engine = useBroadcastStateManager({
    tournamentId,
    state,
    teamPurses,
    tournamentName,
    tournamentLogoUrl,
    sponsorLogos,
    settings,
    isObsMode: obsMode,
    formatAmount,
    isStaleFeed,
  });

  // Preload current player photo at broadcast quality
  useEffect(() => {
    const url = state?.currentPlayer?.photoUrl;
    if (!url) return;
    const img = new Image();
    img.src = cldUrl(url, "playerCard");
  }, [state?.currentPlayer?.photoUrl]);

  const sceneContent = (() => {
    switch (engine.scene) {
      case "SOLD":
        return engine.outcomeSnapshot ? (
          <SoldScene
            snapshot={engine.outcomeSnapshot}
            settings={settings}
            formatAmount={formatAmount}
            obsMode={obsMode}
          />
        ) : null;

      case "UNSOLD":
        return engine.outcomeSnapshot ? (
          <UnsoldScene
            snapshot={engine.outcomeSnapshot}
            settings={settings}
            formatAmount={formatAmount}
            obsMode={obsMode}
          />
        ) : null;

      case "BREAK":
        return engine.breakEndsAt ? (
          <BreakScene
            tournamentName={tournamentName}
            sponsorLogos={sponsorLogos}
            settings={settings}
            breakEndsAt={engine.breakEndsAt}
            breakMessage={engine.breakMessage}
            obsMode={obsMode}
          />
        ) : null;

      case "WAITING":
        return (
          <WaitingScene
            tournamentName={tournamentName}
            tournamentLogoUrl={tournamentLogoUrl}
            sponsorLogos={sponsorLogos}
            settings={settings}
            auctionStartsAt={auctionStartsAt ?? engine.breakEndsAt}
            obsMode={obsMode}
          />
        );

      case "SUMMARY":
        return engine.summaryStats ? (
          <SummaryScene
            tournamentName={tournamentName}
            tournamentLogoUrl={tournamentLogoUrl}
            sponsorLogos={sponsorLogos}
            settings={settings}
            stats={engine.summaryStats}
            formatAmount={formatAmount}
            obsMode={obsMode}
          />
        ) : null;

      case "AUCTION":
      default:
        return state ? (
          <AuctionScene
            state={state}
            tournamentName={tournamentName}
            tournamentLogoUrl={tournamentLogoUrl}
            sponsorLogos={sponsorLogos}
            settings={settings}
            bidTimeline={engine.bidTimeline}
            formatAmount={formatAmount}
            obsMode={obsMode}
          />
        ) : (
          <WaitingScene
            tournamentName={tournamentName}
            tournamentLogoUrl={tournamentLogoUrl}
            sponsorLogos={sponsorLogos}
            settings={settings}
            obsMode={obsMode}
          />
        );
    }
  })();

  return (
    <div
      data-broadcast-overlay-root
      data-broadcast-scene={engine.scene}
      style={{
        background: "#050508",
        width: `${BROADCAST_OVERLAY_WIDTH}px`,
        height: `${BROADCAST_OVERLAY_HEIGHT}px`,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        outline: isStaleFeed ? "4px solid rgba(245,158,11,0.35)" : undefined,
        outlineOffset: -4,
      }}
    >
      <DisplayConnectionBanner
        feedState={feedState}
        secondsSinceLastActivity={secondsSinceLastActivity}
      />

      <BroadcastAnimator
        sceneKey={engine.scene}
        isTransitioning={engine.isTransitioning}
        obsMode={obsMode}
      >
        {sceneContent}
      </BroadcastAnimator>
    </div>
  );
});
