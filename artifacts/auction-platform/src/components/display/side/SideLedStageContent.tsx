import type { LedView } from "@/lib/led-view/types";
import { isDeveloperMode } from "@/lib/broadcast-canvas/preview-mode";
import {
  DisplayCanvas,
  SideBroadcastBackground,
  SideSafeAreaOverlay,
  useBroadcastCanvasPreviewOptional,
} from "../broadcast-canvas";
import { DevThemePicker } from "../v1";
import { SideStageFrame } from "./SideStageFrame";
import { SideSponsorPanel } from "./SideSponsorPanel";
import { SidePlayerProfilePanel } from "./SidePlayerProfilePanel";
import { SideEffectsLayer } from "./SideEffectsLayer";
import { SideBreakBadge, sidePanelShowsStatusBadge } from "./SideBreakBadge";

export type SideLedPanelMode = "sponsors" | "player";

function DeveloperCanvasTools() {
  const ctx = useBroadcastCanvasPreviewOptional();
  if (!ctx || !isDeveloperMode(ctx.preview)) return null;
  return (
    <>
      <SideSafeAreaOverlay />
      <DevThemePicker anchor="stage" />
    </>
  );
}

/** Player profile — existing flex layout mounted on 1080×1920 broadcast canvas. */
function SidePlayerLedStage({ view }: { view: LedView }) {
  return (
    <DisplayCanvas>
      <SideStageFrame variant="viewport">
        <div className="flex h-full w-full flex-col">
          <div className="relative min-h-0 flex-1">
            <SidePlayerProfilePanel view={view} />
            <SideEffectsLayer view={view} panel="player" />
          </div>
          {sidePanelShowsStatusBadge(view) ? (
            <div className="shrink-0 border-t border-white/10 px-[5%] py-[3%]">
              <SideBreakBadge view={view} layout="flex" />
            </div>
          ) : null}
        </div>
        <DeveloperCanvasTools />
      </SideStageFrame>
    </DisplayCanvas>
  );
}

/** Sponsors — fixed 1080×1920 broadcast canvas. */
function SideSponsorLedStage({
  view,
  tournamentId,
}: {
  view: LedView;
  tournamentId: number;
}) {
  return (
    <DisplayCanvas>
      <SideStageFrame variant="canvas">
        <SideBroadcastBackground />
        <SideSponsorPanel view={view} tournamentId={tournamentId} />
        {sidePanelShowsStatusBadge(view) ? <SideBreakBadge view={view} layout="canvas" /> : null}
        <SideEffectsLayer view={view} panel="sponsors" />
        <DeveloperCanvasTools />
      </SideStageFrame>
    </DisplayCanvas>
  );
}

/**
 * Side LED layout — player profile OR sponsors, both on fixed 1080×1920 broadcast canvas.
 */
export function SideLedStageContent({
  view,
  panel,
  tournamentId,
}: {
  view: LedView;
  panel: SideLedPanelMode;
  tournamentId: number;
}) {
  if (panel === "player") {
    return <SidePlayerLedStage view={view} />;
  }

  return <SideSponsorLedStage view={view} tournamentId={tournamentId} />;
}
