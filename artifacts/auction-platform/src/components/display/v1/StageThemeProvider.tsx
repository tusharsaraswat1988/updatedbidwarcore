import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DisplayTheme } from "@/lib/display-theme";
import { displayThemeToPickerState, resolveStageTheme } from "@/lib/led-stage-theme";
import {
  THEME_PRESETS,
  buildCustomTheme,
  getThemeById,
  type Theme,
  type ThemeId,
} from "./themes";

type ThemeCtx = {
  theme: Theme;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  customAccent: string;
  setCustomAccent: (hex: string) => void;
  presets: Theme[];
};

const Ctx = createContext<ThemeCtx | null>(null);

export function StageThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme?: DisplayTheme;
  children: ReactNode;
}) {
  const seeded = displayThemeToPickerState(initialTheme);
  const [themeId, setThemeId] = useState<ThemeId>(seeded.themeId);
  const [customAccent, setCustomAccent] = useState(seeded.customAccent);

  // Operator panel / BroadcastChannel theme changes sync to the LED picker
  useEffect(() => {
    const next = displayThemeToPickerState(initialTheme);
    setThemeId(next.themeId);
    setCustomAccent(next.customAccent);
  }, [initialTheme?.id, initialTheme?.accentColor, initialTheme?.bg]);

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
