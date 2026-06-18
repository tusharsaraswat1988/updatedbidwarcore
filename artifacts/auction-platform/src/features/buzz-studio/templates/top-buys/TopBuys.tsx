/**
 * Buzz Studio — Top Buys Template
 *
 * Showcases the highest-purchased players from an auction.
 * Viewer goal: WHO / WHICH TEAM / HOW MUCH within 2 seconds.
 *
 * Layout:
 *   1. Header  — title, subtitle, sport badge
 *   2. Featured (#1) — large card: avatar, name, price, team
 *   3. Compact grid (#2–N) — 2 or 3 column leaderboard
 *
 * Supports: Top 3, Top 5, Top 10 (any entry count 1–10)
 *
 * Data contract : TopBuysListContract
 * Pure render   : no hooks, no state, no effects
 * Renderer-safe : inline styles + clamp units
 */

import React from "react";
import { BidwarCanvas } from "../../canvas/BidwarCanvas";
import { Typography } from "../../design-system/typography";
import { Gradients } from "../../design-system/gradients";
import { defaultBuzzTheme as t } from "../../theme/buzz-theme";
import { SportBadge, RankingBadge } from "../../design-system/badges";
import { PlayerSlot, TeamSlot } from "../../design-system/logo-slots";
import { PriceDisplay } from "../../design-system/stat-cards";
import { formatTopBuyPrice, resolveRank, compactGridCols } from "./TopBuys.utils";
import type { TopBuyContract, TopBuysListContract } from "./TopBuys.types";

/* ─── CompactBuyCard ─────────────────────────────────────────────────────── */
//
// Defined at module level (not inside TopBuys) to prevent remount on every
// parent render — see React rule 5.4 (Don't Define Components Inside Components).

interface CompactBuyCardProps {
  entry: TopBuyContract;
  /** Effective rank, 1-based. */
  rank: number;
}

/**
 * Compact leaderboard row for entries #2 and below.
 *
 * Layout: [rank + avatar column] → [name / team / price column]
 * Design weight: rank badge > avatar > name > price > team
 *
 * Left border is tinted by medal rank (silver #2, bronze #3, neutral 4+).
 */
function CompactBuyCard({ entry, rank }: CompactBuyCardProps) {
  const priceDisplay = formatTopBuyPrice(entry);

  // Rank-tinted left border — silver for #2, bronze for #3, subtle for rest
  const leftBorderColor =
    rank === 2 ? "rgba(148,163,184,0.55)" :
    rank === 3 ? "rgba(217,119,6,0.50)"   :
    "rgba(255,255,255,0.08)";

  return (
    <div style={{ ...s.compactCard, borderLeft: `2.5px solid ${leftBorderColor}` }}>
      {/* Left column — rank badge stacked above avatar */}
      <div style={s.compactLeft}>
        <RankingBadge rank={rank} style={s.compactRankBadge} />
        <PlayerSlot
          playerName={entry.playerName}
          imageUrl={entry.playerImageUrl}
          size="sm"
        />
      </div>

      {/* Right column — name / team / price */}
      <div style={s.compactRight}>
        <span style={s.compactName} title={entry.playerName}>
          {entry.playerName.toUpperCase()}
        </span>
        {entry.teamName && (
          <div style={s.compactTeamRow}>
            <TeamSlot
              teamName={entry.teamName}
              imageUrl={entry.teamLogoUrl}
              size={14}
            />
            <span style={s.compactTeamName}>
              {entry.teamName}
            </span>
          </div>
        )}
        <span style={s.compactPrice}>{priceDisplay}</span>
      </div>
    </div>
  );
}

/* ─── TopBuys ────────────────────────────────────────────────────────────── */

/**
 * Top Buys card template.
 *
 * Visual priority (left/top → right/bottom by perceptual weight):
 *   1. #1 Gold rank badge (instant "champion" signal)
 *   2. Featured player avatar (largest image on card)
 *   3. Featured player name (bold, white, prominent)
 *   4. PRICE HERO (gold, largest number on card)
 *   5. Team row for #1
 *   6. Compact grid — rank + avatar + name + price for #2–N
 */
