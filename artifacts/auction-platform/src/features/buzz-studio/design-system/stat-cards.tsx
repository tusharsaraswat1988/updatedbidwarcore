/**
 * Buzz Studio — Stat Card System
 *
 * Reusable stat display component.
 * Used in: Top Buys, Player Stats, Auction Summary, Match Stats.
 *
 * No business logic. No auction imports. Pure display.
 */

import React from "react";
import type { CSSProperties } from "react";
import { defaultBuzzTheme } from "../theme/buzz-theme";
import { Typography } from "./typography";
import { Gradients } from "./gradients";

const t = defaultBuzzTheme;

/* ─── StatCard ───────────────────────────────────────────────────────────── */

export interface StatCardProps {
  /** Short label describing the stat. e.g. "Teams", "Players", "Top Bid" */
  label: string;
  /** The primary value to display. e.g. "12", "₹42L", "94%" */
  value: string | number;
  /**
   * When true, value renders in gold (primaryGold).
   * Use for highlights, records, or top values.
   * @default false
   */
  highlight?: boolean;
  /** Optional icon/emoji prefix. */
  icon?: string;
  style?: CSSProperties;
}

/**
 * Single stat display block: value (large) over label (small).
 *
 * @example
 * <StatCard label="Teams" value="12" />
 * <StatCard label="Top Bid" value="₹42,00,000" highlight />
 * <StatCard label="Players Sold" value="48" icon="🏏" />
 */
export function StatCard({
  label,
  value,
  highlight = false,
  icon,
  style,
}: StatCardProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        padding: "12px 16px",
        borderRadius: "10px",
        background: "rgba(255,255,255,0.04)",
        border: highlight
          ? `1px solid ${t.primaryGold}30`
          : "1px solid rgba(255,255,255,0.07)",
        minWidth: "72px",
        textAlign: "center",
        ...style,
      }}
    >
      {icon && (
        <span
          aria-hidden="true"
          style={{ fontSize: "1rem", lineHeight: 1, marginBottom: "2px" }}
        >
          {icon}
        </span>
      )}

      <span
        style={{
          ...Typography.StatValue,
          color: highlight ? t.primaryGold : t.white,
        }}
      >
        {value}
      </span>

      <span style={Typography.StatLabel}>{label}</span>
    </div>
  );
}

/* ─── StatRow ────────────────────────────────────────────────────────────── */

export interface StatRowProps {
  stats: StatCardProps[];
  style?: CSSProperties;
}

/**
 * Horizontal row of StatCards.
 * Useful for player stat bars, auction summaries.
 *
 * @example
 * <StatRow stats={[
 *   { label: "Teams", value: 12 },
 *   { label: "Players", value: 48 },
 *   { label: "Top Bid", value: "₹42L", highlight: true },
 * ]} />
 */
export function StatRow({ stats, style }: StatRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: "8px",
        flexWrap: "wrap",
        justifyContent: "center",
        ...style,
      }}
    >
      {stats.map((stat, i) => (
        <StatCard key={i} {...stat} />
      ))}
    </div>
  );
}

/* ─── PriceDisplay ───────────────────────────────────────────────────────── */

export interface PriceDisplayProps {
  /** Formatted price string. e.g. "₹42,00,000" or "₹42L" */
  price: string;
  /** Optional label above the price. e.g. "SOLD FOR" */
  label?: string;
  style?: CSSProperties;
}

/**
 * Large price display for auction sold cards.
 * Gold, prominent, with optional overhead label.
 *
 * @example
 * <PriceDisplay price="₹42,00,000" label="Sold For" />
 */
export function PriceDisplay({ price, label, style }: PriceDisplayProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        padding: "16px 28px",
        borderRadius: "14px",
        background: Gradients.DarkGoldPremium,
        border: `1.5px solid rgba(251,191,36,0.50)`,
        textAlign: "center",
        boxShadow: `0 0 36px rgba(251,191,36,0.20), 0 6px 28px rgba(0,0,0,0.55)`,
        ...style,
      }}
    >
      {label && (
        <span style={{ ...Typography.Caption, color: "rgba(255,255,255,0.45)" }}>
          {label.toUpperCase()}
        </span>
      )}
      <span style={Typography.PriceValue}>{price}</span>
    </div>
  );
}
