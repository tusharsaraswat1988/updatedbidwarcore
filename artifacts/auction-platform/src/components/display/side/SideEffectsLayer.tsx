import { memo } from "react";
import type { LedView } from "@/lib/led-view/types";

/**
 * Side-panel overlays — sold / unsold on player panel only.
 * Sponsors panel keeps carousel running; pause/break use SideBreakBadge.
 */
export const SideEffectsLayer = memo(function SideEffectsLayer({
  view,
  panel = "player",
}: {
  view: LedView;
  panel?: "sponsors" | "player";
}) {
  const {
    derivedState,
    leadingTeam,
    currentBidLabel,
    currentPlayer,
    basePriceLabel,
    lastOutcome,
  } = view;

  if (panel === "sponsors") {
    return null;
  }

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

  return null;
});
