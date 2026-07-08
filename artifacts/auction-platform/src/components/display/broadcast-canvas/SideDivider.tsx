import { SIDE_LED_LAYOUT } from "@/lib/broadcast-canvas/constants";

/** Horizontal rule below tournament header. */
export function SideDivider({ top = SIDE_LED_LAYOUT.dividerTop }: { top?: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        top,
        height: SIDE_LED_LAYOUT.dividerHeight,
        background:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
      }}
    />
  );
}
