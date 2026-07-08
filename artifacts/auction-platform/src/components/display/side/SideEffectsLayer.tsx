import { memo } from "react";
import type { LedView } from "@/lib/led-view/types";

/**
 * Side-panel overlays — unsold on player panel only.
 * Sold state is shown in the bid footer (SidePlayerProfilePanel).
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
    currentPlayer,
    basePriceLabel,
    lastOutcome,
  } = view;

  if (panel === "sponsors") {
    return null;
  }

  if (derivedState === "sold") {
    return null;
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
