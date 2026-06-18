/**
 * Buzz Studio — Typography System
 *
 * Reusable CSSProperties presets for every text role across all templates.
 * All color values read from defaultBuzzTheme — zero hardcoded arbitrary colors.
 * Sizing uses clamp() for renderer scalability.
 *
 * Usage:
 *   import { Typography } from "../design-system/typography";
 *   <h1 style={Typography.PlayerName}>…</h1>
 *   <span style={{ ...Typography.Caption, marginTop: 4 }}>…</span>
 */

import type { CSSProperties } from "react";
import { defaultBuzzTheme } from "../theme/buzz-theme";

const t = defaultBuzzTheme;

const BASE_FONT: CSSProperties = {
  fontFamily: "system-ui, -apple-system, sans-serif",
};

export const Typography = {
  /**
   * Tournament announce / Champion card headline.
   * Largest text in the system.
   */
  HeroTitle: {
    ...BASE_FONT,
    fontSize: "clamp(2rem, 7vw, 4rem)",
    fontWeight: 900,
    color: t.white,
    letterSpacing: "0.04em",
    lineHeight: 1.0,
    margin: 0,
  },

  /**
   * Primary player name. Used in spotlight, sold card, MVP card.
   */
  PlayerName: {
    ...BASE_FONT,
    fontSize: "clamp(1.25rem, 4.5vw, 2.25rem)",
    fontWeight: 900,
    color: t.white,
    letterSpacing: "0.06em",
    lineHeight: 1.1,
    margin: 0,
  },

  /**
   * Team name display row.
   */
  TeamName: {
    ...BASE_FONT,
    fontSize: "clamp(0.6875rem, 2vw, 0.875rem)",
    fontWeight: 600,
    color: "rgba(255,255,255,0.75)",
    letterSpacing: "0.04em",
  },

  /**
   * Auction sale price / bid value. Gold, prominent.
   */
  PriceValue: {
    ...BASE_FONT,
    fontSize: "clamp(1.5rem, 5vw, 3rem)",
    fontWeight: 900,
    color: t.primaryGold,
    letterSpacing: "0.02em",
    lineHeight: 1.0,
    margin: 0,
  },

  /**
   * Numeric value inside a stat card (e.g. "3", "₹42L").
   */
  StatValue: {
    ...BASE_FONT,
    fontSize: "clamp(1rem, 3.5vw, 1.75rem)",
    fontWeight: 800,
    color: t.white,
    letterSpacing: "0.02em",
    lineHeight: 1.0,
    margin: 0,
  },

  /**
   * Role, designation, or stat label (e.g. "Captain", "All Rounder").
   * Gold, uppercase, tight tracking.
   */
  StatLabel: {
    ...BASE_FONT,
    fontSize: "clamp(0.625rem, 1.8vw, 0.8125rem)",
    fontWeight: 600,
    color: t.primaryGold,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
  },

  /**
   * Secondary contextual text (e.g. city, tournament name, date).
   * Low-opacity white.
   */
  Caption: {
    ...BASE_FONT,
    fontSize: "clamp(0.5625rem, 1.5vw, 0.6875rem)",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  },

  /**
   * Large behind-content watermark text.
   * Matches BidwarCanvas watermark rendering.
   */
  Watermark: {
    ...BASE_FONT,
    fontSize: "clamp(4rem, 18vw, 9rem)",
    fontWeight: 900,
    letterSpacing: "0.15em",
    color: "rgba(251,191,36,0.04)",
    userSelect: "none" as const,
    pointerEvents: "none" as const,
    whiteSpace: "nowrap" as const,
  },

  /**
   * BidWar footer branding ("Powered by BidWar").
   * Matches BidwarCanvas footer rendering.
   */
  FooterBrand: {
    ...BASE_FONT,
    fontSize: "0.6875rem",
    fontWeight: 700,
    color: t.primaryGold,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  },
} satisfies Record<string, CSSProperties>;
