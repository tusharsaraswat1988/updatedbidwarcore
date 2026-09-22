import { useEffect, type CSSProperties } from "react";
import {
  BROADCAST_OVERLAY_HEIGHT,
  BROADCAST_OVERLAY_SAFE_INSET_X,
  BROADCAST_OVERLAY_SAFE_INSET_Y,
  BROADCAST_OVERLAY_WIDTH,
} from "@/lib/broadcast-overlay";
import { useObsBrowserSource } from "@/components/broadcast/use-obs-browser-source";
import { useObsTransparentDocument } from "@/components/scoring/cricket-obs/use-obs-transparent-document";
import type { CricketObsFlashKind, CricketObsMidOverlayKind, CricketObsViewModel } from "@/lib/cricket-obs-view-model";
import { CricketObsScorebug } from "@/components/scoring/cricket-obs/cricket-obs-scorebug";
import { CricketObsEventFlash } from "@/components/scoring/cricket-obs/cricket-obs-event-flash";
import { CricketObsBranding } from "@/components/scoring/cricket-obs/cricket-obs-branding";
import { CricketObsWaiting } from "@/components/scoring/cricket-obs/cricket-obs-waiting";
import { CricketObsMidOverlays } from "@/components/scoring/cricket-obs/cricket-obs-mid-overlays";
import { CricketObsOperatorDock } from "@/components/scoring/cricket-obs/cricket-obs-operator-dock";

type Props = {
  vm: CricketObsViewModel;
  tournamentId?: number;
  overlayMatchId?: number;
  overlaySponsorName?: string;
  overlayStageOrGroup?: string;
  onSetOverlay?: (
    overlay: CricketObsMidOverlayKind,
    matchId?: number,
    sponsorName?: string,
    stageOrGroup?: string,
  ) => void;
  onTriggerFlash?: (flash: CricketObsFlashKind, detail?: string) => void;
};

/**
 * 5-in-1 Cricket OBS Broadcast Screen:
 * 1. Solid Top Header (Non-Transparent) with BidWar branding centered, tournament logo left, sponsor logo right
 * 2. Transparent Mid Viewport (Camera feed space 100% transparent)
 * 3. Solid Bottom Footer / Scorebug (Non-Transparent) with batsman figures, bowler spell, over train, and run rates
 * 4. Real-time Animations (Come and go event alerts: Four, Six, Superball, Wicket, Free Hit, New Batsman)
 * 5. 80% Screen Frosted Overlays (Sponsors, Standings, Schedule, Scorecard, Summary)
 */
export function CricketObsStage({
  vm,
  tournamentId = 0,
  overlayMatchId,
  overlaySponsorName,
  overlayStageOrGroup,
  onSetOverlay,
  onTriggerFlash,
}: Props) {
  useObsTransparentDocument();
  const isObs = useObsBrowserSource();

  useEffect(() => {
    document.title = "Cricket OBS — BidWar";
  }, []);

  const stageStyle = {
    width: BROADCAST_OVERLAY_WIDTH,
    height: BROADCAST_OVERLAY_HEIGHT,
    ["--obs-accent" as string]: vm.theme.accent,
    ["--obs-accent-on" as string]: vm.theme.accentOn,
    ["--obs-panel" as string]: vm.theme.panel,
    ["--obs-shell" as string]: vm.theme.shell,
    ["--obs-text" as string]: vm.theme.text,
  } as CSSProperties;

  const showScorebug =
    vm.phase === "live" ||
    vm.phase === "chase" ||
    vm.phase === "innings_break" ||
    vm.phase === "completed";

  return (
    <div
      className="relative overflow-hidden text-white"
      style={stageStyle}
      data-obs={isObs ? "1" : "0"}
      data-cricket-obs-phase={vm.phase}
    >
      {/* 1. TOP HEADER (SOLID / NON-TRANSPARENT) */}
      <div className="absolute top-0 left-0 right-0 z-40">
        <CricketObsBranding vm={vm} />
      </div>

      {/* 2. MID SECTION (100% TRANSPARENT CAMERA VIEWPORT)
          Kept completely clear so live video feed shines through */}

      {/* 4. REAL-TIME EVENT ANIMATIONS (Come and go) */}
      <CricketObsEventFlash flash={vm.flash} token={vm.flashToken} detail={vm.flashDetail} />

      {/* 5. 1920x1080 FULL BROADCAST GRAPHIC SLATES */}
      {tournamentId > 0 ? (
        <CricketObsMidOverlays
          vm={vm}
          overlay={vm.midOverlay}
          overlayMatchId={overlayMatchId}
          overlaySponsorName={overlaySponsorName}
          overlayStageOrGroup={overlayStageOrGroup}
          tournamentId={tournamentId}
        />
      ) : null}

      {/* 3. BOTTOM FOOTER / SCOREBUG (SOLID / NON-TRANSPARENT — DOCKED EDGE-TO-EDGE) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex w-full flex-col justify-end">
        <div className="flex w-full flex-col items-stretch">
          {vm.connectionHint === "reconnecting" ? (
            <p className="self-end px-6 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70 drop-shadow">
              Live data reconnecting…
            </p>
          ) : null}

          {showScorebug ? (
            <CricketObsScorebug vm={vm} />
          ) : (
            <CricketObsWaiting vm={vm} />
          )}
        </div>
      </div>

      {/* OPERATOR BROADCAST CONTROLLER DOCK (Hidden on live stream; only visible if ?dock=1 or ?controls=1 is explicitly passed in URL) */}
      {typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).get("dock") === "1" ||
        new URLSearchParams(window.location.search).get("controls") === "1") &&
      onSetOverlay &&
      onTriggerFlash ? (
        <CricketObsOperatorDock
          currentOverlay={vm.midOverlay}
          onSetOverlay={onSetOverlay}
          onTriggerFlash={onTriggerFlash}
        />
      ) : null}
    </div>
  );
}
