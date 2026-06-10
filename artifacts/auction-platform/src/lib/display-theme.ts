import type { ThemeId } from "@/components/display/v1/themes";

export type DisplayThemeName =
  | "stadium-gold"
  | "royal-sapphire"
  | "emerald-cup"
  | "crimson-final"
  | "broadcast-gold"
  | "ice-blue"
  | "festival-night"
  | "default";

export type DisplayTheme = {
  id: DisplayThemeName;
  label: string;
  dot: string;
  bg: string;
  secondaryGlow: string | null;
  accentColor: string;
  /** Maps to V1 stage preset for full CSS token set */
  stagePreset: ThemeId;
};

/** Lovable-aligned presets (primary) + legacy IDs kept for saved tournament settings */
export const DISPLAY_THEMES: Record<DisplayThemeName, DisplayTheme> = {
  "stadium-gold": {
    id: "stadium-gold",
    label: "Stadium Gold",
    dot: "#D4AF37",
    bg: "#070708",
    secondaryGlow: "rgba(212, 175, 55, 0.35)",
    accentColor: "#D4AF37",
    stagePreset: "gold",
  },
  "royal-sapphire": {
    id: "royal-sapphire",
    label: "Royal Sapphire",
    dot: "#5B8DEF",
    bg: "#06080F",
    secondaryGlow: "rgba(91, 141, 239, 0.35)",
    accentColor: "#5B8DEF",
    stagePreset: "sapphire",
  },
  "emerald-cup": {
    id: "emerald-cup",
    label: "Emerald Cup",
    dot: "#34D399",
    bg: "#06100C",
    secondaryGlow: "rgba(52, 211, 153, 0.35)",
    accentColor: "#34D399",
    stagePreset: "emerald",
  },
  "crimson-final": {
    id: "crimson-final",
    label: "Crimson Final",
    dot: "#EF4444",
    bg: "#0A0608",
    secondaryGlow: "rgba(239, 68, 68, 0.35)",
    accentColor: "#EF4444",
    stagePreset: "crimson",
  },
  /** @deprecated use stadium-gold — kept for localStorage / saved settings */
  "broadcast-gold": {
    id: "broadcast-gold",
    label: "Broadcast Gold",
    dot: "#D4AF37",
    bg: "#070708",
    secondaryGlow: "rgba(212, 175, 55, 0.35)",
    accentColor: "#D4AF37",
    stagePreset: "gold",
  },
  /** @deprecated use royal-sapphire */
  "ice-blue": {
    id: "ice-blue",
    label: "Ice Blue",
    dot: "#5B8DEF",
    bg: "#06080F",
    secondaryGlow: "rgba(91, 141, 239, 0.35)",
    accentColor: "#5B8DEF",
    stagePreset: "sapphire",
  },
  /** @deprecated use crimson-final */
  "festival-night": {
    id: "festival-night",
    label: "Festival Night",
    dot: "#EF4444",
    bg: "#0A0608",
    secondaryGlow: "rgba(239, 68, 68, 0.35)",
    accentColor: "#EF4444",
    stagePreset: "crimson",
  },
  default: {
    id: "default",
    label: "Default",
    dot: "#a78bfa",
    bg: "#09090b",
    secondaryGlow: null,
    accentColor: "#a78bfa",
    stagePreset: "custom",
  },
};

/** Primary picker list — Lovable presets first, then legacy/default */
export const DISPLAY_THEMES_LIST: DisplayTheme[] = [
  DISPLAY_THEMES["stadium-gold"],
  DISPLAY_THEMES["royal-sapphire"],
  DISPLAY_THEMES["emerald-cup"],
  DISPLAY_THEMES["crimson-final"],
  DISPLAY_THEMES.default,
];

const LEGACY_IDS = new Set<string>([
  "broadcast-gold",
  "ice-blue",
  "festival-night",
  "default",
]);

export function getDisplayTheme(name: string | null | undefined): DisplayTheme {
  const key = (name ?? "stadium-gold") as DisplayThemeName;
  if (DISPLAY_THEMES[key]) return DISPLAY_THEMES[key];
  return DISPLAY_THEMES["stadium-gold"];
}

export function displayThemeToStagePreset(theme: DisplayTheme): ThemeId {
  return theme.stagePreset;
}

export function isLegacyDisplayThemeId(id: string): boolean {
  return LEGACY_IDS.has(id);
}
