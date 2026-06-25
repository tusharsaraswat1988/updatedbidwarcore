/**
 * Buzz Studio — Badge System
 *
 * Reusable badge components shared across all templates.
 * Also canonical home for SportType metadata (emoji + label mappings).
 *
 * No business logic. No auction dependencies. Pure visual components.
 */

import React from "react";
import type { CSSProperties } from "react";
import { defaultBuzzTheme } from "../theme/buzz-theme";
import { SportType } from "../types/sport-types";

const t = defaultBuzzTheme;

/* ─── Sport metadata ─────────────────────────────────────────────────────────
 *
 * Canonical source of truth for sport labels and emoji.
 * Moved here from PlayerSpotlight.utils so the entire design system
 * can reference it without importing from a template.
 * PlayerSpotlight.utils re-exports these for backward compatibility.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface SportMeta {
  label: string;
  emoji: string;
}

const SPORT_META: Record<SportType, SportMeta> = {
  [SportType.Cricket]:    { label: "Cricket",    emoji: "🏏" },
  [SportType.Badminton]:  { label: "Badminton",  emoji: "🏸" },
  [SportType.Football]:   { label: "Football",   emoji: "⚽" },
  [SportType.Volleyball]: { label: "Volleyball", emoji: "🏐" },
  [SportType.Tennis]:     { label: "Tennis",     emoji: "🎾" },
  [SportType.Kabaddi]:    { label: "Kabaddi",    emoji: "🤼" },
};

export function getSportMeta(sport: SportType): SportMeta {
  return SPORT_META[sport] ?? { label: sport, emoji: "🏅" };
}

export function getSportLabel(sport: SportType): string {
  return getSportMeta(sport).label;
}

export function getSportEmoji(sport: SportType): string {
  return getSportMeta(sport).emoji;
}

/* ─── Shared badge shell ─────────────────────────────────────────────────── */

interface BadgeShellProps {
  children: React.ReactNode;
  variant?: "gold" | "success" | "danger" | "neutral";
  style?: CSSProperties;
}

function BadgeShell({ children, variant = "gold", style }: BadgeShellProps) {
  const variantStyles: Record<string, CSSProperties> = {
    gold: {
      border: `1px solid ${t.primaryGold}40`,
      background: `${t.primaryGold}0D`,
      color: t.primaryGold,
    },
    success: {
      border: `1px solid ${t.success}40`,
      background: `${t.success}0D`,
      color: t.success,
    },
    danger: {
      border: `1px solid ${t.danger}40`,
      background: `${t.danger}0D`,
      color: t.danger,
    },
    neutral: {
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.06)",
      color: "rgba(255,255,255,0.7)",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "4px 12px",
        borderRadius: "999px",
        fontFamily: "system-ui, sans-serif",
        fontSize: "0.625rem",
        fontWeight: 700,
        letterSpacing: "0.13em",
        textTransform: "uppercase",
        userSelect: "none",
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ─── SportBadge ─────────────────────────────────────────────────────────── */

export interface SportBadgeProps {
  sport: SportType;
  style?: CSSProperties;
}

/**
 * Sport identifier pill: emoji + sport label.
 * Used at the top of player cards to identify the sport context.
 *
 * @example
 * <SportBadge sport={SportType.Cricket} />   // → 🏏 CRICKET
 * <SportBadge sport={SportType.Badminton} /> // → 🏸 BADMINTON
 */
export function SportBadge({ sport, style }: SportBadgeProps) {
  const meta = getSportMeta(sport);
  return (
    <BadgeShell variant="gold" style={style}>
      <span style={{ fontSize: "0.875rem", lineHeight: 1 }} aria-hidden="true">
        {meta.emoji}
      </span>
      <span>{meta.label.toUpperCase()}</span>
    </BadgeShell>
  );
}

/* ─── CaptainBadge ───────────────────────────────────────────────────────── */

export interface CaptainBadgeProps {
  style?: CSSProperties;
}

/**
 * "C" captain designator. Compact gold circle.
 */
export function CaptainBadge({ style }: CaptainBadgeProps) {
  return (
    <span
      aria-label="Captain"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        border: `1.5px solid ${t.primaryGold}`,
        background: `${t.primaryGold}1A`,
        fontSize: "0.5625rem",
        fontWeight: 900,
        color: t.primaryGold,
        fontFamily: "system-ui, sans-serif",
        letterSpacing: "0",
        userSelect: "none",
        flexShrink: 0,
        ...style,
      }}
    >
      C
    </span>
  );
}

/* ─── MvpBadge ───────────────────────────────────────────────────────────── */

