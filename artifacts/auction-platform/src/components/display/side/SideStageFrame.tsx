import type { ReactNode, CSSProperties } from "react";
import { useStageTheme } from "../v1/StageThemeProvider";

type SideStageFrameVariant = "viewport" | "canvas";

/**
 * Theme surface inside the fixed 1080×1920 broadcast canvas.
 * Player scene keeps Barlow Condensed; sponsor scene uses canvas defaults.
 */
export function SideStageFrame({
  children,
  variant = "viewport",
}: {
  children: ReactNode;
  variant?: SideStageFrameVariant;
}) {
  const { theme } = useStageTheme();
  const styleVars = theme.vars as unknown as CSSProperties;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        ...styleVars,
        backgroundColor: "var(--stage-bg)",
        color: "var(--stage-text)",
      }}
    >
      {children}
    </div>
  );
}
