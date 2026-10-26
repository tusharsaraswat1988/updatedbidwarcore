/** Shared homepage mobile chrome math. Kept pure so layout rules can be tested without a browser. */

export const HOME_SCROLL_TOP_THRESHOLD = 350;

export function isPastScrollThreshold(
  scrollY: number,
  threshold = HOME_SCROLL_TOP_THRESHOLD,
): boolean {
  return scrollY > threshold;
}

export function scrollBehavior(prefersReducedMotion: boolean): ScrollBehavior {
  return prefersReducedMotion ? "auto" : "smooth";
}

/** Content clearance for the fixed mobile trial bar. Desktop and a hidden bar reserve nothing. */
export function stickyContentOffsetPx(barHeight: number, viewportAtLeastMd: boolean): number {
  if (viewportAtLeastMd || !Number.isFinite(barHeight) || barHeight <= 0) return 0;
  return Math.ceil(barHeight);
}

/** Horizontal scroll offset that centers a tab inside its own scroller, never the document. */
export function centeredScrollLeft(
  containerWidth: number,
  childLeft: number,
  childWidth: number,
): number {
  if (containerWidth <= 0) return 0;
  return Math.max(0, childLeft - (containerWidth - childWidth) / 2);
}
