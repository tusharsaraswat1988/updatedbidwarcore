/**
 * MidScreenSlatesV2 — V2 Mid-Screen Broadcast Slates Manager
 *
 * Uses the unified BroadcastSideSlate component with:
 * - Side-entry composition entering from the LEFT edge of the camera-safe area
 * - Left-to-right panel reveal, clean readable hold, and reverse left exit
 * - Content-driven widths (38%–54% of broadcast canvas)
 * - Protected camera safe zone (top: 96px, height: 784px / y: 96px → 880px)
 * - Strict zero overlap with Header (0–96px), Scorebug (880–1040px), or Footer (1040–1080px)
 */

import { AnimatePresence } from "framer-motion";
import type { CricketObsViewModel, CricketObsMidOverlayKind } from "@/lib/cricket-obs-view-model";
import { CricketBattingScorecardOverlay } from "@/components/scoring/cricket-batting-scorecard-overlay";
import { plateMatchId } from "@/lib/cricket-broadcast-plates";
import { OBS_V2 } from "../obs-v2-tokens";
import {
  BroadcastSideSlate,
  type BroadcastSideSlateVariant,
} from "./BroadcastSideSlate";

export interface MidScreenSlatesV2Props {
  vm: CricketObsViewModel;
  overlay: CricketObsMidOverlayKind;
  overlayMatchId?: number;
  overlaySponsorName?: string;
  overlayStageOrGroup?: string;
  tournamentId: number;
}

export function MidScreenSlatesV2({
  vm,
  overlay,
  overlayMatchId,
  overlaySponsorName,
  overlayStageOrGroup,
  tournamentId,
}: MidScreenSlatesV2Props) {
  if (overlay === "none" || overlay === "neutral" || overlay === "banner") return null;

  if (overlay === "batting") {
    const live = vm.phase === "live" || vm.phase === "chase" || vm.phase === "innings_break";
    const matchId = plateMatchId({
      overlay: "batting",
      overlayMatchId,
      liveMatchId: vm.matchId,
      liveStatus: live ? "live" : vm.phase === "completed" ? "completed" : null,
    });
    return (
      <div
        className="pointer-events-none absolute inset-x-0 flex items-center justify-center"
        style={{
          top: `${OBS_V2.canvas.headerHeight}px`,
          height: `${OBS_V2.canvas.cameraHeight}px`,
          zIndex: OBS_V2.layer.slates,
          padding: "16px 64px",
        }}
      >
        <CricketBattingScorecardOverlay
          tournamentId={tournamentId}
          matchId={matchId}
          tournamentName={vm.tournamentName}
          liveSequence={vm.liveSequence}
        />
      </div>
    );
  }

  const variantMap: Record<string, BroadcastSideSlateVariant | null> = {
    summary: "SUMMARY",
    scorecard: "SCORECARD",
    standings: "STANDINGS",
    fixtures: "FIXTURES",
    sponsors: "SPONSORS",
    intro: "VS_INTRO",
  };

  const variant = variantMap[overlay];
  if (!variant) return null;

  return (
    <AnimatePresence mode="wait">
      <BroadcastSideSlate
        key={`slate-${overlay}`}
        variant={variant}
        vm={vm}
        tournamentId={tournamentId}
        matchId={overlayMatchId}
        sponsorName={overlaySponsorName}
        stageOrGroup={overlayStageOrGroup}
      />
    </AnimatePresence>
  );
}

export { BroadcastSideSlate, type BroadcastSideSlateVariant } from "./BroadcastSideSlate";
