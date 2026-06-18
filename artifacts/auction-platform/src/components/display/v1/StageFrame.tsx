import type { ReactNode, CSSProperties } from "react";
import { useStageTheme } from "./StageThemeProvider";

/**
 * Full-bleed stage surface inside DisplayStageViewport (16:9 canvas).
 * Applies the active theme via CSS custom properties.
 */
export function StageFrame({ children }: { children: ReactNode }) {
  const { theme } = useStageTheme();
  const styleVars = theme.vars as unknown as CSSProperties;

  return (
    <div
      className="auction-stage absolute inset-0 overflow-hidden"
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
