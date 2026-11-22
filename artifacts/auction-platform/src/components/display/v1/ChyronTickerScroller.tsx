import type { ReactNode } from "react";
import { chyronTickerContentKey, useSeamlessTicker } from "@/lib/chyron-ticker";

/** Inner loop unit — gap lives inside each copy, not between copies. */
const LOOP_UNIT_CLASS = "flex items-center gap-10 whitespace-nowrap shrink-0";
const TRACK_CLASS = "flex items-center whitespace-nowrap will-change-transform";

/**
 * Seamless chyron loop: two flush loop units, constant px/s rAF scroll.
 */
export function ChyronTickerScroller<T>({
  items,
  renderItem,
  pxPerSec,
  enabled = true,
  loopGapClass = "gap-10",
}: {
  items: readonly T[];
  renderItem: (item: T, index: number) => ReactNode;
  /** Override scroll speed (OBS CEF uses a lower value). */
  pxPerSec?: number;
  /** Pause measurement + animation (e.g. match-point strip). */
  enabled?: boolean;
  loopGapClass?: string;
}) {
  const contentKey = chyronTickerContentKey(
    items as ReadonlyArray<{ name?: string | null; logoUrl?: string | null; url?: string | null; tier?: string | null; type?: string | null }>,
  );
  const { measureRef, trackRef, ready } = useSeamlessTicker(contentKey, {
    pxPerSec,
    enabled,
  });

  const unitClass = `flex items-center whitespace-nowrap shrink-0 ${loopGapClass}`;

  return (
    <div
      ref={trackRef}
      className={TRACK_CLASS}
      style={{ opacity: ready ? 1 : 0 }}
      aria-hidden
    >
      <div ref={measureRef} className={unitClass}>
        {items.map((item, index) => renderItem(item, index))}
      </div>
      <div className={unitClass} aria-hidden>
        {items.map((item, index) => renderItem(item, index))}
      </div>
    </div>
  );
}
