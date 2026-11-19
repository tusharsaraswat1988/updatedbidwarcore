import React from "react";
import { CricketFanExperience } from "@/components/fan/cricket-fan-experience";

export interface CricketFanRendererProps {
  tournamentId: number;
}

/** Read-only cricket board. Live scores arrive on the public scoring stream. */
export function CricketFanRenderer({ tournamentId }: CricketFanRendererProps) {
  return (
    <div className="w-full" data-testid="cricket-fan-renderer">
      <CricketFanExperience tournamentId={tournamentId} />
    </div>
  );
}

export default CricketFanRenderer;
