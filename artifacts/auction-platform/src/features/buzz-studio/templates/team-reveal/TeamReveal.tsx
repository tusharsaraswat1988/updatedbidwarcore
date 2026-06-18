import React from "react";
import { BidwarCanvas } from "../../canvas/BidwarCanvas";
import { Typography } from "../../design-system/typography";
import { Gradients } from "../../design-system/gradients";
import { defaultBuzzTheme as t } from "../../theme/buzz-theme";
import { SportBadge, CaptainBadge } from "../../design-system/badges";
import { TeamSlot, AvatarSlot } from "../../design-system/logo-slots";
import { StatCard } from "../../design-system/stat-cards";
import { formatTeamSpend } from "./TeamReveal.utils";
import type { TeamRevealContract } from "./TeamReveal.types";

/* ─── Component ──────────────────────────────────────────────────────────── */

export function TeamReveal(props: TeamRevealContract) {
  const {
    teamName,
    teamLogoUrl,
    sport,
    captainName,
    captainImageUrl,
    playerCount,
  } = props;

  const spendDisplay = formatTeamSpend(props);
  const hasStats = playerCount != null || spendDisplay != null;
  const hasCaptain = !!captainName;
  const displayTeamName = teamName ?? "FRANCHISE";

  return (
    <BidwarCanvas showWatermark showFooterBranding>
      <div style={s.layout}>

        {/* ── Top strip: sport badge left, announcement tag right ─────────── */}
        <div style={s.topStrip}>
          <SportBadge sport={sport} />
          <span style={s.announceTag}>● TEAM REVEAL ●</span>
        </div>

        {/* ── Gold announcement accent line ─────────────────────────────── */}
        <div style={s.announceAccent} aria-hidden="true" />

        {/* ── Team logo with ambient glow ────────────────────────────────── */}
        <div style={s.teamLogoSection}>
          <div style={s.teamLogoGlow} aria-hidden="true" />
          <div style={s.teamLogoRing}>
            <TeamSlot
              teamName={displayTeamName}
              imageUrl={teamLogoUrl}
              size={96}
            />
          </div>
        </div>

        {/* ── Franchise label + team name ───────────────────────────────── */}
        <div style={s.teamNameArea}>
          <span style={s.franchiseLabel}>FRANCHISE</span>
          <h1 style={{ ...Typography.PlayerName, textAlign: "center" }}>
            {displayTeamName.toUpperCase()}
          </h1>
        </div>

        {/* ── Gold divider ──────────────────────────────────────────────── */}
        <div style={s.divider} aria-hidden="true" />

        {/* ── Squad stats ───────────────────────────────────────────────── */}
        {hasStats && (
          <div style={s.statsRow}>
            {playerCount != null && (
              <StatCard
                label="Squad Size"
                value={playerCount}
                icon="👥"
              />
            )}
            {spendDisplay != null && (
              <StatCard
                label="Total Spend"
                value={spendDisplay}
                highlight
                icon="💰"
              />
            )}
          </div>
        )}

        {/* ── Captain row (conditional) ─────────────────────────────────── */}
        {hasCaptain && (
          <div style={s.captainSection}>
            <div style={s.captainSeparator} aria-hidden="true" />
            <span style={s.captainLabel}>CAPTAIN</span>
            <div style={s.captainRow}>
              <AvatarSlot
                name={captainName!}
                kind="player"
                imageUrl={captainImageUrl}
                size="sm"
              />
              <span style={s.captainNameText}>{captainName!}</span>
              <CaptainBadge />
            </div>
          </div>
        )}

      </div>
    </BidwarCanvas>
  );
}

/* ─── Template-local styles ──────────────────────────────────────────────── */
//
// Only layout / spacing / template-specific accents.
// Colors, typography, gradients → design system.
//

