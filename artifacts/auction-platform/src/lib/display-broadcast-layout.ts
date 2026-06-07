/**
 * Broadcast-safe layout tokens for LED / OBS overlays.
 * ~5% inset keeps critical UI readable on cropped venue screens (30–50 ft).
 */
export const BROADCAST_SAFE_X =
  "px-[clamp(1.25rem,5vw,6rem)]";
export const BROADCAST_SAFE_Y =
  "py-[clamp(0.75rem,2.5vh,2.5rem)]";
export const BROADCAST_SAFE_MAIN =
  `${BROADCAST_SAFE_X} ${BROADCAST_SAFE_Y}`;

/** Minimum body copy size on the LED main column (specs, labels). */
export const BROADCAST_LABEL_CLASS =
  "text-sm md:text-base lg:text-lg font-mono uppercase tracking-widest";

/** Minimum legible meta row (base price, increment). */
export const BROADCAST_META_CLASS =
  "text-base md:text-lg lg:text-xl text-muted-foreground";
