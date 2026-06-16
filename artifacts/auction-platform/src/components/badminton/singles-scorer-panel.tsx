import { useState } from "react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { SidePlayerNames } from "@/components/badminton/side-players";
import { cn } from "@/lib/utils";

interface SinglesScorerPanelProps {
  state: BadmintonMatchState;
  onAwardPoint: (side: "left" | "right") => Promise<unknown>;
  onUndo: () => Promise<unknown>;
  onStartTimeout?: (side: "left" | "right") => Promise<unknown>;
  onEndTimeout?: () => Promise<unknown>;
}

export function SinglesScorerPanel({
  state,
  onAwardPoint,
  onUndo,
  onStartTimeout,
  onEndTimeout,
}: SinglesScorerPanelProps) {
  const [busy, setBusy] = useState(false);
  const isTimeout = !!state.activeTimeout;

  async function award(side: "left" | "right") {
    if (busy || state.matchStatus !== "live" || isTimeout) return;
    setBusy(true);
    try {
      await onAwardPoint(side);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0f1e] text-white">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        <div className="flex items-center gap-8 w-full max-w-lg">
          <PlayerScoreCard
            info={state.leftSide}
            matchKind={state.matchKind}
            score={state.leftScore}
            gamesWon={state.gamesLeft}
            isServing={state.servingSide === "left"}
            side="left"
          />
          <div className="text-white/30 text-2xl font-thin">:</div>
          <PlayerScoreCard
            info={state.rightSide}
            matchKind={state.matchKind}
            score={state.rightScore}
            gamesWon={state.gamesRight}
            isServing={state.servingSide === "right"}
            side="right"
          />
        </div>

        <p className="text-white/40 text-xs uppercase tracking-widest">
          Game {state.currentGame} — Who won the rally?
        </p>
      </div>

      <div className="p-4 border-t border-white/10 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => award("left")}
            disabled={busy || isTimeout}
            className="h-20 rounded-2xl bg-[#0070f3]/80 font-black text-lg disabled:opacity-40"
          >
            + {state.leftSide.shortLabel}
          </button>
          <button
            onClick={() => award("right")}
            disabled={busy || isTimeout}
            className="h-20 rounded-2xl bg-[#7c3aed]/80 font-black text-lg disabled:opacity-40"
          >
            + {state.rightSide.shortLabel}
          </button>
        </div>
        <button
          onClick={() => onUndo()}
          disabled={busy || state.totalRallies === 0}
          className="w-full h-12 rounded-xl bg-white/5 text-white/60 text-sm disabled:opacity-30"
        >
          Undo
        </button>
      </div>
    </div>
  );
}

function PlayerScoreCard({
  info,
  matchKind,
  score,
  gamesWon,
  isServing,
  side,
}: {
  info: BadmintonMatchState["leftSide"];
  matchKind: string;
  score: number;
  gamesWon: number;
  isServing: boolean;
  side: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex-1 rounded-2xl p-4 border text-center",
        isServing ? "border-[#ffd700]/50 bg-[#ffd700]/10" : "border-white/10 bg-white/5",
      )}
    >
      <SidePlayerNames info={info} matchKind={matchKind} side={side} stacked className="text-base mb-2" />
      <div
        className={cn(
          "text-6xl font-black tabular-nums",
          side === "left" ? "text-[#00e5ff]" : "text-[#ff6b6b]",
        )}
      >
        {score}
      </div>
      <p className="text-white/30 text-xs mt-1">{gamesWon} games</p>
      {isServing && (
        <p className="text-[#ffd700] text-xs font-bold mt-2">🟡 Serving</p>
      )}
    </div>
  );
}
