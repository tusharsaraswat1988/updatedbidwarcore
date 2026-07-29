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
  onStartTimeout,
  onEndTimeout,
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
      {(state.isPaused || state.matchStatus === "paused") && (
        <div
          className="shrink-0 mx-3 mt-2 rounded-lg bg-amber-600/20 border border-amber-400/40 px-3 py-2.5 text-amber-100 text-sm font-bold text-center"
          role="status"
        >
          Scoring locked — director must resume the match
        </div>
      )}

      {isTimeout && (
        <div className="shrink-0 mx-3 mt-2 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-amber-300 text-sm font-bold text-center">
          Timeout in progress
          {state.activeTimeout?.side
            ? ` · ${state.activeTimeout.side === "left" ? "Left" : "Right"}`
            : ""}
        </div>
      )}

      <div className="flex-1 min-h-2" />

      <div className="shrink-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border space-y-2 bg-card/90">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => award("left")}
            disabled={cannotScore}
            className={cn(
              "min-h-[5.5rem] sm:min-h-[6.5rem] rounded-2xl font-black text-sm sm:text-base px-2",
              "bg-primary text-primary-foreground active:scale-[0.98] shadow-[var(--shadow-glow)] disabled:opacity-40",
            )}
          >
            <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">
              End 1
            </span>
            + {formatTeamPlayerLine(identityFromSideInfo(state.leftSide))}
          </button>
          <button
            type="button"
            onClick={() => award("right")}
            disabled={cannotScore}
            className={cn(
              "min-h-[5.5rem] sm:min-h-[6.5rem] rounded-2xl font-black text-sm sm:text-base px-2",
              "bg-sky-500 text-white active:scale-[0.98] disabled:opacity-40",
            )}
          >
            <span className="block text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1">
              End 2
            </span>
            + {formatTeamPlayerLine(identityFromSideInfo(state.rightSide))}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={undoBusy || state.totalRallies === 0}
            className="flex-1 min-h-12 rounded-xl bg-white/5 border border-border text-muted-foreground text-sm font-semibold disabled:opacity-30"
          >
            Undo last point
          </button>
          {isTimeout && onEndTimeout ? (
            <button
              type="button"
              onClick={() => void onEndTimeout()}
              className="flex-1 min-h-12 rounded-xl bg-amber-600/30 border border-amber-500/40 text-amber-300 text-sm font-semibold"
            >
              End timeout
            </button>
          ) : onStartTimeout ? (
            <button
              type="button"
              onClick={() => void onStartTimeout(state.servingSide ?? "left")}
              disabled={undoBusy || state.matchStatus !== "live"}
              className="flex-1 min-h-12 rounded-xl bg-white/5 border border-border text-muted-foreground text-sm font-semibold disabled:opacity-30"
            >
              Timeout
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
