import { useLayoutEffect, useRef, useState } from "react";

/**
 * Target scroll speed for LED chyron tickers (px/s in stage coordinates).
 * Calibrated to the legacy 27.7s / three-copy strip at typical sponsor widths.
 */
export const CHYRON_TICKER_PX_PER_SEC = 55;

const MIN_DURATION_S = 15;
const MAX_DURATION_S = 90;

/** Fallback until the hidden measure row reports a width. */
export const CHYRON_TICKER_FALLBACK_DURATION_S = 36 / 1.3;

export function chyronTickerContentKey(
  items: ReadonlyArray<{ name?: string | null; logoUrl?: string | null; url?: string | null; tier?: string | null; type?: string | null }>,
): string {
  return items
    .map((item) => `${item.name ?? ""}|${item.logoUrl ?? item.url ?? ""}|${item.tier ?? ""}|${item.type ?? ""}`)
    .join(";");
}

export function chyronTickerDurationFromWidth(widthPx: number): number {
  if (widthPx <= 0) return CHYRON_TICKER_FALLBACK_DURATION_S;
  const seconds = widthPx / CHYRON_TICKER_PX_PER_SEC;
  return Math.min(MAX_DURATION_S, Math.max(MIN_DURATION_S, seconds));
}

export function useChyronTickerDuration(contentKey: string) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [durationS, setDurationS] = useState(CHYRON_TICKER_FALLBACK_DURATION_S);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;

    const update = () => {
      setDurationS(chyronTickerDurationFromWidth(el.scrollWidth));
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);

    const onImageLoad = () => update();
    el.querySelectorAll("img").forEach((img) => {
      if (!img.complete) img.addEventListener("load", onImageLoad, { once: true });
    });

    return () => ro.disconnect();
  }, [contentKey]);

  return { measureRef, durationS };
}
