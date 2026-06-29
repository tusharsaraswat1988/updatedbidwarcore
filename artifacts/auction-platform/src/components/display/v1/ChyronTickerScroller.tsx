import type { ReactNode } from "react";
import { chyronTickerContentKey, useChyronTickerDuration } from "@/lib/chyron-ticker";

const TRACK_CLASS = "flex items-center gap-10 whitespace-nowrap";

/**
 * Seamless chyron loop: measure one copy, animate two copies at constant px/s.
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
  const { measureRef, durationS } = useChyronTickerDuration(contentKey);
  const loop = [...items, ...items];

  return (
    <>
      <div
        ref={measureRef}
        aria-hidden
        className={`absolute invisible pointer-events-none h-full ${TRACK_CLASS}`}
      >
        {items.map((item, index) => renderItem(item, index))}
      </div>
      <div
        className={`${TRACK_CLASS} will-change-transform`}
        style={{ animation: `auction-ticker-scroll ${durationS}s linear infinite` }}
        aria-hidden
      >
        {loop.map((item, index) => renderItem(item, index))}
      </div>
    </>
  );
}
