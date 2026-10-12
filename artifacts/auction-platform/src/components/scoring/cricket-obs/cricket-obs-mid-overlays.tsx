/**
 * Cricket OBS full-screen plates. Scoring figures are resolved in
 * CricketBroadcastPlatesView so this stream matches the ground LED.
 */

import { CricketBroadcastPlatesView } from "@/components/scoring/cricket-broadcast-plates-view";
import type { CricketObsMidOverlayKind, CricketObsViewModel } from "@/lib/cricket-obs-view-model";

type Props = {
  vm: CricketObsViewModel;
  overlay: CricketObsMidOverlayKind;
  overlayMatchId?: number;
  overlaySponsorName?: string;
  overlayStageOrGroup?: string;
  tournamentId: number;
};

export function CricketObsMidOverlays({
  vm,
  overlay,
  overlayMatchId,
  overlaySponsorName,
  overlayStageOrGroup,
  tournamentId,
}: Props) {
  const liveStatus = vm.phase === "live" || vm.phase === "chase" || vm.phase === "innings_break"
    ? "live"
    : vm.phase === "completed"
      ? "completed"
      : null;
  return (
    <CricketBroadcastPlatesView
      overlay={overlay}
      tournamentId={tournamentId}
      tournamentName={vm.tournamentName}
      overlayMatchId={overlayMatchId}
      overlaySponsorName={overlaySponsorName}
      overlayStageOrGroup={overlayStageOrGroup}
      sponsors={vm.sponsors}
      liveMatchId={vm.matchId}
      liveTossText={vm.tossText}
      liveStatus={liveStatus}
    />
  );
}
