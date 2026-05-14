import { memo, type ReactNode } from "react";

/**
 * Root broadcast container. Renders the full-height gradient backdrop
 * that subtly shifts hue with the leading team's color.
 *
 * Performance note: the gradient hue is driven by `teamColor` only,
 * which changes infrequently (once per leading-team swap). Bid/timer
 * updates do not propagate here because this component is memoized
 * and `teamColor` is a primitive string compared by shallow equality.
 */
export const StaticBackground = memo(function StaticBackground({ teamColor, children }: {
  teamColor: string;
  children: ReactNode;
}) {
  return (
    <div
      className="h-screen flex flex-col select-none relative overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 30% 20%, ${teamColor}18 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, ${teamColor}12 0%, transparent 55%), #09090b`,
        transition: "background 0.8s ease",
      }}
    >
      {children}
    </div>
  );
});
