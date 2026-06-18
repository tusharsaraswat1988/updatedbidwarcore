import React from "react";
import { BidwarCanvas } from "../../canvas/BidwarCanvas";
import { Typography } from "../../design-system/typography";
import { defaultBuzzTheme as t } from "../../theme/buzz-theme";
import { SportBadge } from "../../design-system/badges";
import { PlayerSlot, TeamSlot } from "../../design-system/logo-slots";
import type { PlayerSpotlightContract } from "../../contracts/PlayerSpotlight.contract";
import {
  pickRenderContext,
  type BuzzTemplateRenderProps,
} from "../../rendering/buzz-render-context";
import {
  heroLogoSize,
  heroTitleSize,
  secondaryLabelSize,
  bodyLabelSize,
  isLandscapePoster,
} from "../../rendering/poster-layout";
import {
  posterColumnBody,
  posterColumnRoot,
  posterLandscapeMain,
  posterLandscapeRoot,
  posterLandscapeSide,
} from "../../rendering/poster-shell";

type PlayerSpotlightProps = PlayerSpotlightContract &
  BuzzTemplateRenderProps & {
    /** Injected at render time by the pipeline. Never stored in the contract. */
    backgroundImageUrl?: string;
  };

export function PlayerSpotlight(props: PlayerSpotlightProps) {
  const renderCtx = pickRenderContext(props);
  const {
    playerName,
    teamName,
    playerImageUrl,
    teamLogoUrl,
    sport,
    designation,
    city,
    backgroundImageUrl,
    renderMode,
    aspectRatio,
    renderWidth,
    renderHeight,
  } = props;

  if (renderCtx) {
    const avatarSize = heroLogoSize(renderCtx);
    const titleSize = heroTitleSize(renderCtx);
    const labelSize = secondaryLabelSize(renderCtx);
    const bodySize = bodyLabelSize(renderCtx);
    const landscape = isLandscapePoster(renderCtx);

    const heroBlock = (
      <>
        <div style={s.topRow}>
          <SportBadge sport={sport} />
        </div>
        <div style={s.avatarSection}>
          <PlayerSlot
            playerName={playerName}
            imageUrl={playerImageUrl}
            size={`${avatarSize}px`}
          />
        </div>
        <div style={s.nameArea}>
          <h1
            style={{
              ...Typography.PlayerName,
              fontSize: titleSize,
              textAlign: landscape ? "left" : "center",
            }}
          >
            {playerName.toUpperCase()}
          </h1>
          {designation && (
            <span style={{ ...s.designationPill, fontSize: labelSize }}>{designation.toUpperCase()}</span>
          )}
          {city && (
            <span style={{ ...s.cityText, fontSize: labelSize * 0.9 }}>• {city.toUpperCase()} •</span>
          )}
        </div>
      </>
    );

    const teamBlock = teamName ? (
      <div style={{ ...s.teamSection, alignItems: landscape ? "flex-start" : "center" }}>
        <span style={{ ...s.teamSectionLabel, fontSize: labelSize }}>TEAM</span>
        <div style={{ ...s.teamRow, padding: `${Math.round(bodySize * 0.5)}px ${Math.round(bodySize * 1.2)}px` }}>
          <TeamSlot teamName={teamName} imageUrl={teamLogoUrl} size={Math.round(bodySize * 1.6)} />
          <span style={{ ...Typography.TeamName, fontSize: bodySize }}>{teamName.toUpperCase()}</span>
        </div>
      </div>
    ) : null;

    return (
      <BidwarCanvas
        branding={props.branding}
        backgroundImageUrl={backgroundImageUrl}
        showFooterBranding
        renderMode={renderMode ?? renderCtx.renderMode}
        aspectRatio={aspectRatio ?? renderCtx.aspectRatio}
        renderWidth={renderWidth ?? renderCtx.renderWidth}
        renderHeight={renderHeight ?? renderCtx.renderHeight}
      >
        {landscape ? (
          <div style={posterLandscapeRoot(renderCtx)}>
            <div style={posterLandscapeMain()}>{heroBlock}</div>
            <div style={posterLandscapeSide()}>
              <div style={s.divider} aria-hidden="true" />
              {teamBlock}
            </div>
          </div>
        ) : (
          <div style={posterColumnRoot(renderCtx)}>
            {heroBlock}
            <div style={posterColumnBody()}>
              <div style={s.divider} aria-hidden="true" />
              {teamBlock}
            </div>
          </div>
        )}
      </BidwarCanvas>
    );
  }

  return (
    <BidwarCanvas branding={props.branding} backgroundImageUrl={backgroundImageUrl} showFooterBranding>
      <div style={s.layout}>
        <div style={s.topRow}>
          <SportBadge sport={sport} />
        </div>
        <div style={s.avatarSection}>
          <PlayerSlot playerName={playerName} imageUrl={playerImageUrl} size="xl" />
        </div>
        <div style={s.nameArea}>
          <h1 style={Typography.PlayerName}>{playerName.toUpperCase()}</h1>
          {designation && <span style={s.designationPill}>{designation.toUpperCase()}</span>}
          {city && <span style={s.cityText}>• {city.toUpperCase()} •</span>}
        </div>
        <div style={s.divider} aria-hidden="true" />
        {teamName && (
          <div style={s.teamSection}>
            <span style={s.teamSectionLabel}>TEAM</span>
            <div style={s.teamRow}>
              <TeamSlot teamName={teamName} imageUrl={teamLogoUrl} size={34} />
              <span style={Typography.TeamName}>{teamName.toUpperCase()}</span>
            </div>
          </div>
        )}
      </div>
    </BidwarCanvas>
  );
}

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
    paddingBottom: 12,
  },
  avatarSection: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  nameArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    paddingBottom: 12,
    textAlign: "center",
  },
  designationPill: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontWeight: 700,
    color: t.primaryGold,
    letterSpacing: "0.16em",
    background: "rgba(251,191,36,0.10)",
    border: "1px solid rgba(251,191,36,0.28)",
    borderRadius: 999,
    padding: "3px 12px",
  },
  cityText: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "rgba(255,255,255,0.32)",
    letterSpacing: "0.20em",
  },
  divider: {
    width: "50%",
    height: 1,
    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
    marginBottom: 12,
    alignSelf: "center",
  },
  teamSection: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    width: "100%",
  },
  teamSectionLabel: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontWeight: 700,
    color: "rgba(255,255,255,0.28)",
    letterSpacing: "0.22em",
    textTransform: "uppercase",
  },
  teamRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
};
