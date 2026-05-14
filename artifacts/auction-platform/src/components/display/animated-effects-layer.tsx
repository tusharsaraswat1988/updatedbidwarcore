import { memo } from "react";
import { AnimatePresence } from "framer-motion";
import { SoldStamp, SoldCard } from "./sold-animation";
import type { SoldRecord } from "./types";
import type { SoldPhase } from "./use-sold-animation";

/**
 * Stacks the cinematic SOLD effects (stamp + full-screen sold card)
 * over the main player area.
 *
 * Render isolation: receives only `soldPhase` and `soldRecord`. When
 * neither has changed, this subtree is a no-op (React.memo + small
 * primitive props ensures no rerender from bid/timer ticks).
 */
export const AnimatedEffectsLayer = memo(function AnimatedEffectsLayer({ soldPhase, soldRecord }: {
  soldPhase: SoldPhase;
  soldRecord: SoldRecord | null;
}) {
  return (
    <>
      <AnimatePresence>
        {soldPhase === "stamp" && <SoldStamp key="stamp" />}
      </AnimatePresence>
      <AnimatePresence>
        {soldPhase === "card" && soldRecord && <SoldCard key="card" record={soldRecord} />}
      </AnimatePresence>
    </>
  );
});
