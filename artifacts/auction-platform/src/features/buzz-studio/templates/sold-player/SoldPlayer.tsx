/**
 * Buzz Studio — Sold Player Template
 *
 * The flagship auction graphic. Communicates SOLD / PLAYER / PRICE / TEAM
 * within 1 second — suitable for Instagram, WhatsApp, and Facebook posts.
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

type SoldPlayerProps = SoldPlayerContract & BuzzTemplateRenderProps;

export function SoldPlayer(props: SoldPlayerProps) {
  const renderCtx = pickRenderContext(props);
  const {
    playerName,
    playerImageUrl,
    teamName,
    teamLogoUrl,
    sport,
    designation,
    bidCount,
    renderMode,
    aspectRatio,
    renderWidth,
    renderHeight,
  } = props;

  const priceDisplay = formatSoldPrice(props);
  const hasBidCount = bidCount != null && bidCount > 0;

  if (renderCtx) {
    const avatarSize = heroLogoSize(renderCtx);
    const titleSize = heroTitleSize(renderCtx);
    const labelSize = secondaryLabelSize(renderCtx);
    const bodySize = bodyLabelSize(renderCtx);
    const landscape = isLandscapePoster(renderCtx);

    const identityBlock = (
      <>
        <div style={s.topStrip}>
          <SportBadge sport={sport} />
          <SoldBadge />
        </div>
        <div style={s.soldAccent} aria-hidden="true" />
        <div style={s.avatarWrapper}>
          <PlayerSlot
            playerName={playerName}
            imageUrl={playerImageUrl}
            size={`${avatarSize}px`}
          />
        </div>
        <div style={{ ...s.nameArea, alignItems: landscape ? "flex-start" : "center" }}>
          <h1 style={{ ...Typography.PlayerName, fontSize: titleSize, textAlign: landscape ? "left" : "center" }}>
            {playerName.toUpperCase()}
          </h1>
          {designation && (
            <span style={{ ...s.designationPill, fontSize: labelSize }}>{designation.toUpperCase()}</span>
          )}
        </div>
      </>
    );

    const priceBlock = (
      <PriceDisplay
        price={priceDisplay}
        label="Sold For"
        style={{
          ...s.priceBlock,
          padding: `${Math.round(bodySize * 0.9)}px ${Math.round(bodySize * 1.6)}px`,
        }}
      />
    );

    const footerBlock = (
      <>
        {teamName && (
          <div style={{ ...s.soldToSection, alignItems: landscape ? "flex-start" : "center" }}>
            <span style={{ ...s.soldToLabel, fontSize: labelSize }}>SOLD TO</span>
            <div style={{ ...s.teamRow, padding: `${Math.round(bodySize * 0.5)}px ${Math.round(bodySize * 1.4)}px` }}>
              <TeamSlot teamName={teamName} imageUrl={teamLogoUrl} size={Math.round(bodySize * 1.5)} />
              <span style={{ ...Typography.TeamName, fontSize: bodySize }}>{teamName.toUpperCase()}</span>
            </div>
          </div>
        )}
        {hasBidCount && (
          <div style={s.bidCountRow}>
            <span style={s.bidCountDot} aria-hidden="true" />
            <span style={{ ...s.bidCountText, fontSize: labelSize }}>{formatBidCount(bidCount!)}</span>
            <span style={s.bidCountDot} aria-hidden="true" />
          </div>
        )}
      </>
    );

    return (
      <BidwarCanvas
        branding={props.branding}
        showFooterBranding
        renderMode={renderMode ?? renderCtx.renderMode}
        aspectRatio={aspectRatio ?? renderCtx.aspectRatio}
        renderWidth={renderWidth ?? renderCtx.renderWidth}
        renderHeight={renderHeight ?? renderCtx.renderHeight}
      >
        {landscape ? (
          <div style={posterLandscapeRoot(renderCtx)}>
            <div style={posterLandscapeMain()}>{identityBlock}</div>
            <div style={posterLandscapeSide()}>
              {priceBlock}
              {footerBlock}
            </div>
          </div>
        ) : (
          <div style={posterColumnRoot(renderCtx)}>
            {identityBlock}
            <div style={posterColumnBody()}>
              <div style={s.divider} aria-hidden="true" />
              {priceBlock}
              {footerBlock}
            </div>
          </div>
        )}
      </BidwarCanvas>
    );
  }

  return (
    <BidwarCanvas branding={props.branding} showFooterBranding>
      <div style={s.layout}>
        <div style={s.topStrip}>
          <SportBadge sport={sport} />
          <SoldBadge />
        </div>
        <div style={s.soldAccent} aria-hidden="true" />
        <div style={s.avatarWrapper}>
          <PlayerSlot playerName={playerName} imageUrl={playerImageUrl} size="lg" />
        </div>
        <div style={s.nameArea}>
          <h1 style={Typography.PlayerName}>{playerName.toUpperCase()}</h1>
          {designation && <span style={s.designationPill}>{designation.toUpperCase()}</span>}
        </div>
        <div style={s.divider} aria-hidden="true" />
        <PriceDisplay price={priceDisplay} label="Sold For" style={s.priceBlock} />
        {teamName && (
          <div style={s.soldToSection}>
            <span style={s.soldToLabel}>SOLD TO</span>
            <div style={s.teamRow}>
              <TeamSlot teamName={teamName} imageUrl={teamLogoUrl} size={32} />
              <span style={Typography.TeamName}>{teamName.toUpperCase()}</span>
            </div>
          </div>
        )}
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

const s: Record<string, React.CSSProperties> = {
  layout: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    padding: "0 0 4px",
    gap: 0,
  },
  topStrip: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
  },
  soldAccent: {
    width: "100%",
    height: 3,
    background: `linear-gradient(90deg, transparent, ${t.danger}70, ${t.danger}90, ${t.danger}70, transparent)`,
    marginBottom: 18,
    borderRadius: 2,
    boxShadow: "0 0 10px rgba(239,68,68,0.55), 0 2px 6px rgba(239,68,68,0.25)",
  },
  avatarWrapper: {
    marginBottom: 16,
  },
  nameArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 7,
    paddingBottom: 14,
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
  divider: {
    width: "55%",
    height: 1,
    background: Gradients.GoldDivider,
    marginBottom: 16,
    alignSelf: "center",
  },
  priceBlock: {
    width: "100%",
    marginBottom: 16,
  },
  soldToSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 7,
    marginBottom: 12,
    width: "100%",
  },
  soldToLabel: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontWeight: 700,
    color: "rgba(255,255,255,0.32)",
    letterSpacing: "0.22em",
    textTransform: "uppercase",
  },
  teamRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    background: "linear-gradient(90deg, rgba(251,191,36,0.10) 0%, rgba(251,191,36,0.04) 100%)",
    border: "1px solid rgba(251,191,36,0.22)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  bidCountRow: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  bidCountDot: {
    width: 3,
    height: 3,
    borderRadius: "50%",
    background: `${t.primaryGold}55`,
    display: "inline-block",
    flexShrink: 0,
  },
  bidCountText: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontWeight: 600,
    color: `${t.primaryGold}85`,
    letterSpacing: "0.10em",
    textTransform: "uppercase",
  },
};
