import type { LedView } from "@/lib/led-view/types";
import { SideStageFrame } from "./SideStageFrame";
import { SideSponsorPanel } from "./SideSponsorPanel";
import { SidePlayerProfilePanel } from "./SidePlayerProfilePanel";
import { SideEffectsLayer } from "./SideEffectsLayer";
import { SideBreakBadge, sidePanelShowsStatusBadge } from "./SideBreakBadge";

export type SideLedPanelMode = "sponsors" | "player";

/**
 * Side LED layout — sponsors carousel OR full player profile.
 * Ignores operator overlay modes (team / player list / top 5).
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
  return (
    <SideStageFrame>
      <div className="flex h-full w-full flex-col">
        <div className="relative min-h-0 flex-1">
          {panel === "sponsors" ? (
            <SideSponsorPanel view={view} tournamentId={tournamentId} />
          ) : (
            <SidePlayerProfilePanel view={view} />
          )}
          <SideEffectsLayer view={view} panel={panel} />
        </div>
        {sidePanelShowsStatusBadge(view) ? (
          <div className="shrink-0 border-t border-white/10 px-[5%] py-[2%]">
            <SideBreakBadge view={view} />
          </div>
        ) : null}
      </div>
    </SideStageFrame>
  );
}