export interface MvpBadgeProps {
  style?: CSSProperties;
}

/**
 * MVP pill. Gold variant with star prefix.
 */
export function MvpBadge({ style }: MvpBadgeProps) {
  return (
    <BadgeShell variant="gold" style={style}>
      <span aria-hidden="true">⭐</span>
      <span>MVP</span>
    </BadgeShell>
  );
}

/* ─── WinnerBadge ────────────────────────────────────────────────────────── */

export interface WinnerBadgeProps {
  label?: string;
  style?: CSSProperties;
}

/**
 * Winner/Champion badge. Success-green variant.
 */
export function WinnerBadge({ label = "Winner", style }: WinnerBadgeProps) {
  return (
    <BadgeShell variant="success" style={style}>
      <span aria-hidden="true">🏆</span>
      <span>{label.toUpperCase()}</span>
    </BadgeShell>
  );
}

/* ─── RankingBadge ───────────────────────────────────────────────────────── */

/**
 * Rank position pill used in Top Buys, leaderboards, and tournament standings.
 *
 * #1 → Gold       (primaryGold palette)
 * #2 → Silver     (slate palette)
 * #3 → Bronze     (amber-brown palette)
 * #4+ → Neutral   (low-opacity white)
 *
 * @example
 * <RankingBadge rank={1} />   // → #1  (gold)
 * <RankingBadge rank={3} />   // → #3  (bronze)
 * <RankingBadge rank={7} />   // → #7  (neutral)
 */

/** Medal color presets keyed by rank position 1–3. */
const RANK_MEDAL_COLORS: Record<1 | 2 | 3, React.CSSProperties> = {
  1: {
    background: `linear-gradient(135deg, ${t.primaryGold}28 0%, ${t.primaryGold}0D 100%)`,
    border: `1.5px solid ${t.primaryGold}70`,
    color: t.primaryGold,
    boxShadow: `0 0 12px ${t.primaryGold}35, inset 0 1px 0 ${t.primaryGold}30`,
    fontWeight: 900,
    fontSize: "0.6875rem",
  },
  2: {
    background: "rgba(148,163,184,0.12)",
    border: "1.5px solid rgba(148,163,184,0.50)",
    color: "#C0CCDA",
    boxShadow: "0 0 8px rgba(148,163,184,0.22)",
  },
  3: {
    background: "rgba(180,83,9,0.14)",
    border: "1.5px solid rgba(180,83,9,0.50)",
    color: "#D97706",
    boxShadow: "0 0 8px rgba(180,83,9,0.22)",
  },
};

export interface RankingBadgeProps {
  /** Rank position. 1 = gold, 2 = silver, 3 = bronze, 4+ = neutral. */
  rank: number;
  style?: CSSProperties;
}

export function RankingBadge({ rank, style }: RankingBadgeProps) {
  const BASE: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "3px 10px",
    borderRadius: "999px",
    fontFamily: "system-ui, sans-serif",
    fontSize: "0.625rem",
    fontWeight: 900,
    letterSpacing: "0.08em",
    userSelect: "none",
  };

  const medal = RANK_MEDAL_COLORS[rank as 1 | 2 | 3];
  if (medal) {
    return (
      <span style={{ ...BASE, ...medal, ...style }}>#{rank}</span>
    );
  }

  // Standard neutral for #4+
  return (
    <span
      style={{
        ...BASE,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.14)",
        color: "rgba(255,255,255,0.50)",
        fontWeight: 700,
        ...style,
      }}
    >
      #{rank}
    </span>
  );
}

/* ─── SoldBadge ──────────────────────────────────────────────────────────── */

export interface SoldBadgeProps {
  /** Optional price string, e.g. "₹42,00,000" */
  price?: string;
  style?: CSSProperties;
}

/**
 * Auction sold badge. Danger-red gradient with glow.
 * Optionally shows the hammer price.
 */
export function SoldBadge({ price, style }: SoldBadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 16px",
        borderRadius: "999px",
        background: "linear-gradient(135deg, #EF4444 0%, #C71A1A 100%)",
        boxShadow: "0 0 18px rgba(239,68,68,0.50), 0 2px 8px rgba(0,0,0,0.40)",
        fontFamily: "system-ui, sans-serif",
        fontSize: "0.6875rem",
        fontWeight: 900,
        color: t.white,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        userSelect: "none",
        ...style,
      }}
    >
      <span>SOLD</span>
      {price && (
        <>
          <span style={{ opacity: 0.5, fontSize: "0.5rem" }}>|</span>
          <span style={{ letterSpacing: "0.06em" }}>{price}</span>
        </>
      )}
    </span>
  );
}
