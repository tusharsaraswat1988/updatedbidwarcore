import { memo } from "react";
import type { LedView } from "@/lib/led-view/types";

const badgeShellClassName =
  "mx-auto w-full max-w-xs border border-amber-400/60 bg-black/15 px-4 py-2 text-center backdrop-blur-[2px]";

/** Compact break / pause / pre-auction status — pinned to screen bottom, no content dimming. */
export const SideBreakBadge = memo(function SideBreakBadge({
  view,
}: {
  view: LedView;
}) {
  const { derivedState, breakInfo, pausedSeconds } = view;

  if (derivedState === "paused") {
    return (
      <div className={badgeShellClassName} aria-live="polite">
        <p className="font-['Bebas_Neue'] text-base tracking-[0.3em] text-amber-400 md:text-lg">
          PAUSED
        </p>
        {pausedSeconds != null ? (
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/55">
            {pausedSeconds}s remaining
          </p>
        ) : null}
      </div>
    );
  }

  if (derivedState !== "break" && derivedState !== "preAuction") {
    return null;
  }

  const mm = Math.floor(breakInfo.secondsLeft / 60).toString().padStart(2, "0");
  const ss = (breakInfo.secondsLeft % 60).toString().padStart(2, "0");
  const title = derivedState === "preAuction" ? "STARTS IN" : "BREAK";

  return (
    <div className={badgeShellClassName} aria-live="polite">
      <p className="font-['Bebas_Neue'] text-base tracking-[0.3em] text-amber-400 md:text-lg">{title}</p>
      {breakInfo.secondsLeft > 0 ? (
        <p className="font-['Bebas_Neue'] text-3xl tabular-nums leading-none text-white/95 md:text-4xl">
          {mm}:{ss}
        </p>
      ) : null}
      {breakInfo.message ? (
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/55">
          {breakInfo.message}
        </p>
      ) : null}
    </div>
  );
});

export function sidePanelShowsStatusBadge(view: LedView): boolean {
  const { derivedState } = view;
  return derivedState === "paused" || derivedState === "break" || derivedState === "preAuction";
}
