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
  posterSizes,
  posterTextAlign,
  posterFlexAlign,
} from "../../rendering/poster-primitives";
import {
  SoldPlayerHeroPhoto,
  SoldPlayerName,
  SoldPlayerPrice,
  SoldReadabilityBackplate,
  SoldTeamSection,
  SoldToLabel,
  SoldTournamentHeader,
  soldPlayerSizes,
  soldPlayerSectionGap,
} from "./sold-player-chrome";

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
    footerVariant: "generated-by" as const,
  };

  if (renderCtx) {
    const layout = getTemplateLayout(BuzzTemplateType.SOLD_PLAYER, renderCtx.aspectRatio);
    const zones = layout?.zones ?? {};
    const sizes = soldPlayerSizes(posterSizes(renderCtx));
    const landscape = isLandscapePoster(renderCtx);
    const align = posterTextAlign(landscape);
    const flexAlign = posterFlexAlign(landscape);
    const spacing = posterSpacing(renderCtx);

    const sectionGap = soldPlayerSectionGap(spacing.sectionGap, 1.08);

    const identityColumn = (
      <>
        <PosterZoneStack spec={{ ...zones.playerPhoto, flex: 1 }} ctx={renderCtx}>
          <div style={{ paddingTop: Math.round(sizes.microSize * 0.75), position: "relative", zIndex: 1 }}>
            <SoldPlayerHeroPhoto name={playerName} url={playerImageUrl} size={sizes.heroPhotoSize} />
          </div>
        </PosterZoneStack>
        <PosterZoneStack spec={{ ...zones.playerName, align: flexAlign }} ctx={renderCtx}>
          <div style={{ marginTop: -Math.round(sizes.labelSize * 0.38) }}>
            <SoldReadabilityBackplate
              align={flexAlign}
              variant="glass"
              insetX={Math.round(sizes.titleSize * 0.22)}
              insetY={Math.round(sizes.labelSize * 0.45)}
            >
              <SoldPlayerName size={sizes.titleSize} align={align}>
                {playerName}
              </SoldPlayerName>
            </SoldReadabilityBackplate>
          </div>
        </PosterZoneStack>
      </>
    );

    const dealColumn = (
      <>
        <PosterZoneStack spec={{ ...zones.amount, align: flexAlign }} ctx={renderCtx}>
          <SoldReadabilityBackplate
            align={flexAlign}
            variant="price"
            insetX={Math.round(sizes.amountSize * 0.28)}
            insetY={Math.round(sizes.labelSize * 0.75)}
          >
            <SoldPlayerPrice
              label="SOLD FOR"
              value={priceDisplay}
              labelSize={sizes.labelSize}
              valueSize={sizes.amountSize}
              align={align}
            />
          </SoldReadabilityBackplate>
        </PosterZoneStack>
        {teamName && (
          <div
            style={{
              marginTop: Math.round(sectionGap * 0.72),
              display: "flex",
              flexDirection: "column",
              alignItems: flexAlign === "flex-start" ? "flex-start" : "center",
              gap: Math.round(sizes.labelSize * 0.42),
              width: "100%",
            }}
          >
            <SoldToLabel size={Math.max(9, Math.round(sizes.labelSize * 0.72))} />
            <SoldTeamSection
              teamName={teamName}
              teamLogoUrl={teamLogoUrl}
              logoSize={sizes.teamLogoSize}
              nameSize={sizes.teamNameSize}
              bidCountLabel={hasBidCount ? formatBidCount(bidCount!) : null}
              align={align}
            />
          </div>
        )}
      </>
    );

    const content = landscape ? (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", flex: 1, minHeight: 0 }}>
        <PosterZoneStack spec={{ ...zones.tournamentLogo, align: "center" }} ctx={renderCtx}>
          <div style={{ position: "relative", zIndex: 5 }}>
            <SoldTournamentHeader
              logoUrl={tournamentLogoUrl}
              name={tournamentName}
              logoSize={sizes.tournLogoSize}
              nameSize={sizes.tournNameSize}
              microSize={sizes.microSize}
            />
          </div>
        </PosterZoneStack>
        <div style={{ flex: 1, display: "flex", flexDirection: "row", minHeight: 0, gap: sectionGap }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              gap: Math.round(sectionGap * 0.18),
            }}
          >
            {identityColumn}
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              gap: Math.round(sectionGap * 0.85),
              paddingTop: Math.round(sectionGap * 0.15),
              minWidth: 0,
            }}
          >
            {dealColumn}
          </div>
        </div>
      </div>
    ) : (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          flex: 1,
          minHeight: 0,
          gap: sectionGap,
        }}
      >
        <PosterZoneStack spec={zones.tournamentLogo} ctx={renderCtx}>
          <div style={{ position: "relative", zIndex: 5 }}>
            <SoldTournamentHeader
              logoUrl={tournamentLogoUrl}
              name={tournamentName}
              logoSize={sizes.tournLogoSize}
              nameSize={sizes.tournNameSize}
              microSize={sizes.microSize}
            />
          </div>
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", gap: 16 }}>
        <SoldTournamentHeader logoUrl={tournamentLogoUrl} name={tournamentName} logoSize={72} nameSize={16} microSize={9} />
        <SoldPlayerHeroPhoto name={playerName} url={playerImageUrl} size={100} />
        <SoldReadabilityBackplate variant="glass" insetX={20} insetY={10}>
          <SoldPlayerName size={32}>{playerName}</SoldPlayerName>
        </SoldReadabilityBackplate>
        <SoldReadabilityBackplate variant="price" insetX={22} insetY={12}>
          <SoldPlayerPrice label="SOLD FOR" value={priceDisplay} labelSize={10} valueSize={34} />
        </SoldReadabilityBackplate>
        {teamName && (
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <SoldToLabel size={9} />
            <SoldTeamSection
              teamName={teamName}
              teamLogoUrl={teamLogoUrl}
              logoSize={48}
              nameSize={14}
              bidCountLabel={hasBidCount ? formatBidCount(bidCount!) : null}
            />
          </div>
        )}
      </div>
    </BidwarCanvas>
  );
}
