/**
 * Buzz Studio — Sold Player Template (Phase 18)
 *
 * Asset-driven content injector. Visual design lives in the background asset;
 * BidWar renders sold status, player photo/name, price, and team identity only.
 *
 * Pipeline: Background Asset → Dynamic Images → Dynamic Text → Footer Branding
 */

import React from "react";
import { BidwarCanvas } from "../../canvas/BidwarCanvas";
import { formatSoldPrice, formatBidCount } from "./SoldPlayer.utils";
import type { SoldPlayerContract } from "./SoldPlayer.types";
import {
  pickRenderContext,
  type BuzzTemplateRenderProps,
} from "../../rendering/buzz-render-context";
import { getTemplateLayout } from "../../rendering/template-layout-registry";
import { BuzzTemplateType } from "../../registry/template-types";
import { isLandscapePoster, posterSpacing } from "../../rendering/poster-layout";
import {
  PosterZoneStack,
  PosterImage,
  PosterTitle,
  PosterMicroLabel,
  PosterAmount,
  PosterMetaLine,
  TournamentHeader,
  TeamIdentityRow,
  posterSizes,
  posterTextAlign,
  posterFlexAlign,
} from "../../rendering/poster-primitives";

type SoldPlayerProps = SoldPlayerContract &
  BuzzTemplateRenderProps & {
    backgroundImageUrl?: string;
  };

export function SoldPlayer(props: SoldPlayerProps) {
  const renderCtx = pickRenderContext(props);
  const {
    playerName,
    playerImageUrl,
    teamName,
    teamLogoUrl,
    designation,
    bidCount,
    backgroundImageUrl,
    renderMode,
    aspectRatio,
    renderWidth,
    renderHeight,
  } = props;

  const priceDisplay = formatSoldPrice(props);
  const hasBidCount = bidCount != null && bidCount > 0;
  const tournamentName = props.branding?.tagline;
  const tournamentLogoUrl = props.branding?.tournamentLogoUrl;

  const canvasProps = {
    branding: props.branding,
    backgroundImageUrl,
    showFooterBranding: true,
    showCornerBrand: false,
  } as const;

  if (renderCtx) {
    const layout = getTemplateLayout(BuzzTemplateType.SOLD_PLAYER, renderCtx.aspectRatio);
    const zones = layout?.zones ?? {};
    const sizes = posterSizes(renderCtx);
    const landscape = isLandscapePoster(renderCtx);
    const align = posterTextAlign(landscape);
    const flexAlign = posterFlexAlign(landscape);
    const spacing = posterSpacing(renderCtx);

    const identityColumn = (
      <>
        <PosterZoneStack spec={{ ...zones.statusLabel, align: flexAlign }} ctx={renderCtx}>
          <PosterMicroLabel size={sizes.labelSize} gold>SOLD</PosterMicroLabel>
        </PosterZoneStack>
        <PosterZoneStack spec={{ ...zones.playerPhoto, flex: 1 }} ctx={renderCtx}>
          <PosterImage name={playerName} url={playerImageUrl} size={sizes.heroPhotoSize} kind="player" />
        </PosterZoneStack>
        <PosterZoneStack spec={{ ...zones.playerName, align: flexAlign }} ctx={renderCtx}>
          <PosterTitle size={sizes.titleSize} align={align}>{playerName}</PosterTitle>
          {designation ? (
            <PosterMetaLine size={sizes.labelSize}>{designation}</PosterMetaLine>
          ) : null}
        </PosterZoneStack>
      </>
    );

    const dealColumn = (
      <>
        <PosterZoneStack spec={{ ...zones.amount, align: flexAlign }} ctx={renderCtx}>
          <PosterAmount label="SOLD FOR" value={priceDisplay} labelSize={sizes.labelSize} valueSize={sizes.amountSize} align={align} />
        </PosterZoneStack>
        {teamName && (
          <PosterZoneStack spec={{ ...zones.teamLogo, align: flexAlign }} ctx={renderCtx}>
            <TeamIdentityRow
              teamName={teamName}
              teamLogoUrl={teamLogoUrl}
              logoSize={Math.round(sizes.bodySize * 1.7)}
              nameSize={sizes.bodySize}
              label="SOLD TO"
              labelSize={sizes.labelSize}
              align={align}
            />
          </PosterZoneStack>
        )}
        {hasBidCount && (
          <PosterMetaLine size={sizes.microSize}>{formatBidCount(bidCount!)}</PosterMetaLine>
        )}
      </>
    );

    const content = landscape ? (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", flex: 1, minHeight: 0 }}>
        <PosterZoneStack spec={{ ...zones.tournamentLogo, align: "center" }} ctx={renderCtx}>
          <TournamentHeader
            logoUrl={tournamentLogoUrl}
            name={tournamentName}
            logoSize={sizes.tournLogoSize}
            nameSize={sizes.tournNameSize}
            microSize={sizes.microSize}
          />
        </PosterZoneStack>
        <div style={{ flex: 1, display: "flex", flexDirection: "row", minHeight: 0, gap: spacing.sectionGap }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>{identityColumn}</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: spacing.sectionGap * 0.7, minWidth: 0 }}>{dealColumn}</div>
        </div>
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", flex: 1, minHeight: 0 }}>
        <PosterZoneStack spec={zones.tournamentLogo} ctx={renderCtx}>
          <TournamentHeader
            logoUrl={tournamentLogoUrl}
            name={tournamentName}
            logoSize={sizes.tournLogoSize}
            nameSize={sizes.tournNameSize}
            microSize={sizes.microSize}
          />
        </PosterZoneStack>
        {identityColumn}
        {dealColumn}
      </div>
    );

    return (
      <BidwarCanvas
        {...canvasProps}
        renderMode={renderMode ?? renderCtx.renderMode}
        aspectRatio={aspectRatio ?? renderCtx.aspectRatio}
        renderWidth={renderWidth ?? renderCtx.renderWidth}
        renderHeight={renderHeight ?? renderCtx.renderHeight}
      >
        {content}
      </BidwarCanvas>
    );
  }

  return (
    <BidwarCanvas {...canvasProps}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", gap: 14 }}>
        <TournamentHeader logoUrl={tournamentLogoUrl} name={tournamentName} logoSize={64} nameSize={13} microSize={9} />
        <PosterMicroLabel size={12} gold>SOLD</PosterMicroLabel>
        <PosterImage name={playerName} url={playerImageUrl} size={110} kind="player" />
        <PosterTitle size={30}>{playerName}</PosterTitle>
        {designation && <PosterMetaLine size={11}>{designation}</PosterMetaLine>}
        <PosterAmount label="SOLD FOR" value={priceDisplay} labelSize={10} valueSize={28} />
        {teamName && (
          <TeamIdentityRow teamName={teamName} teamLogoUrl={teamLogoUrl} logoSize={34} nameSize={14} label="SOLD TO" labelSize={9} />
        )}
        {hasBidCount && <PosterMetaLine size={10}>{formatBidCount(bidCount!)}</PosterMetaLine>}
      </div>
    </BidwarCanvas>
  );
}
