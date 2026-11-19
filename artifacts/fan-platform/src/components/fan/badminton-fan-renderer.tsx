import React from "react";
import { LiveScoringBoard } from "@/components/fan/live-scoring-board";

export interface BadmintonFanRendererProps {
  tournamentId: number;
}

/** Read-only badminton board on the same public scoring feed as other licensed sports. */
export function BadmintonFanRenderer({ tournamentId }: BadmintonFanRendererProps) {
  return (
    <div className="w-full" data-testid="badminton-fan-renderer">
      <LiveScoringBoard tournamentId={tournamentId} sportLabel="Badminton scores" />
    </div>
  );
}

export default BadmintonFanRenderer;
