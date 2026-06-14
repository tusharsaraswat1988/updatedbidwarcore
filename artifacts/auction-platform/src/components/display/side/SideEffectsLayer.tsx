import { memo } from "react";
import type { LedView } from "@/lib/led-view/types";

/**
 * Side-panel overlays — sold/unsold/pause/break only.
 * Operator display modes (team/player/top5/banner/purse) are never shown here.
 */
export const SideEffectsLayer = memo(function SideEffectsLayer({
  view,
}: {
  view: LedView;
}) {
  const {
    derivedState,
    leadingTeam,
    currentBidLabel,
    currentPlayer,
    basePriceLabel,
    lastOutcome,
    breakInfo,
    pausedSeconds,
  } = view;

  if (derivedState === "sold") {
    const teamName = lastOutcome?.teamName ?? leadingTeam?.name ?? "";
    const teamShort = leadingTeam?.short ?? teamName.slice(0, 3).toUpperCase();
    const teamColor = lastOutcome?.teamColor ?? leadingTeam?.color ?? "#22C55E";
    const photo = lastOutcome?.photoUrl ?? currentPlayer?.portrait ?? "";
    const playerName = lastOutcome?.playerName ?? currentPlayer?.name ?? "";
    const amount = lastOutcome?.amount
      ? `₹${lastOutcome.amount.toLocaleString("en-IN")}`
      : currentBidLabel;

    return (
      <div className="absolute inset-0 z-30 grid place-items-center bg-black/85 p-[6%] pointer-events-none">
        <div
          className="w-full max-w-md border-4 bg-black/90 p-6 text-center"
          style={{
            borderColor: teamColor,
            animation: "auction-sold-slam 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both",
          }}
        >
          {photo ? (
            <img
              src={photo}
              alt={playerName}
              className="mx-auto mb-4 h-32 w-28 object-cover border-2"
              style={{ borderColor: teamColor }}
            />
          ) : null}
          <p
            className="font-['Bebas_Neue'] text-6xl tracking-tighter"
            style={{ color: teamColor }}
          >
            SOLD
          </p>
          <p className="mt-2 font-['Bebas_Neue'] text-2xl tabular-nums text-white">{amount}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-white/60">
            {playerName} → {teamShort}
          </p>
        </div>
      </div>
    );
  }

  if (derivedState === "unsold") {
    const playerName = lastOutcome?.playerName ?? currentPlayer?.name ?? "";
    return (
      <div className="absolute inset-0 z-30 grid place-items-center bg-black/85 p-[6%] pointer-events-none">
        <div
          className="w-full max-w-md border-4 border-red-500 bg-black/90 p-6 text-center"
          style={{ animation: "auction-sold-slam 0.7s ease-out both" }}
        >
          <p className="font-['Bebas_Neue'] text-6xl tracking-tighter text-red-500">UNSOLD</p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white/60">
            {playerName} · Base {basePriceLabel}
          </p>
        </div>
      </div>
    );
  }

  if (derivedState === "paused") {
    return (
      <div className="absolute inset-0 z-30 grid place-items-center bg-black/75 pointer-events-none">
        <div className="border-4 border-amber-400 bg-black/90 px-10 py-8 text-center">
          <p className="font-['Bebas_Neue'] text-5xl tracking-tighter text-amber-400">PAUSED</p>
          {pausedSeconds != null ? (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white/50">
              {pausedSeconds}s remaining
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (derivedState === "break" || derivedState === "preAuction") {
    const mm = Math.floor(breakInfo.secondsLeft / 60).toString().padStart(2, "0");
    const ss = (breakInfo.secondsLeft % 60).toString().padStart(2, "0");
    const title = derivedState === "preAuction" ? "STARTS IN" : "BREAK";
    return (
      <div className="absolute inset-0 z-30 grid place-items-center bg-black/80 pointer-events-none">
        <div className="text-center px-8">
          <p className="font-['Bebas_Neue'] text-4xl tracking-widest text-amber-400">{title}</p>
          {breakInfo.secondsLeft > 0 ? (
            <p className="font-['Bebas_Neue'] text-7xl tabular-nums text-white mt-2">
              {mm}:{ss}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return null;
});
