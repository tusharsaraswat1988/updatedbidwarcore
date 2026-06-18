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

/* ─── SoldBadge ──────────────────────────────────────────────────────────── */

export interface SoldBadgeProps {
  /** Optional price string, e.g. "₹42,00,000" */
  price?: string;
  style?: CSSProperties;
}

/**
 * Auction sold badge. Danger-red filled variant.
 * Optionally shows the hammer price.
 */
export function SoldBadge({ price, style }: SoldBadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "5px 14px",
        borderRadius: "999px",
        background: t.danger,
        fontFamily: "system-ui, sans-serif",
        fontSize: "0.625rem",
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
