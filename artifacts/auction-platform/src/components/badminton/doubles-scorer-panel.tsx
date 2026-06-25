import { useState } from "react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { getSidePlayerSlots } from "@workspace/badminton-core";
import { DoublesCourtDisplay } from "@/components/badminton/doubles-court-display";
import { cn } from "@/lib/utils";

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

  const leftPlayers = getSidePlayerSlots(state.leftSide);
  const rightPlayers = getSidePlayerSlots(state.rightSide);
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

  const leftPairLabel = leftPlayers.map((p) => p.shortLabel || p.label).join(" / ");
  const rightPairLabel = rightPlayers.map((p) => p.shortLabel || p.label).join(" / ");

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col items-center justify-center">
        <DoublesCourtDisplay state={state} variant="scorer" className="max-w-[280px] w-full" />

        {isTimeout && (
          <div className="mt-3 w-full rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-amber-300 text-sm font-bold text-center">
            Timeout in progress
          </div>
        )}

        {lastAction && (
          <p className="mt-2 text-red-400 text-sm text-center">{lastAction}</p>
        )}
      </div>

      <div className="shrink-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-white/10 space-y-2 bg-[#070b16]">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => award("left")}
            disabled={cannotScore}
            className={cn(
              "min-h-[5.5rem] sm:min-h-[6.5rem] rounded-2xl font-black text-base sm:text-lg active:scale-[0.98]",
              "bg-[#0070f3] text-white disabled:opacity-40",
            )}
          >
            + {leftPairLabel}
          </button>
          <button
            type="button"
            onClick={() => award("right")}
            disabled={cannotScore}
            className={cn(
              "min-h-[5.5rem] sm:min-h-[6.5rem] rounded-2xl font-black text-base sm:text-lg active:scale-[0.98]",
              "bg-[#7c3aed] text-white disabled:opacity-40",
            )}
          >
            + {rightPairLabel}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={undoBusy || state.totalRallies === 0}
            className="flex-1 min-h-12 rounded-xl bg-white/5 border border-white/10 text-white/55 text-sm font-semibold disabled:opacity-30"
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
              className="flex-1 min-h-12 rounded-xl bg-white/5 border border-white/10 text-white/55 text-sm font-semibold disabled:opacity-30"
            >
              Timeout
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
