import { useState } from "react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { cn } from "@/lib/utils";
import {
  formatTeamPlayerLine,
  identityFromSideInfo,
} from "@/lib/team-player-identity";

interface SinglesScorerPanelProps {
  state: BadmintonMatchState;
  onAwardPoint: (side: "left" | "right") => void | Promise<unknown>;
  onUndo: () => Promise<unknown>;
  onStartTimeout?: (side: "left" | "right") => Promise<unknown>;
  onEndTimeout?: () => Promise<unknown>;
  scoringBlocked?: boolean;
}

export function SinglesScorerPanel({
  state,
  onAwardPoint,
  onUndo,
  scoringBlocked = false,
}: SinglesScorerPanelProps) {
  const [undoBusy, setUndoBusy] = useState(false);
  const isTimeout = !!state.activeTimeout;
  const cannotScore = isTimeout || scoringBlocked || state.matchStatus !== "live";

  function award(side: "left" | "right") {
    if (cannotScore) return;
    void onAwardPoint(side);
  }

  async function undo() {
    if (undoBusy || state.totalRallies === 0) return;
    setUndoBusy(true);
    try {
      await onUndo();
    } finally {
      setUndoBusy(false);
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {isTimeout && (
        <div className="shrink-0 mx-3 mt-2 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-amber-300 text-sm font-bold text-center">
          Timeout in progress
        </div>
      )}

      <div className="flex-1 min-h-2" />

      <div className="shrink-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-white/10 space-y-2 bg-[#070b16]">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => award("left")}
            disabled={cannotScore}
            className={cn(
              "min-h-[5.5rem] sm:min-h-[6.5rem] rounded-2xl font-black text-lg sm:text-xl",
              "bg-[#0070f3] text-white active:scale-[0.98] disabled:opacity-40",
            )}
          >
            + {formatTeamPlayerLine(identityFromSideInfo(state.leftSide, { preferShort: true }))}
          </button>
          <button
            type="button"
            onClick={() => award("right")}
            disabled={cannotScore}
            className={cn(
              "min-h-[5.5rem] sm:min-h-[6.5rem] rounded-2xl font-black text-lg sm:text-xl",
              "bg-[#7c3aed] text-white active:scale-[0.98] disabled:opacity-40",
            )}
          >
            + {formatTeamPlayerLine(identityFromSideInfo(state.rightSide, { preferShort: true }))}
          </button>
        </div>
        <button
          type="button"
          onClick={undo}
          disabled={undoBusy || state.totalRallies === 0}
          className="w-full min-h-12 rounded-xl bg-white/5 text-white/55 text-sm font-semibold disabled:opacity-30"
        >
          Undo last point
        </button>
      </div>
    </div>
  );
}
