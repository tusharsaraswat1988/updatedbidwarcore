import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Theme } from "./themes";

type ThemeCtx = {
  theme: Theme;
};

const Ctx = createContext<ThemeCtx | null>(null);

export function StageThemeProvider({
  theme,
  children,
}: {
  theme: Theme;
  children: ReactNode;
}) {
  const value = useMemo<ThemeCtx>(() => ({ theme }), [theme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStageTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStageTheme must be used inside <StageThemeProvider>");
  return v;
}
