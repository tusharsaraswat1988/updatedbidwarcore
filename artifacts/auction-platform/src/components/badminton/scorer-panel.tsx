import type { BadmintonMatchState } from "@workspace/badminton-core";
import { isPairMatchKind } from "@workspace/badminton-core";
import { DoublesScorerPanel } from "@/components/badminton/doubles-scorer-panel";
import { SinglesScorerPanel } from "@/components/badminton/singles-scorer-panel";

interface ScorerPanelProps {
  tournamentId: number;
  matchId: number;
  state: BadmintonMatchState;
  onAwardPoint: (side: "left" | "right") => Promise<unknown>;
  onUndo: () => Promise<unknown>;
  onStartTimeout: (side: "left" | "right") => Promise<unknown>;
  onEndTimeout: () => Promise<unknown>;
  onRetirement?: (side: "left" | "right") => Promise<unknown>;
  onWalkover?: (side: "left" | "right") => Promise<unknown>;
}

/**
 * Routes to dedicated singles or doubles scorer UI.
 * Doubles uses player-level service ? never team-level serving controls.
 */
export function ScorerPanel({
  state,
  onAwardPoint,
  onUndo,
  onStartTimeout,
  onEndTimeout,
}: ScorerPanelProps) {
  const isDoubles = isPairMatchKind(state.matchKind);

  if (isDoubles) {
    return (
      <DoublesScorerPanel
        state={state}
        onAwardPoint={onAwardPoint}
        onUndo={onUndo}
        onStartTimeout={onStartTimeout}
        onEndTimeout={onEndTimeout}
      />
    );
  }

  return (
    <SinglesScorerPanel
      state={state}
      onAwardPoint={onAwardPoint}
      onUndo={onUndo}
      onStartTimeout={onStartTimeout}
      onEndTimeout={onEndTimeout}
    />
  );
}
