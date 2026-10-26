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
          className="w-full max-w-xl border-4 border-red-500 bg-black/95 p-10 text-center shadow-[0_0_60px_rgba(239,68,68,0.35)]"
          style={{ animation: "auction-sold-slam 0.7s ease-out both" }}
        >
          <p className="font-['Bebas_Neue'] text-8xl font-bold tracking-tight text-red-500 drop-shadow-[0_0_24px_rgba(239,68,68,0.6)]">
            UNSOLD
          </p>
          <p className="mt-4 font-['Space_Grotesk'] text-2xl font-bold uppercase tracking-[0.10em] text-white/90">
            {playerName} · Base {basePriceLabel}
          </p>
        </div>
      </div>
    );
  }

  return null;
});
