import type { CSSProperties, ReactNode } from "react";

/** Contain the 16:9 LED canvas inside the viewport without cropping. */
export const DISPLAY_STAGE_SIZE_STYLE: CSSProperties = {
  width: "min(100vw, calc(100vh * 16 / 9))",
  height: "min(100vh, calc(100vw * 9 / 16))",
};

/**
 * Centers the broadcast stage and keeps all chrome (banner, audio unlock, theme)
 * inside the same canvas — prevents the "half-cut" refresh layout.
 */
export function DisplayStageViewport({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black">
      <div
        className="@container/stage relative isolate overflow-hidden"
        style={{ ...DISPLAY_STAGE_SIZE_STYLE, containerType: "size" }}
      >
        {children}
      </div>
    </div>
  );
}
