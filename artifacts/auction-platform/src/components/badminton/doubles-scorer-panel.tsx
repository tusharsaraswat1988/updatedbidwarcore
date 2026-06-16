import { useState } from "react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import {
  getSidePlayerSlots,
} from "@workspace/badminton-core";
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
    <div className="h-full flex flex-col bg-[#0a0f1e] text-white overflow-hidden">
      {/* Score header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-stretch gap-3">
          <TeamScoreBlock
            pairLabel={leftPairLabel}
            score={state.leftScore}
            gamesWon={state.gamesLeft}
            accent="left"
          />
          <div className="flex flex-col items-center justify-center px-2">
            <span className="text-white/30 text-xs font-semibold">G{state.currentGame}</span>
            <span className="text-white/20 text-lg">:</span>
          </div>
          <TeamScoreBlock
            pairLabel={rightPairLabel}
            score={state.rightScore}
            gamesWon={state.gamesRight}
            accent="right"
          />
        </div>
      </div>

      {/* Court visualization */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col items-center justify-center min-h-0">
        <DoublesCourtDisplay state={state} variant="scorer" className="max-w-sm w-full" />

        {isTimeout && (
          <div className="mt-4 bg-amber-500/20 border border-amber-500/40 rounded-xl px-4 py-2 text-amber-300 text-sm font-bold">
            TIMEOUT IN PROGRESS
          </div>
        )}

        {lastAction && (
          <p className="mt-3 text-red-400 text-sm text-center">{lastAction}</p>
        )}
      </div>

      {/* Scoring actions — rally winner only */}
      <div className="shrink-0 p-4 border-t border-white/10 space-y-3 bg-[#070b16]">
        <p className="text-white/40 text-xs text-center uppercase tracking-widest font-semibold">
          Who won the rally?
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => award("left")}
            disabled={cannotScore}
            className={cn(
              "h-24 rounded-2xl font-black text-lg active:scale-[0.98]",
              "bg-gradient-to-br from-[#0070f3] to-[#00a8ff] text-white",
              "disabled:opacity-40 shadow-lg shadow-[#0070f3]/20",
            )}
          >
            <span className="block text-xs font-semibold opacity-70 mb-1">+ Point</span>
            {leftPairLabel}
          </button>
          <button
            onClick={() => award("right")}
            disabled={cannotScore}
            className={cn(
              "h-24 rounded-2xl font-black text-lg active:scale-[0.98]",
              "bg-gradient-to-br from-[#7c3aed] to-[#ff6b6b] text-white",
              "disabled:opacity-40 shadow-lg shadow-[#7c3aed]/20",
            )}
          >
            <span className="block text-xs font-semibold opacity-70 mb-1">+ Point</span>
            {rightPairLabel}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={undoBusy || state.totalRallies === 0}
            className="flex-1 h-12 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm font-semibold disabled:opacity-30"
          >
            Undo Last Point
          </button>
          {isTimeout && onEndTimeout ? (
            <button
              onClick={() => onEndTimeout()}
              className="flex-1 h-12 rounded-xl bg-amber-600/30 border border-amber-500/40 text-amber-300 text-sm font-semibold"
            >
              End Timeout
            </button>
          ) : onStartTimeout ? (
            <button
              onClick={() => onStartTimeout(state.doublesServe?.servingSide ?? "left")}
              disabled={undoBusy || state.matchStatus !== "live"}
              className="flex-1 h-12 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm font-semibold disabled:opacity-30"
            >
              Timeout
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TeamScoreBlock({
  pairLabel,
  score,
  gamesWon,
  accent,
}: {
  pairLabel: string;
  score: number;
  gamesWon: number;
  accent: "left" | "right";
}) {
  return (
    <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-3">
      <p className="text-white/60 text-xs font-semibold truncate mb-1">{pairLabel}</p>
      <div className="flex items-end justify-between">
        <span
          className={cn(
            "text-5xl font-black tabular-nums leading-none",
            accent === "left" ? "text-[#00e5ff]" : "text-[#ff6b6b]",
          )}
        >
          {score}
        </span>
        <span className="text-white/30 text-sm font-bold">{gamesWon} games</span>
      </div>
    </div>
  );
}
