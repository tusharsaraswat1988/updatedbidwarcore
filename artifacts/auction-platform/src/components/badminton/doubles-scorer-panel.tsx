import { useState } from "react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { DoublesCourtDisplay } from "@/components/badminton/doubles-court-display";
import { cn } from "@/lib/utils";
import { identityFromSideInfo } from "@/lib/team-player-identity";

interface DoublesScorerPanelProps {
  state: BadmintonMatchState;
  onAwardPoint: (side: "left" | "right") => void | Promise<unknown>;
  onUndo: () => Promise<unknown>;
  onStartTimeout?: (side: "left" | "right") => Promise<unknown>;
  onEndTimeout?: () => Promise<unknown>;
  scoringBlocked?: boolean;
}

export function DoublesScorerPanel({
  state,
  onAwardPoint,
  onUndo,
  onStartTimeout,
  onEndTimeout,
  scoringBlocked = false,
}: DoublesScorerPanelProps) {
  const [undoBusy, setUndoBusy] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const isTimeout = !!state.activeTimeout;
  const cannotScore = isTimeout || scoringBlocked || state.matchStatus !== "live";

  function award(side: "left" | "right") {
    if (cannotScore) return;
    setLastAction(null);
    const result = onAwardPoint(side);
    if (result && typeof (result as Promise<unknown>).catch === "function") {
      void (result as Promise<unknown>).catch((e) => {
        setLastAction(e instanceof Error ? e.message : "Failed to score");
      });
    }
  }

  async function undo() {
    if (undoBusy) return;
    setUndoBusy(true);
    try {
      await onUndo();
    } catch (e) {
      setLastAction(e instanceof Error ? e.message : "Undo failed");
    } finally {
      setUndoBusy(false);
    }
  }

  // Score buttons use player names only — team identity lives on scoreboards / strip.
  const leftPairLabel = identityFromSideInfo(state.leftSide).playerName;
  const rightPairLabel = identityFromSideInfo(state.rightSide).playerName;

  return (
    <div className="h-full min-h-0 overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0 overflow-hidden px-3 py-1.5 flex flex-col items-center justify-center gap-1.5">
        {(state.isPaused || state.matchStatus === "paused") && (
          <div
            className="shrink-0 w-full rounded-lg bg-amber-600/20 border border-amber-400/40 px-3 py-1.5 text-amber-100 text-xs font-bold text-center"
            role="status"
          >
            Scoring locked — director must resume
          </div>
        )}

        {isTimeout && (
          <div className="shrink-0 w-full rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-amber-300 text-xs font-bold text-center">
            Timeout in progress
          </div>
        )}

        {lastAction && (
          <p className="shrink-0 text-red-400 text-xs text-center truncate w-full">{lastAction}</p>
        )}

        <div className="flex-1 min-h-0 w-full max-w-[320px] flex items-center justify-center overflow-hidden">
          <DoublesCourtDisplay
            state={state}
            variant="scorer"
            className="w-full max-h-full"
          />
        </div>
      </div>

      <div className="shrink-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border space-y-2 bg-card/90">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => award("left")}
            disabled={cannotScore}
            className={cn(
              "h-[5.5rem] sm:h-[6.5rem] rounded-2xl font-black text-sm sm:text-base active:scale-[0.98] px-2",
              "bg-primary text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-40",
            )}
          >
            <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">
              End 1
            </span>
            + {leftPairLabel}
          </button>
          <button
            type="button"
            onClick={() => award("right")}
            disabled={cannotScore}
            className={cn(
              "h-[5.5rem] sm:h-[6.5rem] rounded-2xl font-black text-sm sm:text-base active:scale-[0.98] px-2",
              "bg-sky-500 text-white disabled:opacity-40",
            )}
          >
            <span className="block text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1">
              End 2
            </span>
            + {rightPairLabel}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={undoBusy || state.totalRallies === 0}
            className="flex-1 min-h-12 rounded-xl bg-white/5 border border-border text-muted-foreground text-sm font-semibold disabled:opacity-30"
          >
            Undo
          </button>
          {isTimeout && onEndTimeout ? (
            <button
              type="button"
              onClick={() => onEndTimeout()}
              className="flex-1 min-h-12 rounded-xl bg-amber-600/30 border border-amber-500/40 text-amber-300 text-sm font-semibold"
            >
              End timeout
            </button>
          ) : onStartTimeout ? (
            <button
              type="button"
              onClick={() => onStartTimeout(state.doublesServe?.servingSide ?? "left")}
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
