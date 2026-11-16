import React from "react";
import ScoringPublicPage from "@/pages/scoring-public";

export interface CricketFanRendererProps {
  tournamentId: number;
}

/**
 * CricketFanRenderer
 *
 * Dedicated spectator Cricket scoring experience integrated directly from the production scoring-public page.
 * Renders real-time ball-by-ball scoreboards, match schedule, completed results, category standings,
 * tournament bracket progress, player leaderboards, sponsor banners, and spectator cheer reactions.
 */
export function CricketFanRenderer({ tournamentId }: CricketFanRendererProps) {
  if (!tournamentId || tournamentId <= 0) {
    return (
      <div className="w-full flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-sm">
        Invalid tournament ID for cricket scoring view.
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col min-h-0" data-testid="cricket-fan-renderer">
      <ScoringPublicPage tournamentIdProp={tournamentId} embedded={true} />
    </div>
  );
}

export default CricketFanRenderer;
