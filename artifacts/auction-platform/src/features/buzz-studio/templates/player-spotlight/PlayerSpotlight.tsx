import React from "react";
import { BidwarCanvas } from "../../canvas/BidwarCanvas";
import { Typography } from "../../design-system/typography";
import { Gradients } from "../../design-system/gradients";
import { SportBadge } from "../../design-system/badges";
import { PlayerSlot, TeamSlot } from "../../design-system/logo-slots";
import type { PlayerSpotlightData } from "./PlayerSpotlight.types";

/* ─── Component ──────────────────────────────────────────────────────────── */

export function PlayerSpotlight(props: PlayerSpotlightData) {
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
    <BidwarCanvas showWatermark showFooterBranding>
      <div style={s.layout}>

        {/* ── Sport badge ───────────────────────────────────────────────── */}
        <div style={s.topRow}>
          <SportBadge sport={sport} />
        </div>

        {/* ── Player avatar: PlayerSlot handles image → monogram fallback ── */}
        <PlayerSlot
          playerName={playerName}
          imageUrl={playerImageUrl}
          size="lg"
          style={s.avatarMargin}
        />

        {/* ── Name + designation + city ─────────────────────────────────── */}
        <div style={s.nameArea}>
          <h1 style={Typography.PlayerName}>{playerName.toUpperCase()}</h1>

          {designation && (
            <span style={Typography.StatLabel}>{designation}</span>
          )}

          {city && (
            <span style={Typography.Caption}>{city}</span>
          )}
        </div>

        {/* ── Gold divider ──────────────────────────────────────────────── */}
        <div style={s.divider} aria-hidden="true" />

        {/* ── Team row: TeamSlot handles logo → monogram fallback ───────── */}
        {teamName && (
          <div style={s.teamRow}>
            <TeamSlot
              teamName={teamName}
              imageUrl={teamLogoUrl}
              size={32}
            />
            <span style={Typography.TeamName}>{teamName}</span>
          </div>
        )}

      </div>
    </BidwarCanvas>
  );
}

/* ─── Template-local styles ──────────────────────────────────────────────── */
//
// Only layout / spacing remains here.
// All colors, typography, and visual effects live in the design system.
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
    justifyContent: "center",
    paddingBottom: "20px",
  },

  avatarMargin: {
    marginBottom: "22px",
  },

  nameArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    paddingBottom: "18px",
    textAlign: "center",
  },

  divider: {
    width: "40%",
    height: "1px",
    background: Gradients.GoldDivider,
    marginBottom: "16px",
  },

  teamRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "6px 14px",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
  },
};
