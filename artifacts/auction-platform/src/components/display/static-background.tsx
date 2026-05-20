import { memo, type ReactNode } from "react";
import type { DisplayTheme } from "@/lib/display-theme";

/**
 * Root broadcast container. Renders the full-height gradient backdrop
 * that subtly shifts hue with the leading team's color.
 *
 * Performance note: the gradient hue is driven by `teamColor` only,
 * which changes infrequently (once per leading-team swap). Bid/timer
 * updates do not propagate here because this component is memoized
 * and `teamColor` is a primitive string compared by shallow equality.
 *
 * The `theme` prop adds a static secondary glow and base background
 * colour per aesthetic. It is stable for the lifetime of the display
 * session (set once from the URL param) so it never triggers extra
 * rerenders during an active auction.
 */
export const StaticBackground = memo(function StaticBackground({
  teamColor,
  theme,
  children,
}: {
  teamColor: string;
  theme?: DisplayTheme;
  children: ReactNode;
}) {
  const base = theme?.bg ?? "#09090b";
  const secondary = theme?.secondaryGlow ?? null;

  const bgParts = [
    `radial-gradient(ellipse at 30% 20%, ${teamColor}18 0%, transparent 55%)`,
    `radial-gradient(ellipse at 70% 80%, ${teamColor}12 0%, transparent 55%)`,
    secondary
      ? `radial-gradient(ellipse at 85% 8%, ${secondary}0e 0%, transparent 45%)`
      : null,
    base,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="h-screen flex flex-col select-none relative overflow-hidden"
      style={{ background: bgParts, transition: "background 0.8s ease" }}
    >
      {children}
    </div>
  );
});
