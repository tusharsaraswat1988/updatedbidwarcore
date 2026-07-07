import { memo, type ReactNode } from "react";
import { BROADCAST_TRANSITION_MS } from "./tokens";

type BroadcastAnimatorProps = {
  sceneKey: string;
  isTransitioning: boolean;
  obsMode: boolean;
  children: ReactNode;
};

/**
 * Lightweight GPU-accelerated scene crossfade — no heavy CSS libraries.
 */
export const BroadcastAnimator = memo(function BroadcastAnimator({
  sceneKey,
  isTransitioning,
  obsMode,
  children,
}: BroadcastAnimatorProps) {
  const duration = `${BROADCAST_TRANSITION_MS}ms`;

  return (
    <div
      key={sceneKey}
      style={{
        position: "absolute",
        inset: 0,
        opacity: isTransitioning ? 0 : 1,
        transform: isTransitioning ? "scale(0.985)" : "scale(1)",
        transition: obsMode
          ? `opacity ${duration} ease-out`
          : `opacity ${duration} ease-out, transform ${duration} ease-out`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
});
