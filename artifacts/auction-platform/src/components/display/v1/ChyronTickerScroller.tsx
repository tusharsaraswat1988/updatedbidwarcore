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
}: {
  items: readonly T[];
  renderItem: (item: T, index: number) => ReactNode;
}) {
  const contentKey = chyronTickerContentKey(
    items as ReadonlyArray<{ name?: string | null; logoUrl?: string | null; url?: string | null; tier?: string | null; type?: string | null }>,
  );
  const { measureRef, trackRef, ready } = useSeamlessTicker(contentKey);

  return (
    <div
      ref={trackRef}
      className={TRACK_CLASS}
      style={{ opacity: ready ? 1 : 0 }}
      aria-hidden
    >
      <div ref={measureRef} className={LOOP_UNIT_CLASS}>
        {items.map((item, index) => renderItem(item, index))}
      </div>
      <div className={LOOP_UNIT_CLASS} aria-hidden>
        {items.map((item, index) => renderItem(item, index))}
      </div>
    </div>
  );
}
