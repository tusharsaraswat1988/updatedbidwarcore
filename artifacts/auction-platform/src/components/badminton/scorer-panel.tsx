/**
 * Professional Badminton Scorer Panel
 *
 * Design principles:
 * - Huge, finger-friendly touch targets
 * - High contrast for court-side use
 * - Minimal cognitive load — action-driven, no forms
 * - Single-hand operable on mobile
 * - Real-time state with optimistic UI
 */

import { useState, useCallback } from "react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { cn } from "@/lib/utils";

interface ScorerPanelProps {
  tournamentId: number;
  matchId: number;
  state: BadmintonMatchState;
  onAwardPoint: (side: "left" | "right") => Promise<unknown>;
  onUndo: () => Promise<unknown>;
  onStartTimeout: (side: "left" | "right", kind?: "regular" | "medical") => Promise<unknown>;
  onEndTimeout: () => Promise<unknown>;
  onRetirement: (retiringSide: "left" | "right") => Promise<unknown>;
  onWalkover: (winningSide: "left" | "right") => Promise<unknown>;
}

export function ScorerPanel({
  tournamentId,
  matchId,
  state,
  onAwardPoint,
  onUndo,
  onStartTimeout,
  onEndTimeout,
  onRetirement,
  onWalkover,
}: ScorerPanelProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | {
    label: string;
    action: () => Promise<unknown>;
  }>(null);
  const [showExtras, setShowExtras] = useState(false);

  const execute = useCallback(
    async (key: string, fn: () => Promise<unknown>) => {
      if (pending) return;
      setPending(key);
      try {
        await fn();
      } catch (e) {
        console.error(e);
      } finally {
        setPending(null);
      }
    },
    [pending],
  );

  const confirm = useCallback(
    (label: string, action: () => Promise<unknown>) => {
      setConfirmAction({ label, action: action as () => Promise<void> });
    },
    [],
  );

  const isLive = state.matchStatus === "live";
  const isFinished =
    state.matchStatus === "completed" ||
    state.matchStatus === "retired" ||
    state.matchStatus === "walkover";

  const currentGame = state.games[state.currentGame - 1];

  return (
    <div className="h-full flex flex-col bg-[#0a0f1e] text-white select-none overflow-hidden">
      {/* Match info bar */}
      <div className="flex-none bg-gradient-to-r from-[#0d1529] to-[#141f3a] border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium tracking-widest uppercase text-[#4fc3f7] opacity-80">
            {state.matchKind.replace("_", " ")}
          </p>
          <p className="text-sm font-semibold text-white/90 mt-0.5">
            Game {state.currentGame} of {state.format.totalGames}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Game dots */}
          {Array.from({ length: state.format.totalGames }).map((_, i) => {
            const gameNum = i + 1;
            const game = state.games[i];
            const isWon = game?.phase === "completed";
            const leftWon = game?.winner === "left";
            return (
              <div key={gameNum} className="flex flex-col items-center gap-0.5">
                <div
                  className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    !game ? "bg-white/10" :
                    leftWon ? "bg-[#00e5ff]" : "bg-white/20",
                  )}
                />
                <div
                  className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    !game ? "bg-white/10" :
                    !leftWon ? "bg-[#ff6b6b]" : "bg-white/20",
                  )}
                />
              </div>
            );
          })}
        </div>
        <StatusBadge status={state.matchStatus} />
      </div>

      {/* Main scoreboard */}
      <div className="flex-none grid grid-cols-2 gap-px bg-white/5">
        {/* Left side */}
        <ScorerSide
          label={state.leftSide.label}
          shortLabel={state.leftSide.shortLabel}
          countryCode={state.leftSide.countryCode}
          score={state.leftScore}
          gamesWon={state.gamesLeft}
          isServing={state.servingSide === "left"}
          isWinner={state.winnerSide === "left"}
          side="left"
          disabled={!isLive || !!pending || !!state.activeTimeout}
          pending={pending === "left"}
          onPoint={() => execute("left", () => onAwardPoint("left"))}
        />
        {/* Right side */}
        <ScorerSide
          label={state.rightSide.label}
          shortLabel={state.rightSide.shortLabel}
          countryCode={state.rightSide.countryCode}
          score={state.rightScore}
          gamesWon={state.gamesRight}
          isServing={state.servingSide === "right"}
          isWinner={state.winnerSide === "right"}
          side="right"
          disabled={!isLive || !!pending || !!state.activeTimeout}
          pending={pending === "right"}
          onPoint={() => execute("right", () => onAwardPoint("right"))}
        />
      </div>

      {/* Game progress bar */}
      {isLive && (
        <div className="flex-none px-4 pt-3 pb-1">
          <div className="flex items-center justify-between text-xs text-white/40 mb-1">
            <span>0</span>
            <span className="font-semibold text-white/60">
              {state.leftScore + state.rightScore} rallies
            </span>
            <span>{state.format.pointsPerGame}</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-gradient-to-r from-[#00e5ff] to-[#0070f3] transition-all duration-300"
              style={{
                width: `${(state.leftScore / (state.leftScore + state.rightScore || 1)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Active timeout banner */}
      {state.activeTimeout && (
        <div className="flex-none mx-4 mt-2 bg-amber-500/20 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-300 text-sm font-medium">
              {state.activeTimeout.side === "left" ? state.leftSide.shortLabel : state.rightSide.shortLabel} Timeout
            </span>
          </div>
          <button
            onClick={() => execute("end-timeout", onEndTimeout)}
            className="bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
          >
            Resume
          </button>
        </div>
      )}

      {/* Control row */}
      <div className="flex-none px-4 pt-3 grid grid-cols-3 gap-2">
        {/* Undo */}
        <button
          onClick={() => execute("undo", onUndo)}
          disabled={!isLive || !!pending || state.totalRallies === 0}
          className={cn(
            "h-14 rounded-xl font-bold text-sm flex flex-col items-center justify-center gap-1 transition-all active:scale-95",
            "bg-white/8 hover:bg-white/12 border border-white/10",
            "disabled:opacity-30 disabled:cursor-not-allowed",
          )}
        >
          <svg className="w-5 h-5 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M3 7v6h6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-white/60 text-xs">Undo</span>
        </button>

        {/* Center game indicator */}
        <div className="h-14 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center">
          <span className="text-xs text-white/40 uppercase tracking-widest">Game</span>
          <span className="text-2xl font-black text-white leading-none">
            {state.gamesLeft}–{state.gamesRight}
          </span>
        </div>

        {/* More actions */}
        <button
          onClick={() => setShowExtras((v) => !v)}
          className={cn(
            "h-14 rounded-xl font-bold text-sm flex flex-col items-center justify-center gap-1 transition-all active:scale-95",
            showExtras
              ? "bg-[#1a2744] border border-[#4fc3f7]/40"
              : "bg-white/8 hover:bg-white/12 border border-white/10",
          )}
        >
          <svg className="w-5 h-5 text-white/70" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
          <span className="text-white/60 text-xs">More</span>
        </button>
      </div>

      {/* Expanded extras */}
      {showExtras && isLive && (
        <div className="flex-none px-4 pt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => execute("timeout-left", () => onStartTimeout("left", "regular"))}
            disabled={!!state.activeTimeout || !!pending}
            className="h-12 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-30 transition-colors"
          >
            <span>⏱</span> TO — {state.leftSide.shortLabel}
          </button>
          <button
            onClick={() => execute("timeout-right", () => onStartTimeout("right", "regular"))}
            disabled={!!state.activeTimeout || !!pending}
            className="h-12 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-30 transition-colors"
          >
            <span>⏱</span> TO — {state.rightSide.shortLabel}
          </button>
          <button
            onClick={() => confirm("Medical Timeout — Left", () => onStartTimeout("left", "medical"))}
            disabled={!!state.activeTimeout || !!pending}
            className="h-12 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-30 transition-colors"
          >
            <span>🏥</span> Medical — L
          </button>
          <button
            onClick={() => confirm("Medical Timeout — Right", () => onStartTimeout("right", "medical"))}
            disabled={!!state.activeTimeout || !!pending}
            className="h-12 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-30 transition-colors"
          >
            <span>🏥</span> Medical — R
          </button>
          <button
            onClick={() => confirm(`Retirement — ${state.leftSide.shortLabel}`, () => onRetirement("left"))}
            className="h-12 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <span>🚫</span> Retire — L
          </button>
          <button
            onClick={() => confirm(`Retirement — ${state.rightSide.shortLabel}`, () => onRetirement("right"))}
            className="h-12 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <span>🚫</span> Retire — R
          </button>
          <button
            onClick={() => confirm(`Walkover — ${state.leftSide.shortLabel} wins`, () => onWalkover("left"))}
            className="h-12 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 text-xs font-semibold flex items-center justify-center gap-2 col-span-2 transition-colors"
          >
            <span>🏆</span> Walkover — {state.leftSide.shortLabel} wins
          </button>
        </div>
      )}

      {/* Match complete banner */}
      {isFinished && (
        <div className="flex-none mx-4 mt-3 rounded-2xl overflow-hidden">
          <div className={cn(
            "p-4 text-center",
            state.winnerSide === "left"
              ? "bg-gradient-to-r from-[#00e5ff]/20 to-[#0070f3]/10 border border-[#00e5ff]/20"
              : "bg-gradient-to-r from-[#ff6b6b]/20 to-[#ff4757]/10 border border-[#ff6b6b]/20",
          )}>
            <p className="text-xs text-white/50 uppercase tracking-widest">Match Over</p>
            <p className="text-lg font-black text-white mt-1">
              {state.winnerSide === "left" ? state.leftSide.label : state.rightSide.label}
            </p>
            <p className="text-sm text-white/60">
              Wins {state.gamesLeft}–{state.gamesRight}
            </p>
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Rally history strip */}
      <GameHistoryStrip games={state.games} />

      {/* Confirmation dialog */}
      {confirmAction && (
        <ConfirmDialog
          label={confirmAction.label}
          onConfirm={() => {
            void execute("confirm", confirmAction.action as () => Promise<unknown>);
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ScorerSideProps {
  label: string;
  shortLabel: string;
  countryCode?: string;
  score: number;
  gamesWon: number;
  isServing: boolean;
  isWinner: boolean;
  side: "left" | "right";
  disabled: boolean;
  pending: boolean;
  onPoint: () => void;
}

function ScorerSide({
  label,
  shortLabel,
  score,
  gamesWon,
  isServing,
  isWinner,
  side,
  disabled,
  pending,
  onPoint,
}: ScorerSideProps) {
  return (
    <button
      onClick={onPoint}
      disabled={disabled}
      className={cn(
        "relative flex flex-col items-center justify-center py-6 px-3",
        "min-h-[200px] touch-manipulation transition-all duration-150",
        "active:scale-[0.97] disabled:cursor-not-allowed",
        side === "left"
          ? "bg-gradient-to-br from-[#061a3a] to-[#0d2560]"
          : "bg-gradient-to-bl from-[#1a0620] to-[#2d0a3a]",
        pending && "opacity-80",
      )}
    >
      {/* Serve indicator */}
      {isServing && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#ffd700] animate-pulse" />
          <span className="text-[10px] font-bold text-[#ffd700] tracking-widest uppercase">Serving</span>
        </div>
      )}

      {/* Winner crown */}
      {isWinner && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-2xl">🏆</div>
      )}

      {/* Player name */}
      <p className={cn(
        "text-xs font-semibold uppercase tracking-wider mb-2",
        side === "left" ? "text-[#4fc3f7]" : "text-[#ce93d8]",
      )}>
        {shortLabel}
      </p>

      {/* Big score */}
      <div className={cn(
        "text-8xl font-black leading-none tabular-nums",
        "transition-all duration-150",
        side === "left" ? "text-[#00e5ff]" : "text-[#ff6b6b]",
        disabled && !isWinner && "opacity-40",
        pending && "scale-110",
      )}>
        {score}
      </div>

      {/* Games won dots */}
      <div className="flex items-center gap-1.5 mt-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-3 h-3 rounded-full border",
              i < gamesWon
                ? side === "left"
                  ? "bg-[#00e5ff] border-[#00e5ff]"
                  : "bg-[#ff6b6b] border-[#ff6b6b]"
                : "bg-transparent border-white/20",
            )}
          />
        ))}
      </div>

      {/* Tap hint for unstarted */}
      {!disabled && (
        <p className="text-xs text-white/20 mt-3 font-medium">TAP TO SCORE</p>
      )}

      {/* Pending ripple */}
      {pending && (
        <div className="absolute inset-0 pointer-events-none">
          <div className={cn(
            "absolute inset-0 rounded-lg",
            side === "left" ? "bg-[#00e5ff]/10" : "bg-[#ff6b6b]/10",
          )} />
        </div>
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    scheduled: { label: "Scheduled", color: "bg-white/10 text-white/50" },
    live: { label: "LIVE", color: "bg-red-500 text-white animate-pulse" },
    completed: { label: "Completed", color: "bg-green-500/20 text-green-300" },
    walkover: { label: "W/O", color: "bg-purple-500/20 text-purple-300" },
    retired: { label: "Retired", color: "bg-orange-500/20 text-orange-300" },
  };
  const { label, color } = map[status] ?? { label: status, color: "bg-white/10 text-white/50" };
  return (
    <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full", color)}>
      {label}
    </span>
  );
}

function GameHistoryStrip({ games }: { games: BadmintonMatchState["games"] }) {
  const completed = games.filter((g) => g.phase === "completed");
  if (completed.length === 0) return null;

  return (
    <div className="flex-none border-t border-white/5 px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Games</span>
        {completed.map((g) => (
          <div
            key={g.gameNumber}
            className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2.5 py-1"
          >
            <span className="text-xs font-bold text-[#00e5ff]">{g.leftScore}</span>
            <span className="text-white/30 text-xs">–</span>
            <span className="text-xs font-bold text-[#ff6b6b]">{g.rightScore}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmDialog({
  label,
  onConfirm,
  onCancel,
}: {
  label: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}) {
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-[#0d1529] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
        <p className="text-center text-white/60 text-sm uppercase tracking-widest mb-2">Confirm Action</p>
        <p className="text-center text-white text-xl font-bold mb-8">{label}</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            className="h-14 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="h-14 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
