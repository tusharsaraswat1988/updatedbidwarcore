import React from "react";
import { LiveScoringBoard } from "@/components/fan/live-scoring-board";
import { useFanNavigation } from "./fan-navigation-context";

export interface BadmintonFanRendererProps {
  tournamentId: number;
  activeSection?: string;
  onNavigateSection?: (section: any) => void;
}

/** Read-only badminton board on the same public scoring feed as other licensed sports. */
export function BadmintonFanRenderer({
  tournamentId,
  activeSection: propActiveSection,
  onNavigateSection: propOnNavigateSection,
}: BadmintonFanRendererProps) {
  const nav = useFanNavigation();
  const activeSection = propActiveSection || nav.activeSection || "overview";
  const onNavigateSection = propOnNavigateSection || nav.onNavigateSection;

  return (
    <div className="w-full" data-testid="badminton-fan-renderer">
      <LiveScoringBoard
        tournamentId={tournamentId}
        activeSection={activeSection}
        onNavigateSection={onNavigateSection}
        sportLabel="Badminton scores"
      />
    </div>
  );
}

export default BadmintonFanRenderer;
