import React from "react";
import LiveViewerPage from "@/pages/liveviewer";

export interface AuctionFanRendererProps {
  tournamentId: number;
}

/**
 * AuctionFanRenderer
 *
 * Reusable spectator auction experience extracted directly from the verified production LiveViewer.
 * Hosts real-time player bidding, timer countdown, team purses, cheer stream, and sold/unsold outcomes
 * within the Unified Fan Page Shell.
 */
export function AuctionFanRenderer({ tournamentId }: AuctionFanRendererProps) {
  if (!tournamentId || tournamentId <= 0) {
    return (
      <div className="w-full flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-sm">
        Invalid tournament ID for auction spectator view.
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col min-h-0" data-testid="auction-fan-renderer">
      <LiveViewerPage tournamentId={tournamentId} embedded={true} />
    </div>
  );
}

export default AuctionFanRenderer;
