export type ScrollRect = {
  top: number;
  bottom: number;
};

/** Ignore sub-pixel overflow so a visible item does not nudge scrollTop. */
const VISIBLE_TOLERANCE_PX = 1;

/**
 * Minimum scroll delta that brings the active link fully inside the sidebar
 * scroller. Zero means the link is already fully visible.
 * Positive scrolls down; negative scrolls up.
 */
export function sidebarActiveScrollDelta(container: ScrollRect, link: ScrollRect): number {
  const fullyVisible =
    link.top >= container.top - VISIBLE_TOLERANCE_PX &&
    link.bottom <= container.bottom + VISIBLE_TOLERANCE_PX;
  if (fullyVisible) return 0;

  if (link.top < container.top) {
    return link.top - container.top;
  }
  return link.bottom - container.bottom;
}
