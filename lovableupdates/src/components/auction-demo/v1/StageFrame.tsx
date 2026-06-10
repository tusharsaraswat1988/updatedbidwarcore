import type { ReactNode, CSSProperties } from "react";
import { useStageTheme } from "./StageThemeProvider";

/**
 * Full-bleed landscape 16:9 LED stage wrapper.
 * Applies the active theme via CSS custom properties.
 */
export function StageFrame({ children }: { children: ReactNode }) {
  const { theme } = useStageTheme();
  const styleVars = theme.vars as unknown as CSSProperties;

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      <div
        className="auction-stage relative w-full max-w-[100vw] aspect-video max-h-screen overflow-hidden"
        style={{
          ...styleVars,
          backgroundColor: "var(--stage-bg)",
          color: "var(--stage-text)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
