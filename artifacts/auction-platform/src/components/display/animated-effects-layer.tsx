import { memo } from "react";
import { AnimatePresence } from "framer-motion";
import { SoldStamp, SoldCard, UnsoldStamp, UnsoldCard } from "./sold-animation";
import type { SoldPhase, SoldRecord, UnsoldRecord } from "./types";

/**
 * Stacks the cinematic SOLD effects (stamp + full-screen sold card)
 * over the main player area.
 *
 * Render isolation: receives only `soldPhase` and `soldRecord`. When
 * neither has changed, this subtree is a no-op (React.memo + small
 * primitive props ensures no rerender from bid/timer ticks).
 */
export const AnimatedEffectsLayer = memo(function AnimatedEffectsLayer({ soldPhase, soldRecord, unsoldPhase, unsoldRecord }: {
  soldPhase: SoldPhase;
  soldRecord: SoldRecord | null;
  unsoldPhase: SoldPhase;
  unsoldRecord: UnsoldRecord | null;
}) {
  return (
    <>
      <AnimatePresence>
        {soldPhase === "stamp" && <SoldStamp key="stamp" />}
      </AnimatePresence>
      <AnimatePresence>
        {soldPhase === "card" && soldRecord && <SoldCard key="card" record={soldRecord} />}
      </AnimatePresence>
      <AnimatePresence>
        {unsoldPhase === "stamp" && <UnsoldStamp key="unsold-stamp" />}
      </AnimatePresence>
      <AnimatePresence>
        {unsoldPhase === "card" && unsoldRecord && <UnsoldCard key="unsold-card" record={unsoldRecord} />}
      </AnimatePresence>
    </>
  );
});
