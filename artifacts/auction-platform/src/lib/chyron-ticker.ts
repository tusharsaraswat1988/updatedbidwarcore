import { useLayoutEffect, useRef, useState } from "react";

/**
 * Target scroll speed for LED chyron tickers (px/s in stage coordinates).
 * Calibrated to the legacy 27.7s / three-copy strip at typical sponsor widths.
 */
export const CHYRON_TICKER_PX_PER_SEC = 55;

const MEASURE_DEBOUNCE_MS = 80;
const WIDTH_CHANGE_THRESHOLD_PX = 2;
const MAX_FRAME_DT_S = 0.05;

/** Fallback until the hidden measure row reports a width. */
export const CHYRON_TICKER_FALLBACK_DURATION_S = 36 / 1.3;
const MIN_DURATION_S = 15;
const MAX_DURATION_S = 90;

export function chyronTickerContentKey(
  items: ReadonlyArray<{ name?: string | null; logoUrl?: string | null; url?: string | null; tier?: string | null; type?: string | null }>,
): string {
  return items
    .map((item) => `${item.name ?? ""}|${item.logoUrl ?? item.url ?? ""}|${item.tier ?? ""}|${item.type ?? ""}`)
    .join(";");
}

export function chyronTickerDurationFromWidth(
  widthPx: number,
  pxPerSec = CHYRON_TICKER_PX_PER_SEC,
): number {
  if (widthPx <= 0) return CHYRON_TICKER_FALLBACK_DURATION_S;
  const seconds = widthPx / pxPerSec;
  return Math.min(MAX_DURATION_S, Math.max(MIN_DURATION_S, seconds));
}

type SeamlessTickerOptions = {
  pxPerSec?: number;
  /** When false, measurement and animation are paused (e.g. static ticker). */
  enabled?: boolean;
};

function readLoopUnitWidth(el: HTMLElement): number {
  return Math.round(el.getBoundingClientRect().width);
}

/**
 * Seamless infinite ticker — measures one loop unit, duplicates it side-by-side,
 * scrolls via rAF (no keyframe loop reset). Loop units must sit flush (no outer gap).
 */
export function useSeamlessTicker(contentKey: string, options: SeamlessTickerOptions = {}) {
  const { pxPerSec = CHYRON_TICKER_PX_PER_SEC, enabled = true } = options;
  const measureRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const [loopWidth, setLoopWidth] = useState(0);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    offsetRef.current = 0;
  }, [contentKey]);

  useLayoutEffect(() => {
    if (!enabled) {
      setLoopWidth(0);
      setReady(false);
      return;
    }

    const measureEl = measureRef.current;
    if (!measureEl) return;

    let debounceId: ReturnType<typeof setTimeout> | undefined;
    let lastCommitted = 0;

    const commitWidth = (nextWidth: number) => {
      if (nextWidth <= 0) return;
      if (Math.abs(nextWidth - lastCommitted) < WIDTH_CHANGE_THRESHOLD_PX) return;
      lastCommitted = nextWidth;
      offsetRef.current %= nextWidth;
      setLoopWidth(nextWidth);
      setReady(true);
    };

    const scheduleMeasure = () => {
      clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        commitWidth(readLoopUnitWidth(measureEl));
      }, MEASURE_DEBOUNCE_MS);
    };

    scheduleMeasure();

    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(measureEl);

    measureEl.querySelectorAll("img").forEach((img) => {
      if (!img.complete) img.addEventListener("load", scheduleMeasure, { once: true });
    });

    return () => {
      ro.disconnect();
      clearTimeout(debounceId);
    };
  }, [contentKey, enabled]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!enabled || !track || loopWidth <= 0) {
      if (track) track.style.transform = "";
      return;
    }

    offsetRef.current %= loopWidth;

    let rafId = 0;
    let lastTs = performance.now();

    const tick = (ts: number) => {
      const dt = Math.min((ts - lastTs) / 1000, MAX_FRAME_DT_S);
      lastTs = ts;
      offsetRef.current += pxPerSec * dt;
      if (offsetRef.current >= loopWidth) {
        offsetRef.current -= loopWidth;
      }
      track.style.transform = `translate3d(-${offsetRef.current}px, 0, 0)`;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      track.style.transform = "";
    };
  }, [loopWidth, contentKey, pxPerSec, enabled]);

  return { measureRef, trackRef, loopWidth, ready };
}

/** @deprecated Use useSeamlessTicker — measure-only helper for legacy call sites. */
export function useChyronTickerDuration(contentKey: string) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [durationS, setDurationS] = useState(CHYRON_TICKER_FALLBACK_DURATION_S);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;

    const update = () => {
      setDurationS(chyronTickerDurationFromWidth(readLoopUnitWidth(el)));
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);

    el.querySelectorAll("img").forEach((img) => {
      if (!img.complete) img.addEventListener("load", update, { once: true });
    });

    return () => ro.disconnect();
  }, [contentKey]);

  return { measureRef, durationS };
}
