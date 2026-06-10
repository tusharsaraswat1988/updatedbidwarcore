/**
 * Theme presets for the LED stage.
 *
 * Themes apply via CSS custom properties on the AuctionStage root. Components
 * read tokens via `var(--accent)` etc. — never hardcoded colors.
 */

export type ThemeId = "gold" | "sapphire" | "emerald" | "crimson" | "custom";

export type Theme = {
  id: ThemeId;
  name: string;
  /** CSS values for the stage root inline style */
  vars: {
    "--accent": string;
    "--accent-strong": string;
    "--accent-glow": string;
    "--accent-on": string;
    "--stage-bg": string;
    "--stage-surface": string;
    "--stage-text": string;
  };
};

export const THEME_PRESETS: Theme[] = [
  {
    id: "gold",
    name: "Stadium Gold",
    vars: {
      "--accent": "#D4AF37",
      "--accent-strong": "#F0C541",
      "--accent-glow": "rgba(212, 175, 55, 0.35)",
      "--accent-on": "#0a0a0a",
      "--stage-bg": "#070708",
      "--stage-surface": "#101013",
      "--stage-text": "#ffffff",
    },
  },
  {
    id: "sapphire",
    name: "Royal Sapphire",
    vars: {
      "--accent": "#5B8DEF",
      "--accent-strong": "#7AA8FF",
      "--accent-glow": "rgba(91, 141, 239, 0.35)",
      "--accent-on": "#0a0f1f",
      "--stage-bg": "#06080F",
      "--stage-surface": "#0F1422",
      "--stage-text": "#ffffff",
    },
  },
  {
    id: "emerald",
    name: "Emerald Cup",
    vars: {
      "--accent": "#34D399",
      "--accent-strong": "#5EEAB0",
      "--accent-glow": "rgba(52, 211, 153, 0.35)",
      "--accent-on": "#04140E",
      "--stage-bg": "#06100C",
      "--stage-surface": "#0E1A14",
      "--stage-text": "#ffffff",
    },
  },
  {
    id: "crimson",
    name: "Crimson Final",
    vars: {
      "--accent": "#EF4444",
      "--accent-strong": "#FB7373",
      "--accent-glow": "rgba(239, 68, 68, 0.35)",
      "--accent-on": "#14040A",
      "--stage-bg": "#0A0608",
      "--stage-surface": "#160C10",
      "--stage-text": "#ffffff",
    },
  },
];

export function getThemeById(id: ThemeId): Theme {
  return THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0];
}

/** Build a custom theme from an accent hex + (optional) bg hex. */
export function buildCustomTheme(accent: string, stageBg = "#070708"): Theme {
  return {
    id: "custom",
    name: "Custom",
    vars: {
      "--accent": accent,
      "--accent-strong": accent,
      "--accent-glow": `${accent}59`, // ~35% alpha
      "--accent-on": "#0a0a0a",
      "--stage-bg": stageBg,
      "--stage-surface": "#101013",
      "--stage-text": "#ffffff",
    },
  };
}
