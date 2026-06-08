/**
 * Broadcast-safe layout tokens for LED and Broadcast Overlay surfaces.
 * ~5% inset keeps critical UI readable on cropped venue screens (10–50 ft).
 * Pixel constants for the 1920×1080 overlay live in `broadcast-overlay.ts`.
 */
export const BROADCAST_SAFE_X =
  "px-[clamp(1.5rem,5vw,6rem)]";
export const BROADCAST_SAFE_Y =
  "py-[clamp(1rem,3vh,3rem)]";
export const BROADCAST_SAFE_MAIN =
  `${BROADCAST_SAFE_X} ${BROADCAST_SAFE_Y}`;

/** LED main column — uses horizontal space on wide venue panels. */
export const BROADCAST_MAIN_WIDTH =
  "w-full max-w-[min(96vw,88rem)]";

/** Minimum body copy size on the LED main column (specs, labels). */
export const BROADCAST_LABEL_CLASS =
  "text-base md:text-lg lg:text-xl font-mono uppercase tracking-widest";

/** Minimum legible meta row (base price, increment). */
export const BROADCAST_META_CLASS =
  "text-lg md:text-xl lg:text-2xl text-muted-foreground";
