import { useEffect, type CSSProperties } from "react";
import {
  BROADCAST_OVERLAY_HEIGHT,
  BROADCAST_OVERLAY_SAFE_INSET_X,
  BROADCAST_OVERLAY_SAFE_INSET_Y,
  BROADCAST_OVERLAY_WIDTH,
} from "@/lib/broadcast-overlay";
import { useObsBrowserSource } from "@/components/broadcast/use-obs-browser-source";
import { useObsTransparentDocument } from "@/components/scoring/cricket-obs/use-obs-transparent-document";
import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";
import { CricketObsScorebug } from "@/components/scoring/cricket-obs/cricket-obs-scorebug";
import { CricketObsSecondaryStrip } from "@/components/scoring/cricket-obs/cricket-obs-secondary-strip";
import { CricketObsEventFlash } from "@/components/scoring/cricket-obs/cricket-obs-event-flash";
import { CricketObsBranding } from "@/components/scoring/cricket-obs/cricket-obs-branding";
import { CricketObsWaiting } from "@/components/scoring/cricket-obs/cricket-obs-waiting";

type Props = {
  vm: CricketObsViewModel;
};

export function CricketObsStage({ vm }: Props) {
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
      {/* Transparent stage — camera remains the hero */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          paddingLeft: BROADCAST_OVERLAY_SAFE_INSET_X,
          paddingRight: BROADCAST_OVERLAY_SAFE_INSET_X,
          paddingTop: BROADCAST_OVERLAY_SAFE_INSET_Y,
          paddingBottom: BROADCAST_OVERLAY_SAFE_INSET_Y,
        }}
      >
        <div className="relative flex h-full w-full flex-col justify-between">
          <CricketObsBranding vm={vm} />

          <div className="mt-auto flex w-full flex-col items-stretch gap-2">
            {vm.connectionHint === "reconnecting" ? (
              <p
                className="self-end text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55"
                style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}
              >
                Live data reconnecting
              </p>
            ) : null}

            {showScorebug ? (
              <>
                <CricketObsEventFlash flash={vm.flash} token={vm.flashToken} />
                <CricketObsSecondaryStrip vm={vm} />
                <CricketObsScorebug vm={vm} />
              </>
            ) : (
              <CricketObsWaiting vm={vm} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
