import type { LedView } from "@/lib/led-view/types";
import type { AuctionFeedState } from "@workspace/api-base/auction-connection-state";
import { resolveReconnectStandby } from "../display-reconnect-standby";
import { SideStageFrame } from "./SideStageFrame";
import { SideSponsorPanel } from "./SideSponsorPanel";
import { SidePlayerProfilePanel } from "./SidePlayerProfilePanel";
import { SideEffectsLayer } from "./SideEffectsLayer";

export type SideLedPanelMode = "sponsors" | "player";

function StandbyScreen({
  message,
  tone,
  tournamentName,
}: {
  message: string;
  tone: "info" | "error";
  tournamentName?: string;
}) {
  const accent = tone === "error" ? "rgb(248 113 113)" : "var(--accent)";

  return (
    <div className="flex h-full flex-col items-center justify-center px-[8%] text-center">
      <p className="font-['Bebas_Neue'] text-6xl tracking-widest text-white/90">
        {tone === "error" ? "OFFLINE" : "STANDBY"}
      </p>
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.4em]" style={{ color: accent }}>
        {message}
      </p>
      {tournamentName ? (
        <p className="mt-6 font-['Bebas_Neue'] text-xl tracking-wider text-white/50">
          {tournamentName}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Side LED layout — sponsors carousel OR full player profile.
 * Ignores operator overlay modes (team / player list / top 5).
 */
export function SideLedStageContent({
  view,
  panel,
  feedState,
}: {
  view: LedView;
  panel: SideLedPanelMode;
  feedState?: AuctionFeedState;
}) {
  const standby = resolveReconnectStandby(view, feedState);
  if (standby) {
    return (
      <SideStageFrame>
        <StandbyScreen
          tone={standby.tone}
          tournamentName={standby.tournamentName}
          message={standby.message}
        />
      </SideStageFrame>
    );
  }

  return (
    <SideStageFrame>
      <div className="relative h-full w-full">
        {panel === "sponsors" ? (
          <SideSponsorPanel view={view} />
        ) : (
          <SidePlayerProfilePanel view={view} />
        )}
        <SideEffectsLayer view={view} />
      </div>
    </SideStageFrame>
  );
}
