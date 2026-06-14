import type { ReactNode, CSSProperties } from "react";
import { useStageTheme } from "../v1/StageThemeProvider";

/**
 * Full-viewport frame for portrait / landscape side LED panels.
 * Unlike the main 16:9 StageFrame, this fills the entire screen.
 */
export function SideStageFrame({ children }: { children: ReactNode }) {
  const { theme } = useStageTheme();
  const styleVars = theme.vars as unknown as CSSProperties;

  return (
    <div
      className="fixed inset-0 overflow-hidden font-['Barlow_Condensed']"
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
