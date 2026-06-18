/**
 * Buzz Studio — Sold Player Template
 *
 * The flagship auction graphic. Communicates SOLD / PLAYER / PRICE / TEAM
 * within 1 second — suitable for Instagram, WhatsApp, and Facebook posts.
 *
 * Data contract: SoldPlayerContract
 * Pure render component — no hooks, no state, no effects.
 * Renderer compatible (inline styles + clamp units).
 */

import React from "react";
import { BidwarCanvas } from "../../canvas/BidwarCanvas";
import { Typography } from "../../design-system/typography";
import { Gradients } from "../../design-system/gradients";
import { defaultBuzzTheme as t } from "../../theme/buzz-theme";
import { SportBadge, SoldBadge } from "../../design-system/badges";
import { PlayerSlot, TeamSlot } from "../../design-system/logo-slots";
import { PriceDisplay } from "../../design-system/stat-cards";
import { formatSoldPrice, formatBidCount } from "./SoldPlayer.utils";
import type { SoldPlayerContract } from "./SoldPlayer.types";

/* ─── Component ──────────────────────────────────────────────────────────── */

/**
 * Sold Player card template.
 *
 * Visual priority (top → bottom by weight):
 *   1. SOLD badge (red, instant recognition)
 *   2. Player avatar — large with monogram fallback
 *   3. Player name — white, bold
 *   4. PRICE — gold hero block, visually dominant
 *   5. SOLD TO + team row
 *   6. Bid count (optional decorative stat)
 *
 * All image fields are optional — design system handles fallbacks automatically.
 */
export function SoldPlayer(props: SoldPlayerContract) {
  const {
    playerName,
    playerImageUrl,
    teamName,
    teamLogoUrl,
    sport,
    designation,
    bidCount,
  } = props;

  const priceDisplay = formatSoldPrice(props);
  const hasBidCount = bidCount != null && bidCount > 0;

  return (
    <BidwarCanvas showWatermark showFooterBranding>
      <div style={s.layout}>

        {/* ── Top strip: sport left ← → SOLD badge right ─────────────────── */}
        <div style={s.topStrip}>
          <SportBadge sport={sport} />
          <SoldBadge />
        </div>

        {/* ── Sold accent line — glowing red strip reinforcing SOLD state ──── */}
        <div style={s.soldAccent} aria-hidden="true" />

        {/* ── Player avatar ─────────────────────────────────────────────────── */}
        <div style={s.avatarWrapper}>
          <PlayerSlot
            playerName={playerName}
            imageUrl={playerImageUrl}
            size="lg"
          />
        </div>

        {/* ── Player name + optional designation ──────────────────────────── */}
        <div style={s.nameArea}>
          <h1 style={Typography.PlayerName}>{playerName.toUpperCase()}</h1>
          {designation && (
            <span style={s.designationPill}>{designation.toUpperCase()}</span>
          )}
        </div>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div style={s.divider} aria-hidden="true" />

        {/* ── PRICE HERO — the most important element ───────────────────────── */}
        <PriceDisplay
          price={priceDisplay}
          label="Sold For"
          style={s.priceBlock}
        />

        {/* ── Team section: "SOLD TO" label + team identity row ─────────────── */}
        {teamName && (
          <div style={s.soldToSection}>
            <span style={s.soldToLabel}>SOLD TO</span>
            <div style={s.teamRow}>
              <TeamSlot
                teamName={teamName}
                imageUrl={teamLogoUrl}
                size={32}
              />
              <span style={Typography.TeamName}>{teamName.toUpperCase()}</span>
            </div>
          </div>
        )}

        {/* ── Optional bid count ────────────────────────────────────────────── */}
        {hasBidCount && (
          <div style={s.bidCountRow}>
            <span style={s.bidCountDot} aria-hidden="true" />
            <span style={s.bidCountText}>{formatBidCount(bidCount!)}</span>
            <span style={s.bidCountDot} aria-hidden="true" />
          </div>
        )}

      </div>
    </BidwarCanvas>
  );
}

/* ─── Template-local styles ──────────────────────────────────────────────── */
//
// Only layout / spacing / template-specific visual accents live here.
// Typography, colors, gradients → design system.
//

const s: Record<string, React.CSSProperties> = {

  layout: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    padding: "0 0 4px",
    gap: 0,
  },

  // Sport badge left, SOLD badge right
  topStrip: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: "12px",
  },

  // Glowing red accent line — 3px, full bleed, fades at edges + box-shadow glow
  soldAccent: {
    width: "100%",
    height: "3px",
    background: `linear-gradient(90deg, transparent, ${t.danger}70, ${t.danger}90, ${t.danger}70, transparent)`,
    marginBottom: "18px",
    borderRadius: "2px",
    boxShadow: `0 0 10px rgba(239,68,68,0.55), 0 2px 6px rgba(239,68,68,0.25)`,
  },

  avatarWrapper: {
    marginBottom: "16px",
  },

  nameArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "7px",
    paddingBottom: "14px",
    textAlign: "center",
  },

  designationPill: {
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

  divider: {
    width: "55%",
    height: "1px",
    background: Gradients.GoldDivider,
    marginBottom: "16px",
  },

  // Hero price block — most dominant element on the card
  priceBlock: {
    width: "100%",
    marginBottom: "16px",
  },

  soldToSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "7px",
    marginBottom: "12px",
    width: "100%",
  },

  soldToLabel: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "clamp(0.5rem, 1.4vw, 0.625rem)",
    fontWeight: 700,
    color: "rgba(255,255,255,0.32)",
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
  },

  // Gold-tinted franchise pill — stronger than before
  teamRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 20px",
    borderRadius: "10px",
    background: `linear-gradient(90deg, rgba(251,191,36,0.10) 0%, rgba(251,191,36,0.04) 100%)`,
    border: `1px solid rgba(251,191,36,0.22)`,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },

  // Bid count row — decorative, low visual weight
  bidCountRow: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
  },

  bidCountDot: {
    width: "3px",
    height: "3px",
    borderRadius: "50%",
    background: `${t.primaryGold}55`,
    display: "inline-block",
    flexShrink: 0,
  },

  bidCountText: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "clamp(0.5625rem, 1.6vw, 0.6875rem)",
    fontWeight: 600,
    color: `${t.primaryGold}85`,
    letterSpacing: "0.10em",
    textTransform: "uppercase" as const,
  },
};
