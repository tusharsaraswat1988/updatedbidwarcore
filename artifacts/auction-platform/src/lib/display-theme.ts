export type DisplayThemeName = "default" | "broadcast-gold" | "festival-night" | "ice-blue";

export type DisplayTheme = {
  id: DisplayThemeName;
  label: string;
  dot: string;
  bg: string;
  secondaryGlow: string | null;
  accentColor: string;
};

export const DISPLAY_THEMES: Record<DisplayThemeName, DisplayTheme> = {
  "default": {
    id: "default",
    label: "Default",
    dot: "#a78bfa",
    bg: "#09090b",
    secondaryGlow: null,
    accentColor: "#a78bfa",
  },
  "broadcast-gold": {
    id: "broadcast-gold",
    label: "Broadcast Gold",
    dot: "#d97706",
    bg: "#0c0800",
    secondaryGlow: "#d97706",
    accentColor: "#d97706",
  },
  "festival-night": {
    id: "festival-night",
    label: "Festival Night",
    dot: "#ec4899",
    bg: "#060414",
    secondaryGlow: "#ec4899",
    accentColor: "#ec4899",
  },
  "ice-blue": {
    id: "ice-blue",
    label: "Ice Blue",
    dot: "#06b6d4",
    bg: "#020b12",
    secondaryGlow: "#06b6d4",
    accentColor: "#06b6d4",
  },
};

export const DISPLAY_THEMES_LIST: DisplayTheme[] = Object.values(DISPLAY_THEMES);

export function getDisplayTheme(name: string | null | undefined): DisplayTheme {
  return DISPLAY_THEMES[(name ?? "default") as DisplayThemeName] ?? DISPLAY_THEMES["default"];
}
