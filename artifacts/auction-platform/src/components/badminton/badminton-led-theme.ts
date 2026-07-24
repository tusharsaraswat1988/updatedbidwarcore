import type { CSSProperties } from "react";

/** Opponent-side color — fixed contrast; left/home uses theme `--accent`. */
export const BADMINTON_LED_OPPONENT = "#ff6b6b";
export const BADMINTON_LED_OPPONENT_GLOW = "rgba(255, 107, 107, 0.45)";
export const BADMINTON_LED_OPPONENT_MUTED = "#ce93d8";

export const badmintonLedSurfaceStyle = {
  "--stage-opponent": BADMINTON_LED_OPPONENT,
  "--stage-opponent-glow": BADMINTON_LED_OPPONENT_GLOW,
  "--stage-opponent-muted": BADMINTON_LED_OPPONENT_MUTED,
} as CSSProperties;

/** Fixed broadcast score — white for LED readability; not theme-linked. */
export function fixedScoreStyle(active = true): CSSProperties {
  return {
    color: "#ffffff",
    textShadow: active
      ? "0 0 64px rgba(255,255,255,0.38), 0 0 28px rgba(255,255,255,0.22), 0 3px 14px rgba(0,0,0,0.6)"
      : "none",
    opacity: active ? 1 : 0.38,
  };
}

export function fixedServeStyle(active: boolean): CSSProperties {
  return active
    ? { backgroundColor: "#ffd700", boxShadow: "0 0 12px rgba(255, 215, 0, 0.5)" }
    : { backgroundColor: "rgba(255,255,255,0.1)" };
}

export function fixedGameDotStyle(filled: boolean, side?: "left" | "right"): CSSProperties {
  if (!filled) {
    return {
      backgroundColor: "rgba(255,255,255,0.04)",
      borderColor: side === "left" ? "rgba(255,196,0,0.3)" : "rgba(206,147,216,0.3)",
    };
  }
  const gold = { fill: "#ffd700", glow: "rgba(255, 215, 0, 0.65)" };
  const lilac = { fill: "#e0b0ff", glow: "rgba(206, 147, 216, 0.6)" };
  const { fill, glow } = side === "right" ? lilac : gold;
  return {
    backgroundColor: fill,
    borderColor: fill,
    boxShadow: `0 0 16px ${glow}, 0 0 4px ${glow}`,
  };
}

export function ledScoreStyle(side: "left" | "right", active = true): CSSProperties {
  const base: CSSProperties =
    side === "left"
      ? { color: "var(--accent)", textShadow: "0 0 30px var(--accent-glow)" }
      : { color: "var(--stage-opponent)", textShadow: "0 0 30px var(--stage-opponent-glow)" };
  return active ? base : { ...base, opacity: 0.4 };
}

export function ledServeStyle(active: boolean): CSSProperties {
  return active
    ? { backgroundColor: "var(--accent)", boxShadow: "0 0 12px var(--accent-glow)" }
    : { backgroundColor: "rgba(255,255,255,0.1)" };
}

export function ledServeBadgeStyle(): CSSProperties {
  return { backgroundColor: "var(--accent)", color: "var(--accent-on, #0a0a0a)" };
}

export function ledAccentBorderStyle(opacity = 0.35): CSSProperties {
  return { borderColor: `color-mix(in srgb, var(--accent) ${Math.round(opacity * 100)}%, transparent)` };
}

export function ledAccentBgStyle(opacity = 0.15): CSSProperties {
  return { backgroundColor: `color-mix(in srgb, var(--accent) ${Math.round(opacity * 100)}%, transparent)` };
}

export function ledSideBorderStyle(isLeft: boolean, flash: boolean, gameWinFlash: boolean): CSSProperties {
  if (flash) return { borderColor: "rgba(255,255,255,0.85)" };
  if (gameWinFlash) {
    return {
      borderColor: "var(--accent)",
      boxShadow: "0 0 24px var(--accent-glow)",
    };
  }
  if (isLeft) return { borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)" };
  return { borderColor: "color-mix(in srgb, var(--stage-opponent) 35%, transparent)" };
}

export function ledGameDotStyle(isLeft: boolean, filled: boolean): CSSProperties {
  if (!filled) return { backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.2)" };
  if (isLeft) {
    return {
      backgroundColor: "var(--accent)",
      borderColor: "var(--accent)",
      boxShadow: "0 4px 14px var(--accent-glow)",
    };
  }
  return {
    backgroundColor: "var(--stage-opponent)",
    borderColor: "var(--stage-opponent)",
    boxShadow: "0 4px 14px var(--stage-opponent-glow)",
  };
}
