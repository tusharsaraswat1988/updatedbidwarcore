import type { DisplayTheme } from "@/lib/display-theme";
import { displayThemeToStagePreset } from "@/lib/display-theme";
import {
  buildCustomTheme,
  getThemeById,
  type Theme,
  type ThemeId,
} from "@/components/display/v1/themes";

export function displayThemeToPickerState(theme: DisplayTheme | undefined): {
  themeId: ThemeId;
  customAccent: string;
} {
  const t = theme ?? {
    id: "stadium-gold" as const,
    label: "Stadium Gold",
    dot: "#D4AF37",
    bg: "#070708",
    secondaryGlow: null,
    accentColor: "#D4AF37",
    stagePreset: "gold" as const,
  };

  const preset = displayThemeToStagePreset(t);
  if (preset === "custom") {
    return { themeId: "custom", customAccent: t.accentColor };
  }
  return { themeId: preset, customAccent: t.accentColor };
}

/** Resolve active stage Theme object from picker state */
export function resolveStageTheme(themeId: ThemeId, customAccent: string): Theme {
  if (themeId === "custom") {
    return buildCustomTheme(customAccent);
  }
  return getThemeById(themeId);
}

/** @deprecated use resolveStageTheme via picker state */
export function displayThemeToStageTheme(theme: DisplayTheme): Theme {
  const { themeId, customAccent } = displayThemeToPickerState(theme);
  return resolveStageTheme(themeId, customAccent);
}
