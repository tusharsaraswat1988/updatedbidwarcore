import React from "react";
import { CricketFanExperience } from "@/components/fan/cricket-fan-experience";
import { useFanNavigation } from "./fan-navigation-context";

export interface CricketFanRendererProps {
  tournamentId: number;
  activeSection?: string;
  onNavigateSection?: (section: any) => void;
}

/** Read-only cricket board. Live scores arrive on the public scoring stream. */
export function CricketFanRenderer({
  tournamentId,
  activeSection: propActiveSection,
  onNavigateSection: propOnNavigateSection,
}: CricketFanRendererProps) {
  const nav = useFanNavigation();
  const activeSection = propActiveSection || nav.activeSection || "overview";
  const onNavigateSection = propOnNavigateSection || nav.onNavigateSection;

  return (
    <div className="w-full" data-testid="cricket-fan-renderer">
      <CricketFanExperience
        tournamentId={tournamentId}
        activeSection={activeSection}
        onNavigateSection={onNavigateSection}
      />
    </div>
  );
}

export default CricketFanRenderer;
