import { memo } from "react";
import type { LedView } from "@/lib/led-view/types";
import { SIDE_LED_LAYOUT } from "@/lib/broadcast-canvas/constants";

const flexBadgeShellClassName =
  "mx-auto w-full max-w-md border border-amber-400/60 bg-black/15 px-6 py-4 text-center backdrop-blur-[2px]";

const canvasBadgeStyle = {
  position: "absolute" as const,
  left: 60,
  right: 60,
  top: SIDE_LED_LAYOUT.statusBadgeTop,
  margin: "0 auto",
  maxWidth: 480,
  border: "1px solid rgba(251, 191, 36, 0.6)",
  background: "rgba(0,0,0,0.15)",
  padding: "12px 20px",
  textAlign: "center" as const,
  backdropFilter: "blur(2px)",
};

/** Compact break / pause / pre-auction status. */
export const SideBreakBadge = memo(function SideBreakBadge({
  view,
  layout = "canvas",
}: {
  view: LedView;
  layout?: "flex" | "canvas";
}) {
  const { derivedState, breakInfo, pausedSeconds } = view;

  if (derivedState === "paused") {
    if (layout === "flex") {
      return (
        <div className={flexBadgeShellClassName} aria-live="polite">
          <p className="broadcast-kicker" style={{ margin: 0, fontSize: 36, color: "#fbbf24" }}>
            PAUSED
          </p>
          {pausedSeconds != null ? (
            <p className="broadcast-sponsor-footer" style={{ margin: "4px 0 0", fontSize: 28 }}>
              {pausedSeconds}s remaining
            </p>
          ) : null}
        </div>
      );
    }

    return (
      <div style={canvasBadgeStyle} aria-live="polite">
        <p
          className="broadcast-kicker"
          style={{ margin: 0, fontSize: 36, color: "#fbbf24" }}
        >
          PAUSED
        </p>
        {pausedSeconds != null ? (
          <p
            className="broadcast-kicker"
            style={{ margin: "4px 0 0", fontSize: 28, color: "rgba(255,255,255,0.55)" }}
          >
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

  if (layout === "flex") {
    return (
      <div className={flexBadgeShellClassName} aria-live="polite">
        <p className="broadcast-kicker" style={{ margin: 0, fontSize: 36, color: "#fbbf24" }}>
          {title}
        </p>
        {breakInfo.secondsLeft > 0 ? (
          <p className="broadcast-bid-amount" style={{ margin: "4px 0 0", fontSize: 72, color: "rgba(255,255,255,0.95)" }}>
            {mm}:{ss}
          </p>
        ) : null}
        {breakInfo.message ? (
          <p className="broadcast-sponsor-footer" style={{ margin: "8px 0 0", fontSize: 28 }}>
            {breakInfo.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div style={canvasBadgeStyle} aria-live="polite">
      <p
        className="broadcast-kicker"
        style={{ margin: 0, fontSize: 36, color: "#fbbf24" }}
      >
        {title}
      </p>
      {breakInfo.secondsLeft > 0 ? (
        <p
          className="broadcast-bid-amount"
          style={{ margin: "4px 0 0", fontSize: 64, color: "rgba(255,255,255,0.95)" }}
        >
          {mm}:{ss}
        </p>
      ) : null}
      {breakInfo.message ? (
        <p
          className="broadcast-kicker"
          style={{ margin: "4px 0 0", fontSize: 28, color: "rgba(255,255,255,0.55)" }}
        >
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
