import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  THEME_PRESETS,
  buildCustomTheme,
  getThemeById,
  type Theme,
  type ThemeId,
} from "@/lib/auction-demo/themes";

type ThemeCtx = {
  theme: Theme;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  customAccent: string;
  setCustomAccent: (hex: string) => void;
  presets: Theme[];
};

const Ctx = createContext<ThemeCtx | null>(null);

export function StageThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>("gold");
  const [customAccent, setCustomAccent] = useState<string>("#D4AF37");

  const value = useMemo<ThemeCtx>(() => {
    const theme =
      themeId === "custom" ? buildCustomTheme(customAccent) : getThemeById(themeId);
    return {
      theme,
      themeId,
      setThemeId,
      customAccent,
      setCustomAccent,
      presets: THEME_PRESETS,
    };
  }, [themeId, customAccent]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStageTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStageTheme must be used inside <StageThemeProvider>");
  return v;
}
