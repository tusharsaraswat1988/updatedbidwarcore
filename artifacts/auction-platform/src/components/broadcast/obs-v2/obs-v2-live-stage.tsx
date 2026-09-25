import { type CSSProperties, type HTMLAttributes } from "react";
import { ObsV2Canvas } from "./obs-v2-canvas";
import { ObsV2Stage } from "./obs-v2-stage";
import { useObsV2Live } from "./use-obs-v2-live";
import { useObsV2Events } from "./use-obs-v2-events";

export interface ObsV2LiveStageProps extends HTMLAttributes<HTMLDivElement> {
  tournamentId: number;
  pinnedMatchId?: number | null;
  showSafeGuides?: boolean;
  scale?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * ObsV2LiveStage — Live-Connected 1920×1080 Cricket Broadcast Stage
 *
 * Automatically connects to:
 * - Tournament metadata & branding
 * - Live scoring SSE stream (/api/tournaments/:id/scoring/events)
 * - Automatic SSE reconnection and state synchronization
 * - Adapts authoritative production state into ObsV2StageData
 * - Deduplicates and animates transient live broadcast events (FOUR, SIX, WICKET, MILESTONE)
 */
export function ObsV2LiveStage({
  tournamentId,
  pinnedMatchId = null,
  showSafeGuides = false,
  scale,
  className = "",
  style,
  ...rest
}: ObsV2LiveStageProps) {
  const { data, scoringActive, rawVm } = useObsV2Live(tournamentId, pinnedMatchId);

  // Detect individual batter milestones from live striker stats
  const strikerRuns = rawVm?.striker?.runs;
  const milestone =
    strikerRuns === 50 ? 50 : strikerRuns === 100 ? 100 : null;

  // Manage transient broadcast event lifecycle with deduplication and priority handling
  const { activeEvent } = useObsV2Events({
    rawFlash: rawVm?.flash ?? null,
    flashToken: rawVm?.flashToken ?? null,
    flashDetail: rawVm?.flashDetail ?? null,
    matchId: rawVm?.matchId ?? null,
    phase: rawVm?.phase ?? "live",
    batterName: rawVm?.striker?.name ?? null,
    milestoneValue: milestone,
  });

  if (!scoringActive && tournamentId > 0) {
    return (
      <ObsV2Canvas scale={scale} className={className} style={style}>
        <div className="flex h-full w-full items-center justify-center">
          <p className="rounded-lg bg-black/70 px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/60 border border-white/10">
            Cricket scoring is not enabled for this tournament
          </p>
        </div>
      </ObsV2Canvas>
    );
  }

  return (
    <ObsV2Stage
      data={data}
      activeEvent={activeEvent}
      broadcastMessage={null}
      showSafeGuides={showSafeGuides}
      scale={scale}
      className={className}
      style={style}
      {...rest}
    />
  );
}