const s: Record<string, React.CSSProperties> = {

  layout: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    padding: "0 0 4px",
  },

  // ── Top strip ────────────────────────────────────────────────────────────

  topStrip: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: "10px",
  },

  // Gold pill tag — makes the purpose of the graphic immediately clear
  announceTag: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "clamp(0.45rem, 1.3vw, 0.5625rem)",
    fontWeight: 800,
    color: t.primaryGold,
    letterSpacing: "0.14em",
    background: `rgba(251,191,36,0.09)`,
    border: `1px solid rgba(251,191,36,0.30)`,
    borderRadius: "999px",
    padding: "3px 10px",
    userSelect: "none" as const,
    textTransform: "uppercase" as const,
  },

  // ── Announcement accent line ──────────────────────────────────────────────

  // Gold glow line — reinforces the "announcement" moment visually
  announceAccent: {
    width: "100%",
    height: "2px",
    background: `linear-gradient(90deg, transparent 0%, ${t.primaryGold}50 20%, ${t.primaryGold}75 50%, ${t.primaryGold}50 80%, transparent 100%)`,
    marginBottom: "20px",
    borderRadius: "1px",
    boxShadow: `0 0 10px rgba(251,191,36,0.35), 0 0 24px rgba(251,191,36,0.12)`,
  },

  // ── Team logo ─────────────────────────────────────────────────────────────

  teamLogoSection: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "18px",
  },

  // Wide ambient halo behind the franchise crest
  teamLogoGlow: {
    position: "absolute",
    inset: "-42px",
    borderRadius: "50%",
    background: `radial-gradient(circle, rgba(251,191,36,0.24) 0%, rgba(251,191,36,0.08) 38%, transparent 65%)`,
    pointerEvents: "none",
  },

  // Extra gold ring wrapper around TeamSlot to add depth
  teamLogoRing: {
    position: "relative",
    zIndex: 1,
    padding: "4px",
    borderRadius: "50%",
    background: Gradients.AuctionGlow,
    boxShadow: `0 0 24px rgba(251,191,36,0.40), 0 0 56px rgba(251,191,36,0.15)`,
    boxSizing: "border-box" as const,
  },

  // ── Team name area ────────────────────────────────────────────────────────

  teamNameArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "5px",
    paddingBottom: "12px",
    textAlign: "center" as const,
  },

  // "FRANCHISE" micro-label — sets category context above the name
  franchiseLabel: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "clamp(0.45rem, 1.2vw, 0.5625rem)",
    fontWeight: 700,
    color: "rgba(255,255,255,0.28)",
    letterSpacing: "0.26em",
    textTransform: "uppercase" as const,
  },

  // ── Gold divider ──────────────────────────────────────────────────────────

  divider: {
    width: "55%",
    height: "1px",
    background: Gradients.GoldDivider,
    marginBottom: "14px",
  },

  // ── Stats row ─────────────────────────────────────────────────────────────

  statsRow: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
    flexWrap: "wrap" as const,
    marginBottom: "14px",
    width: "100%",
  },

  // ── Captain section ───────────────────────────────────────────────────────

  captainSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "7px",
    width: "100%",
  },

  captainSeparator: {
    width: "100%",
    height: "1px",
    background: "rgba(255,255,255,0.07)",
  },

  captainLabel: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "clamp(0.45rem, 1.2vw, 0.5625rem)",
    fontWeight: 700,
    color: "rgba(255,255,255,0.28)",
    letterSpacing: "0.26em",
    textTransform: "uppercase" as const,
  },

  // Gold-tinted captain pill — mirrors teamRow pattern from other templates
  captainRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 18px",
    borderRadius: "10px",
    background: `linear-gradient(90deg, rgba(251,191,36,0.10) 0%, rgba(251,191,36,0.04) 100%)`,
    border: `1px solid rgba(251,191,36,0.22)`,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },

  captainNameText: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "clamp(0.75rem, 2.5vw, 1rem)",
    fontWeight: 700,
    color: "#FFFFFF",
    letterSpacing: "0.06em",
    flexShrink: 1,
    minWidth: 0,
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
    whiteSpace: "nowrap" as const,
  },
};
