/**
 * Buzz Studio — Player Spotlight Template (Phase 18)
 *
 * Asset-driven content injector. Visual design lives in the background asset;
 * BidWar renders only player photo, name, team logo/name, and tournament header.
 *
 * Pipeline: Background Asset → Dynamic Images → Dynamic Text → Footer Branding
 */

import React from "react";
import { BidwarCanvas } from "../../canvas/BidwarCanvas";
import type { PlayerSpotlightContract } from "../../contracts/PlayerSpotlight.contract";
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
  PosterMetaLine,
  TournamentHeader,
  TeamIdentityRow,
  posterSizes,
  posterTextAlign,
  posterFlexAlign,
} from "../../rendering/poster-primitives";

type PlayerSpotlightProps = PlayerSpotlightContract &
  BuzzTemplateRenderProps & {
    backgroundImageUrl?: string;
  };

export function PlayerSpotlight(props: PlayerSpotlightProps) {
  const renderCtx = pickRenderContext(props);
  const {
    playerName,
    teamName,
    playerImageUrl,
    teamLogoUrl,
    designation,
    city,
    backgroundImageUrl,
    renderMode,
    aspectRatio,
    renderWidth,
    renderHeight,
  } = props;

  const tournamentName = props.branding?.tagline;
  const tournamentLogoUrl = props.branding?.tournamentLogoUrl;

  const canvasProps = {
    branding: props.branding,
    backgroundImageUrl,
    showFooterBranding: true,
    showCornerBrand: false,
  } as const;

  if (renderCtx) {
    const layout = getTemplateLayout(BuzzTemplateType.PLAYER_SPOTLIGHT, renderCtx.aspectRatio);
    const zones = layout?.zones ?? {};
    const sizes = posterSizes(renderCtx);
    const landscape = isLandscapePoster(renderCtx);
    const align = posterTextAlign(landscape);
    const flexAlign = posterFlexAlign(landscape);
    const spacing = posterSpacing(renderCtx);
    const metaParts = [designation, city].filter(Boolean);

    const content = landscape ? (
      <div style={{ display: "flex", flexDirection: "row", width: "100%", height: "100%", flex: 1, minHeight: 0, gap: spacing.sectionGap }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <PosterZoneStack spec={{ ...zones.tournamentLogo, align: "center" }} ctx={renderCtx}>
            <TournamentHeader
              logoUrl={tournamentLogoUrl}
              name={tournamentName}
              logoSize={sizes.tournLogoSize}
              nameSize={sizes.tournNameSize}
              microSize={sizes.microSize}
            />
          </PosterZoneStack>
          <PosterZoneStack spec={{ ...zones.playerPhoto, flex: 1 }} ctx={renderCtx}>
            <PosterImage name={playerName} url={playerImageUrl} size={sizes.heroPhotoSize} kind="player" />
          </PosterZoneStack>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: spacing.sectionGap * 0.6, minWidth: 0 }}>
          <PosterZoneStack spec={{ ...zones.playerName, align: flexAlign }} ctx={renderCtx}>
            <PosterTitle size={sizes.titleSize} align={align}>{playerName}</PosterTitle>
          </PosterZoneStack>
          {metaParts.length > 0 && (
            <PosterZoneStack spec={{ ...zones.playerMeta, align: flexAlign }} ctx={renderCtx}>
              <PosterMetaLine size={sizes.labelSize}>{metaParts.join(" · ")}</PosterMetaLine>
            </PosterZoneStack>
          )}
          {teamName && (
            <PosterZoneStack spec={{ ...zones.teamLogo, align: flexAlign }} ctx={renderCtx}>
              <TeamIdentityRow
                teamName={teamName}
                teamLogoUrl={teamLogoUrl}
                logoSize={Math.round(sizes.bodySize * 1.8)}
                nameSize={sizes.bodySize}
                label="TEAM"
                labelSize={sizes.labelSize}
                align={align}
              />
            </PosterZoneStack>
          )}
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
        <PosterZoneStack spec={{ ...zones.playerPhoto, flex: 1 }} ctx={renderCtx}>
          <PosterImage name={playerName} url={playerImageUrl} size={sizes.heroPhotoSize} kind="player" />
        </PosterZoneStack>
        <PosterZoneStack spec={zones.playerName} ctx={renderCtx}>
          <PosterTitle size={sizes.titleSize}>{playerName}</PosterTitle>
        </PosterZoneStack>
        {metaParts.length > 0 && (
          <PosterZoneStack spec={zones.playerMeta} ctx={renderCtx}>
            <PosterMetaLine size={sizes.labelSize}>{metaParts.join(" · ")}</PosterMetaLine>
          </PosterZoneStack>
        )}
        {teamName && (
          <PosterZoneStack spec={zones.teamLogo} ctx={renderCtx}>
            <TeamIdentityRow
              teamName={teamName}
              teamLogoUrl={teamLogoUrl}
              logoSize={Math.round(sizes.bodySize * 1.8)}
              nameSize={sizes.bodySize}
              label="TEAM"
              labelSize={sizes.labelSize}
            />
          </PosterZoneStack>
        )}
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
        <TournamentHeader logoUrl={tournamentLogoUrl} name={tournamentName} logoSize={64} nameSize={13} microSize={9} />
        <PosterImage name={playerName} url={playerImageUrl} size={120} kind="player" />
        <PosterTitle size={32}>{playerName}</PosterTitle>
        {(designation || city) && (
          <PosterMetaLine size={11}>{[designation, city].filter(Boolean).join(" · ")}</PosterMetaLine>
        )}
        {teamName && (
          <TeamIdentityRow teamName={teamName} teamLogoUrl={teamLogoUrl} logoSize={36} nameSize={14} label="TEAM" labelSize={9} />
        )}
      </div>
    </BidwarCanvas>
  );
}