export function TopBuys(props: TopBuysListContract) {
  const { entries, title, sport } = props;

  if (entries.length === 0) return null;

  const [featuredEntry, ...restEntries] = entries;
  const featuredRank = resolveRank(featuredEntry, 0);
  const featuredPrice = formatTopBuyPrice(featuredEntry);
  const entryCountLabel = `TOP ${entries.length}`;
  const gridCols = compactGridCols(restEntries.length);

  return (
    <BidwarCanvas branding={props.branding} showFooterBranding>
      <div style={s.layout}>

        {/* ── Header: sport badge ← → entry count label ───────────────────── */}
        <div style={s.headerStrip}>
          <SportBadge sport={sport} />
          <span style={s.entryCountLabel}>{entryCountLabel}</span>
        </div>

        {/* ── Title block ──────────────────────────────────────────────────── */}
        <div style={s.titleBlock}>
          <h1 style={s.titleText}>{(title ?? "TOP BUYS").toUpperCase()}</h1>
          <span style={s.subtitleText}>AUCTION HIGHLIGHTS</span>
        </div>

        {/* ── Gold accent divider below title — thicker and wider ──────────── */}
        <div style={s.accentDivider} aria-hidden="true" />

        {/* ── Featured card — the #1 buy ─────────────────────────────────── */}
        <div style={s.featuredCard}>

          {/* Rank badge top-left — gold #1 treatment */}
          <div style={s.featuredRankRow}>
            <RankingBadge rank={featuredRank} />
          </div>

          {/* Player avatar with glow halo behind it */}
          <div style={s.featuredAvatarWrapper}>
            <div style={s.featuredAvatarGlow} aria-hidden="true" />
            <PlayerSlot
              playerName={featuredEntry.playerName}
              imageUrl={featuredEntry.playerImageUrl}
              size="lg"
            />
          </div>

          {/* Player name + designation */}
          <div style={s.featuredNameArea}>
            <h2 style={Typography.PlayerName}>
              {featuredEntry.playerName.toUpperCase()}
            </h2>
            {featuredEntry.designation && (
              <span style={s.featuredDesignation}>
                {featuredEntry.designation.toUpperCase()}
              </span>
            )}
          </div>

          {/* Thin gold divider inside the featured card */}
          <div style={s.featuredInnerDivider} aria-hidden="true" />

          {/* PRICE — the most important number on the card */}
          <PriceDisplay
            price={featuredPrice}
            label="Top Buy"
            style={s.featuredPriceBlock}
          />

          {/* Team row */}
          {featuredEntry.teamName && (
            <div style={s.featuredTeamRow}>
              <TeamSlot
                teamName={featuredEntry.teamName}
                imageUrl={featuredEntry.teamLogoUrl}
                size={26}
              />
              <span style={Typography.TeamName}>
                {featuredEntry.teamName.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* ── Compact grid — entries #2 and below ───────────────────────── */}
        {restEntries.length > 0 && (
          <>
            <div style={s.sectionDivider} aria-hidden="true" />
            <div
              style={{
                ...s.compactGrid,
                gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
              }}
            >
              {restEntries.map((entry, idx) => (
                <CompactBuyCard
                  key={entry.playerId ?? `entry-${idx}`}
                  entry={entry}
                  rank={resolveRank(entry, idx + 1)}
                />
              ))}
            </div>
          </>
        )}

      </div>
    </BidwarCanvas>
  );
}

/* ─── Template-local styles ──────────────────────────────────────────────── */
//
// Only layout / spacing / template-specific visual accents live here.
// Typography, colors, gradients → design system.

const s: Record<string, React.CSSProperties> = {

  // Root flex column
  layout: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    width: "100%",
    gap: 0,
  },

  /* ── Header strip ───────────────────────────────────────────────────────── */

  headerStrip: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: "10px",
  },

  entryCountLabel: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "clamp(0.5rem, 1.4vw, 0.625rem)",
    fontWeight: 800,
    color: `${t.primaryGold}90`,
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    background: `rgba(251,191,36,0.08)`,
    border: `1px solid rgba(251,191,36,0.22)`,
    borderRadius: "999px",
    padding: "2px 10px",
  },

  /* ── Title block ────────────────────────────────────────────────────────── */

  titleBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    paddingBottom: "10px",
    textAlign: "center",
  },

  titleText: {
    margin: 0,
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "clamp(1.5rem, 5vw, 2.5rem)",
    fontWeight: 900,
    color: t.white,
    letterSpacing: "0.12em",
    lineHeight: 1.05,
  },

  subtitleText: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "clamp(0.5rem, 1.4vw, 0.625rem)",
    fontWeight: 600,
    color: "rgba(255,255,255,0.42)",
    letterSpacing: "0.24em",
    textTransform: "uppercase" as const,
  },

  /* ── Gold accent line below title — thicker and wider ──────────────────── */

  accentDivider: {
    width: "55%",
    height: "2px",
    background: Gradients.GoldDivider,
    alignSelf: "center",
    marginBottom: "12px",
    borderRadius: "1px",
    boxShadow: "0 0 8px rgba(251,191,36,0.30)",
  },

  /* ── Featured (#1) card — premium gold treatment ────────────────────────── */

  featuredCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    padding: "14px 16px 16px",
    borderRadius: "14px",
    background: `linear-gradient(160deg, #2a1e00 0%, #1a1300 40%, #0c0c0c 100%)`,
    border: `1.5px solid rgba(251,191,36,0.40)`,
    boxShadow: `0 0 48px rgba(251,191,36,0.22), 0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(251,191,36,0.22)`,
    position: "relative",
    marginBottom: "10px",
  },

  featuredRankRow: {
    alignSelf: "flex-start",
  },

  // Avatar wrapper — relative so the glow halo can be absolutely placed
  featuredAvatarWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "2px",
    marginBottom: "4px",
  },

  // Soft gold radial glow behind the featured avatar
  featuredAvatarGlow: {
    position: "absolute",
    inset: "-32px",
    borderRadius: "50%",
    background: `radial-gradient(circle, rgba(251,191,36,0.20) 0%, transparent 65%)`,
    pointerEvents: "none",
  },

  featuredNameArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "5px",
    textAlign: "center",
  },

  featuredDesignation: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "clamp(0.5625rem, 1.6vw, 0.6875rem)",
    fontWeight: 700,
    color: t.primaryGold,
    letterSpacing: "0.16em",
    background: `rgba(251,191,36,0.10)`,
    border: `1px solid rgba(251,191,36,0.28)`,
    borderRadius: "999px",
    padding: "3px 12px",
  },

  // Thin inner gold divider between name and price
  featuredInnerDivider: {
    width: "55%",
    height: "1px",
    background: Gradients.GoldDivider,
    borderRadius: "1px",
  },

  // Price block — slightly tighter than standalone PriceDisplay
  featuredPriceBlock: {
    width: "100%",
    padding: "12px 18px",
  },

  // Gold-tinted team row inside featured card
  featuredTeamRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 14px",
    borderRadius: "8px",
    background: `linear-gradient(90deg, rgba(251,191,36,0.10) 0%, rgba(251,191,36,0.04) 100%)`,
    border: `1px solid rgba(251,191,36,0.20)`,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },

  /* ── Section divider between featured and compact grid ─────────────────── */

  sectionDivider: {
    width: "100%",
    height: "1px",
    background: "rgba(255,255,255,0.07)",
    marginBottom: "10px",
    borderRadius: "1px",
  },

  /* ── Compact grid ───────────────────────────────────────────────────────── */

  compactGrid: {
    display: "grid",
    gap: "7px",
    width: "100%",
  },

  /* ── Compact card — left border added dynamically per rank ──────────────── */

  compactCard: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "8px",
    padding: "8px 10px",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.028)",
    border: "1px solid rgba(255,255,255,0.060)",
    minWidth: 0,
    // borderLeft is overridden inline per rank in CompactBuyCard
  },

  compactLeft: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    flexShrink: 0,
  },

  compactRankBadge: {
    padding: "2px 7px",
    fontSize: "0.5625rem",
  },

  compactRight: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
    flex: 1,
  },

  compactName: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "clamp(0.6rem, 1.6vw, 0.75rem)",
    fontWeight: 800,
    color: t.white,
    letterSpacing: "0.06em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.2,
  },

  compactTeamRow: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },

  compactTeamName: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "clamp(0.5rem, 1.2vw, 0.5625rem)",
    fontWeight: 500,
    color: "rgba(255,255,255,0.38)",
    letterSpacing: "0.04em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1,
  },

  compactPrice: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "clamp(0.5625rem, 1.5vw, 0.6875rem)",
    fontWeight: 800,
    color: t.primaryGold,
    letterSpacing: "0.04em",
    lineHeight: 1.3,
  },
};
