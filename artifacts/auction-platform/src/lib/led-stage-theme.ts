import type { DisplayTheme } from "@/lib/display-theme";
import type { Theme } from "@/components/display/v1/themes";

/** Map operator-panel DisplayTheme to V1 stage CSS custom properties. */
export function displayThemeToStageTheme(theme: DisplayTheme): Theme {
  const accent = theme.accentColor;
  return {
    id: "custom",
    name: theme.label,
    vars: {
      "--accent": accent,
      "--accent-strong": accent,
      "--accent-glow": `${accent}59`,
      "--accent-on": "#0a0a0a",
      "--stage-bg": theme.bg,
      "--stage-surface": "#101013",
      "--stage-text": "#ffffff",
    },
  };
}
