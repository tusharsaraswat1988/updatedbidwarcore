import React from "react";
import { BidwarCanvas } from "../../canvas/BidwarCanvas";
import { Typography } from "../../design-system/typography";
import { Gradients } from "../../design-system/gradients";
import { defaultBuzzTheme as t } from "../../theme/buzz-theme";
import { SportBadge } from "../../design-system/badges";
import { PlayerSlot, TeamSlot } from "../../design-system/logo-slots";
import type { PlayerSpotlightContract } from "../../contracts/PlayerSpotlight.contract";

/* ─── Component ──────────────────────────────────────────────────────────── */

export function PlayerSpotlight(props: PlayerSpotlightContract) {
  const {
    playerName,
    teamName,
    playerImageUrl,
    teamLogoUrl,
    sport,
    designation,
    city,
  } = props;

  return (
    <BidwarCanvas branding={props.branding} showFooterBranding>
      <div style={s.layout}>

        {/* ── Top row: sport badge left-aligned ─────────────────────────── */}
        <div style={s.topRow}>
          <SportBadge sport={sport} />
        </div>

        {/* ── Avatar with energy burst halo behind it ────────────────────── */}
        <div style={s.avatarSection}>
          <div style={s.energyBurst} aria-hidden="true" />
          <PlayerSlot
            playerName={playerName}
            imageUrl={playerImageUrl}
            size="xl"
          />
        </div>

        {/* ── Name + designation + city ─────────────────────────────────── */}
        <div style={s.nameArea}>
          <h1 style={Typography.PlayerName}>{playerName.toUpperCase()}</h1>

          {designation && (
            <span style={s.designationPill}>{designation.toUpperCase()}</span>
          )}

          {city && (
            <span style={s.cityText}>• {city.toUpperCase()} •</span>
          )}
        </div>

        {/* ── Gold divider ──────────────────────────────────────────────── */}
        <div style={s.divider} aria-hidden="true" />

        {/* ── Team section ─────────────────────────────────────────────── */}
        {teamName && (
          <div style={s.teamSection}>
            <span style={s.teamSectionLabel}>TEAM</span>
            <div style={s.teamRow}>
              <TeamSlot
                teamName={teamName}
                imageUrl={teamLogoUrl}
                size={34}
              />
              <span style={Typography.TeamName}>{teamName.toUpperCase()}</span>
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

  topRow: {
    width: "100%",
    display: "flex",
    justifyContent: "flex-start",
    paddingBottom: "12px",
  },

  // Wrapper for avatar + behind-avatar energy burst glow
  avatarSection: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "14px",
  },

  // Static radial burst — creates sports-energy feel behind the avatar
  energyBurst: {
    position: "absolute",
    inset: "-50px",
    borderRadius: "50%",
    background: Gradients.EnergyBurst,
    pointerEvents: "none",
  },

  nameArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    paddingBottom: "12px",
    textAlign: "center",
  },

  // Designation as a pill — more prominent than a plain label
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

  cityText: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "clamp(0.5rem, 1.3vw, 0.6rem)",
    color: "rgba(255,255,255,0.32)",
    letterSpacing: "0.20em",
  },

  divider: {
    width: "50%",
    height: "1px",
    background: Gradients.GoldDivider,
    marginBottom: "12px",
  },

  teamSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    width: "100%",
  },

  teamSectionLabel: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "clamp(0.45rem, 1.2vw, 0.5625rem)",
    fontWeight: 700,
    color: "rgba(255,255,255,0.28)",
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
  },

  // Gold-tinted franchise pill
  teamRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 18px",
    borderRadius: "10px",
    background: `linear-gradient(90deg, rgba(251,191,36,0.09) 0%, rgba(251,191,36,0.04) 100%)`,
    border: `1px solid rgba(251,191,36,0.20)`,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
};
