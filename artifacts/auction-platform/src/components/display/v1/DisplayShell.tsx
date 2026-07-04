import { StageFrame } from "./StageFrame";
import { TopStrip } from "./TopStrip";
import { PlayerPortrait } from "./PlayerPortrait";
import { BidCenter } from "./BidCenter";
import { TimerPanel } from "./TimerPanel";
import { BidLadder } from "./BidLadder";
import { ChyronStrip } from "./ChyronStrip";
import { SponsorSpotlight } from "./SponsorSpotlight";
import { EffectsLayer } from "./EffectsLayer";
import type { LedView } from "@/lib/led-view/types";

const STAGE_GRID_ROWS = "grid-rows-[3.5rem_1fr_minmax(3rem,8%)]";
const STAGE_GRID_ROWS_LIVE = "grid-rows-[3.5rem_1fr_minmax(4.5rem,12%)_minmax(3rem,8%)]";

/**
 * V1 LED stage layout — pure presentation over a LedView snapshot.
 */
export function LedStageContent({ view }: { view: LedView }) {
  const overlayActive =
    view.derivedState === "teamWise" ||
    view.derivedState === "playerWise" ||
    view.derivedState === "topSold" ||
    view.derivedState === "banner" ||
    view.derivedState === "teamPurse" ||
    view.derivedState === "fortuneWheel" ||
    view.derivedState === "break" ||
    view.derivedState === "preAuction" ||
    view.derivedState === "paused";

  if (!view.currentPlayer && view.derivedState !== "awaitingNext" && !overlayActive) {
    return (
      <StageFrame>
        <div className={`absolute inset-0 grid ${STAGE_GRID_ROWS} font-['Barlow_Condensed']`}>
          <TopStrip view={view} />
          <div className="relative min-h-0 h-full w-full">
            <SponsorSpotlight
              tournamentName={view.tournament.name}
              sponsors={view.sponsors ?? []}
            />
          </div>
          <ChyronStrip view={view} />
        </div>
        <EffectsLayer view={view} />
      </StageFrame>
    );
  }

  return (
    <StageFrame>
      {view.currentPlayer || view.derivedState === "awaitingNext" ? (
        <div className={`absolute inset-0 grid ${STAGE_GRID_ROWS_LIVE} font-['Barlow_Condensed']`}>
          <TopStrip view={view} />
          <div className="grid grid-cols-[28%_1fr_24%] gap-[1.2%] p-[1.5%]">
            <PlayerPortrait view={view} />
            <BidCenter view={view} />
            <TimerPanel view={view} />
          </div>
          <BidLadder view={view} />
          <ChyronStrip view={view} />
        </div>
      ) : (
        <div className={`absolute inset-0 grid ${STAGE_GRID_ROWS} font-['Barlow_Condensed']`}>
          <TopStrip view={view} />
          <div />
          <ChyronStrip view={view} />
        </div>
      )}
      <EffectsLayer view={view} />
    </StageFrame>
  );
}
